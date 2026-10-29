// Shared per-user service lifecycle; native commands are injectable for isolated tests.
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveMinimapHome } from "./sessions.js";
import { readServerRegistry, deleteServerRegistry, readRuntimeIdentity, readPalliumPreference, writePalliumPreference, clearPalliumPreference, SERVER_API_COMPATIBILITY } from "./server-registry.js";
import { printLifecycleHistory } from "./server-lifecycle-log.js";
import { parsePalliumConfig, palliumConfigId } from "./pallium.js";

const exec = promisify(execFile);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const xml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const ps = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const safeString = (value) => typeof value === "string" && value.length > 0 && !/[\0\r\n]/.test(value);
const samePath = (a, b, platform) => typeof a === "string" && typeof b === "string"
  && (platform === "win32" ? path.win32.normalize(a).toLowerCase() === path.win32.normalize(b).toLowerCase() : path.normalize(a) === path.normalize(b));
const unitQuote = (value, command = false) => '"' + String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("%", "%%").replaceAll("$", () => command ? "$$" : "$") + '"';

export function servicePaths(home, platform = process.platform, userHome = os.homedir()) {
  const id = createHash("sha256").update(platform === "win32" ? path.resolve(home).toLowerCase() : path.resolve(home)).digest("hex").slice(0, 16);
  const root = path.join(home, "service");
  return { root, config: path.join(root, "config.json"), lock: path.join(home, "service.lock"),
    runner: path.join(root, "runner.cjs"), wrapper: path.join(root, "runner.vbs"),
    definition: platform === "win32" ? path.join(root, "task.xml") : path.join(userHome, ".config/systemd/user", `minimap-${id}.service`),
    name: platform === "win32" ? `Minimap-${id}` : `minimap-${id}.service` };
}

export function serviceDefinitions(config, paths) {
  if (![config.node, paths.runner, paths.config, paths.root].every(safeString)) throw new Error("Service paths must not contain control characters.");
  const marker = `Minimap user service ${config.token}`;
  if (config.platform === "win32") {
    if ([config.node, paths.runner, paths.config, paths.wrapper, paths.root, config.wscript].some((value) => !safeString(value) || value.includes("%"))) throw new Error("Windows service paths cannot contain % because Windows Script Host expands environment references.");
    const quoteArg = (arg) => '"' + arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1") + '"';
    const command = [config.node, paths.runner, paths.config].map(quoteArg).join(" ");
    const wrapper = `Option Explicit\r\nDim shell, code\r\nSet shell = CreateObject("WScript.Shell")\r\ncode = shell.Run("${command.replaceAll('"', '""')}", 0, True)\r\nWScript.Quit code\r\n`;
    const args = `"${paths.wrapper}"`;
    const definition = `<?xml version="1.0" encoding="UTF-16"?>\n<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"><RegistrationInfo><Description>${xml(marker)}</Description></RegistrationInfo><Triggers><LogonTrigger><Enabled>true</Enabled><UserId>${xml(config.userId)}</UserId></LogonTrigger></Triggers><Principals><Principal id="Author"><UserId>${xml(config.userId)}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals><Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><AllowHardTerminate>false</AllowHardTerminate><StartWhenAvailable>true</StartWhenAvailable><Enabled>${config.enabled}</Enabled><ExecutionTimeLimit>PT0S</ExecutionTimeLimit><RestartOnFailure><Interval>PT1M</Interval><Count>3</Count></RestartOnFailure></Settings><Actions Context="Author"><Exec><Command>${xml(config.wscript)}</Command><Arguments>${xml(args)}</Arguments><WorkingDirectory>${xml(paths.root)}</WorkingDirectory></Exec></Actions></Task>\n`;
    return { marker, wrapper, definition, execute: config.wscript, args };
  }
  const directory = paths.root.replaceAll("\\", "\\\\").replaceAll("%", "%%");
  const definition = `[Unit]\nDescription=${marker}\nStartLimitIntervalSec=60\nStartLimitBurst=3\n\n[Service]\nType=simple\nExecStart=${[config.node, paths.runner, paths.config].map((value) => unitQuote(value, true)).join(" ")}\nWorkingDirectory=${directory}\nRestart=on-failure\nRestartSec=5\nTimeoutStopSec=15\n\n[Install]\nWantedBy=default.target\n`;
  return { marker, definition };
}

async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function writeConfig(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, json(value), { mode: 0o600 });
  try { await fs.rename(temporary, file); }
  finally { await fs.rm(temporary, { force: true }); }
}

export function createNativeService({ platform, paths, run = async (file, args) => (await exec(file, args, { windowsHide: true, timeout: 20000 })).stdout }) {
  const powershell = (script) => run("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from("$ErrorActionPreference='Stop';" + script, "utf16le").toString("base64")]);
  const systemctl = (...args) => run("systemctl", ["--user", ...args]);
  async function query() {
    if (platform === "win32") {
      const raw = await powershell(`$t=Get-ScheduledTask -TaskPath '\\' -ErrorAction Stop|Where-Object {$_.TaskName -eq ${ps(paths.name)}};if($t){$id=$t.Principal.UserId;if($id -notmatch '^S-1-'){$id=([Security.Principal.NTAccount]$id).Translate([Security.Principal.SecurityIdentifier]).Value};[pscustomobject]@{marker=$t.Description;execute=$t.Actions.Execute;args=$t.Actions.Arguments;cwd=$t.Actions.WorkingDirectory;userId=$id;running=($t.State -eq 'Running');lastResult=(Get-ScheduledTaskInfo -InputObject $t).LastTaskResult}|ConvertTo-Json -Compress}`);
      return raw.trim() ? JSON.parse(raw) : null;
    }
    let definition;
    try { definition = await fs.readFile(paths.definition, "utf8"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    let raw;
    try { raw = await systemctl("show", paths.name, "--property=LoadState,FragmentPath,ActiveState,DropInPaths,ExecMainStatus", "--no-pager"); }
    catch (error) { if (!/^LoadState=not-found\r?$/m.test(error.stdout || "")) throw error; raw = error.stdout; }
    const fields = Object.fromEntries(raw.trim().split(/\r?\n/).map((line) => line.split(/=(.*)/s).slice(0, 2)));
    if (!definition && fields.LoadState === "not-found" && !fields.FragmentPath) return null;
    if (fields.FragmentPath !== paths.definition || fields.DropInPaths) throw new Error("Foreign systemd unit or drop-in shadows the managed definition.");
    if (definition && !samePath(await fs.realpath(paths.definition), paths.definition, platform)) throw new Error("Managed unit must not be a symbolic link.");
    return { definition, running: ["active", "activating", "deactivating", "reloading"].includes(fields.ActiveState), lastResult: fields.ExecMainStatus };
  }
  return {
    identity: async () => platform === "win32" ? (await powershell("[Security.Principal.WindowsIdentity]::GetCurrent().User.Value")).trim() : String(process.getuid()),
    query,
    async register(config, replace = false) {
      const { definition, wrapper } = serviceDefinitions(config, paths);
      if (platform === "win32") {
        await fs.writeFile(paths.wrapper, Buffer.from("\ufeff" + wrapper, "utf16le"));
        await fs.writeFile(paths.definition, Buffer.from("\ufeff" + definition, "utf16le"));
        await run("schtasks.exe", ["/Create", "/TN", paths.name, "/XML", paths.definition, ...(replace ? ["/F"] : [])]);
      } else {
        await fs.mkdir(path.dirname(paths.definition), { recursive: true });
        if (replace) {
          const temporary = `${paths.definition}.${randomUUID()}.tmp`;
          try { await fs.writeFile(temporary, definition, { mode: 0o600, flag: "wx" }); await fs.rename(temporary, paths.definition); }
          finally { await fs.rm(temporary, { force: true }); }
        } else await fs.writeFile(paths.definition, definition, { mode: 0o600, flag: "wx" });
        await systemctl("daemon-reload");
      }
    },
    async enable(enabled) {
      if (platform === "win32") await run("schtasks.exe", ["/Change", "/TN", paths.name, enabled ? "/ENABLE" : "/DISABLE"]);
      else await systemctl(enabled ? "enable" : "disable", paths.name);
    },
    async start() {
      if (platform === "win32") await run("schtasks.exe", ["/Run", "/TN", paths.name]);
      else { await systemctl("reset-failed", paths.name); await systemctl("start", paths.name); }
    },
    async remove() {
      if (platform === "win32") await run("schtasks.exe", ["/Delete", "/TN", paths.name, "/F"]);
      else { await systemctl("disable", paths.name); await fs.unlink(paths.definition); await systemctl("daemon-reload"); }
    },
  };
}

export function createUserService(options = {}) {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const home = path.resolve(options.home || resolveMinimapHome(env, platform));
  const paths = servicePaths(home, platform, options.userHome || os.homedir());
  const native = options.native || createNativeService({ platform, paths, run: options.run });
  const timeout = options.timeout || 12000;
  const source = options.source || fileURLToPath(new URL("..", import.meta.url));
  const probe = options.probe || (async (port) => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(800) });
      const health = await response.json();
      return response.ok && health.ok === true ? health : null;
    } catch { return null; }
  });
  const registry = options.registry || (() => readServerRegistry({ minimapHome: home }));
  const removeRegistry = options.removeRegistry || (() => deleteServerRegistry({ minimapHome: home }));
  const pidAlive = options.pidAlive || ((pid) => {
    try { process.kill(pid, 0); return true; } catch (error) { if (error.code === "ESRCH") return false; throw error; }
  });
  async function ownedStale(value, entry) {
    const instance = await readJson(path.join(paths.root, "instance.json"));
    return entry?.port === value.port && Number.isSafeInteger(entry.pid) && entry.pid > 0 && instance?.pid === entry.pid
      && instance.token === value.token && samePath(instance.sourcePath, path.join(releasePath(value.current), "server.js"), platform) && !pidAlive(entry.pid);
  }
  const shutdown = options.shutdown || (async (config, live) => {
    const response = await fetch(`http://127.0.0.1:${config.port}/api/shutdown`, { method: "POST", headers: { "X-Minimap-Instance-Pid": String(live.pid) }, signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error(`Managed shutdown returned ${response.status}.`);
  });
  async function config() {
    const value = await readJson(paths.config);
    if (!value) return null;
    if (value.schema !== 1 || value.platform !== platform || !samePath(value.home, home, platform)
      || !/^[a-f0-9-]{36}$/.test(value.token) || !safeString(value.node) || !path.isAbsolute(value.node)
      || !safeString(value.userId) || typeof value.enabled !== "boolean"
      || !Number.isInteger(value.port) || value.port < 1 || value.port > 65535
      || !validRelease(value.current) || (value.previous !== null && !validRelease(value.previous))) throw new Error("Invalid managed service configuration; left untouched.");
    if (platform === "win32" && (!safeString(value.wscript) || !path.win32.isAbsolute(value.wscript))) throw new Error("Invalid service executable.");
    for (const [key, val] of Object.entries(value.settings || {})) {
      if (key !== "UV_THREADPOOL_SIZE" || !/^[0-9]{1,4}$/.test(val) || Number(val) < 1 || Number(val) > 1024) throw new Error("Invalid persisted service setting.");
    }
    await confined(paths.root);
    await confined(releasePath(value.current));
    return value;
  }
  function validRelease(value) { return typeof value === "string" && /^[a-f0-9-]{36}$/.test(value); }
  function releasePath(value) { return path.join(paths.root, "releases", value); }
  async function confined(target) {
    if (!samePath(await fs.realpath(target), path.resolve(target), platform)) throw new Error("Managed service paths must not contain symbolic links.");
  }
  async function ownership(value) {
    const definition = await native.query();
    if (!definition) throw new Error("Managed service definition is missing; left untouched.");
    const expected = serviceDefinitions(value, paths);
    if (platform === "win32" ? definition.marker !== expected.marker || definition.execute !== expected.execute
      || definition.args !== expected.args || definition.cwd !== paths.root || definition.userId !== value.userId
      : definition.definition !== expected.definition) throw new Error("Foreign service definition; left untouched.");
    if (String(await native.identity()) !== value.userId) throw new Error("Service belongs to another user.");
    return definition;
  }
  async function health(value, starting = false, stoppingPid = null) {
    const live = await probe(value.port);
    const entry = await registry();
    if (live) {
      const expected = await readRuntimeIdentity(path.join(releasePath(value.current), "server.js"));
      if (!Number.isSafeInteger(live.pid) || live.runtime?.apiCompatibility !== SERVER_API_COMPATIBILITY || live.runtime?.version !== expected.version
        || !samePath(live.runtime?.sourcePath, expected.sourcePath, platform)) throw new Error("Managed server ownership mismatch; left untouched.");
      if (!entry && starting) return null;
      if (!entry && stoppingPid === live.pid) return live;
      if (entry?.port !== value.port || entry.pid !== live.pid) throw new Error("Managed server ownership mismatch; left untouched.");
    } else if (entry && !await ownedStale(value, entry)) {
      throw new Error("Foreign or unrecognized server registry; left untouched.");
    }
    return live;
  }
  async function wait(value, running, stoppingPid = null) {
    const deadline = Date.now() + timeout;
    do {
      const live = await health(value, running, stoppingPid);
      const definition = await ownership(value);
      if (running ? Boolean(live) && definition.running : !live && !definition.running) {
        if (running) {
          const stored = await readPalliumPreference({ minimapHome: home });
          if (live.participants?.configId !== palliumConfigId(parsePalliumConfig(stored?.palliumEndpoint || "", stored?.palliumDashboardEndpoint || ""))) throw new Error("Managed server Participants configuration did not match the requested preference.");
        }
        return live;
      }
      await delay(100);
    } while (Date.now() < deadline);
    throw new Error(`Managed service did not become ${running ? "healthy" : "stopped"}; inspect service logs and status.`);
  }
  async function stop(value) {
    await ownership(value);
    const live = await health(value);
    value = { ...value, enabled: false };
    await writeConfig(paths.config, value);
    await native.enable(false);
    if (live) await shutdown(value, live);
    else {
      const entry = await registry();
      if (entry) {
        if (!await ownedStale(value, entry)) throw new Error("Registry ownership changed during stop; left untouched.");
        await removeRegistry();
      }
    }
    await wait(value, false, live?.pid);
    return value;
  }
  async function start(value) {
    await ownership(value);
    const live = await health(value);
    const stored = await readPalliumPreference({ minimapHome: home });
    const preference = parsePalliumConfig(stored?.palliumEndpoint || "", stored?.palliumDashboardEndpoint || "");
    if (live && live.participants?.configId !== palliumConfigId(preference)) throw new Error("Managed Participants preference changed; restart the service.");
    value = { ...value, enabled: true };
    await writeConfig(paths.config, value);
    await native.enable(true);
    if (!live) await native.start();
    await wait(value, true);
    return value;
  }
  async function stage() {
    const id = randomUUID();
    const destination = releasePath(id);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.mkdir(destination);
    try {
      for (const entry of ["server.js", "cli.js", "package.json", "src", "ui", "templates"]) {
        await fs.cp(path.join(source, entry), path.join(destination, entry), { recursive: true });
      }
      const identity = await readRuntimeIdentity(path.join(destination, "server.js"));
      if (identity.apiCompatibility !== SERVER_API_COMPATIBILITY) throw new Error("Staged runtime is incompatible.");
      await fs.access(path.join(destination, "src/user-service.js"));
    } catch (error) { await confined(destination); await fs.rm(destination, { recursive: true }); throw error; }
    return id;
  }
  async function transaction(value, next) {
    const definition = await ownership(value);
    const live = await health(value);
    if (definition.running !== Boolean(live) || value.enabled !== Boolean(live)) throw new Error("Service is starting, failed, or stale; resolve its state before changing runtime.");
    const running = Boolean(live);
    try {
      await stop(value);
      await writeConfig(paths.config, { ...next, enabled: false });
      await native.register({ ...next, enabled: false }, true);
      if (running) await start({ ...next, enabled: false });
    } catch (error) {
      try {
        const current = await config();
        await stop(current);
        await writeConfig(paths.config, { ...value, enabled: false });
        await native.register({ ...value, enabled: false }, true);
        if (running) await start({ ...value, enabled: false });
      } catch (restore) { throw new AggregateError([error, restore], "Service update failed and restoration failed; preserved both runtimes. Inspect service status before retrying."); }
      throw error;
    }
  }
  async function action(command) {
    if (!["install", "update", "rollback", "uninstall", "start", "stop", "restart", "status"].includes(command)) throw new Error("Usage: service.mjs install|update|rollback|uninstall|status");
    if (!["win32", "linux"].includes(platform)) throw new Error("Managed services support Windows and Linux user systemd only; portable mode remains available.");
    if (command === "status") {
      const value = await config();
      if (!value) return { managed: false, running: false, code: 3 };
      const definition = await ownership(value);
      const live = await health(value);
      return { managed: true, running: Boolean(live), enabled: value.enabled, port: value.port, pid: live?.pid ?? null, runtime: live?.runtime ?? null,
        participants: live?.participants ?? null, lastResult: definition.lastResult, source: path.join(releasePath(value.current), "server.js"), code: live && definition.running ? 0 : live || definition.running || value.enabled ? 1 : 3 };
    }
    await fs.mkdir(home, { recursive: true });
    let lock;
    const lockToken = randomUUID();
    for (;;) {
      try { lock = await fs.open(paths.lock, "wx", 0o600); break; }
      catch (error) {
        if (error.code !== "EEXIST") throw error;
        const raw = await fs.readFile(paths.lock, "utf8");
        let owner;
        try { owner = JSON.parse(raw); } catch {}
        if (!Number.isSafeInteger(owner?.pid) || owner.pid < 1 || !/^[a-f0-9-]{36}$/.test(owner.token || "") || pidAlive(owner.pid)) {
          throw new Error("Another managed service operation owns service.lock; wait or inspect the interrupted operation before removing its lock.");
        }
        if (await fs.readFile(paths.lock, "utf8") === raw) await fs.unlink(paths.lock);
      }
    }
    await lock.writeFile(json({ pid: process.pid, token: lockToken }));
    let previousPreference, preferenceChanged = false, restartWasRunning = false, createdRoot = false;
    async function applyPreference() {
      const endpointExplicit = Object.hasOwn(env, "MINIMAP_PALLIUM_ENDPOINT");
      const dashboardExplicit = Object.hasOwn(env, "MINIMAP_PALLIUM_DASHBOARD_ENDPOINT");
      if (!endpointExplicit && !dashboardExplicit) return;
      previousPreference = await readPalliumPreference({ minimapHome: home });
      const endpoint = endpointExplicit ? env.MINIMAP_PALLIUM_ENDPOINT : previousPreference?.palliumEndpoint || "";
      const dashboard = endpointExplicit && !String(endpoint || "").trim() ? "" : dashboardExplicit ? env.MINIMAP_PALLIUM_DASHBOARD_ENDPOINT : endpointExplicit ? "" : previousPreference?.palliumDashboardEndpoint || "";
      const requested = parsePalliumConfig(endpoint, dashboard);
      if (requested.configured && !requested.endpoint || requested.dashboardConfigured && !requested.dashboardEndpoint || requested.dashboardEndpoint && !requested.endpoint) throw new Error("Invalid Participants endpoint settings; use loopback HTTP origins or empty values.");
      preferenceChanged = true;
      if (requested.endpoint) await writePalliumPreference({ palliumEndpoint: requested.endpoint, palliumDashboardEndpoint: requested.dashboardEndpoint }, { minimapHome: home });
      else await clearPalliumPreference({ minimapHome: home });
    }
    try {
      const value = await config();
      if (command === "install") {
        serviceDefinitions({ platform, token: "preflight", node: process.execPath, userId: "preflight", wscript: platform === "win32" ? path.win32.join(env.SystemRoot || "C:\\Windows", "System32/wscript.exe") : null, enabled: false }, paths);
        if (value) throw new Error("Service is already installed; use update.");
        if (await native.query()) throw new Error("Foreign service definition; left untouched.");
        if (await registry()) throw new Error("Server registry already exists; stop portable Minimap before installation.");
        const port = Number(env.PORT || 4312);
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer from 1 to 65535.");
        if (await probe(port)) throw new Error("Port already serves Minimap; left untouched.");
        const settings = {};
        if (Object.hasOwn(env, "UV_THREADPOOL_SIZE")) {
          if (!/^[0-9]{1,4}$/.test(env.UV_THREADPOOL_SIZE) || Number(env.UV_THREADPOOL_SIZE) < 1 || Number(env.UV_THREADPOOL_SIZE) > 1024) throw new Error("UV_THREADPOOL_SIZE must be 1..1024.");
          settings.UV_THREADPOOL_SIZE = env.UV_THREADPOOL_SIZE;
        }
        try { await fs.mkdir(paths.root); }
        catch (error) { if (error.code === "EEXIST") throw new Error("Unrecognized service directory already exists; left untouched."); throw error; }
        createdRoot = true;
        await confined(paths.root);
        const current = await stage();
        const installed = { schema: 1, token: randomUUID(), platform, home, port, node: process.execPath,
          userId: String(await native.identity()), wscript: platform === "win32" ? path.win32.join(env.SystemRoot || "C:\\Windows", "System32/wscript.exe") : null,
          current, previous: null, enabled: false, settings };
        const runner = `const fs = require('node:fs');\nconst path = require('node:path');\nconst { pathToFileURL } = require('node:url');\nconst config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));\nif (!config.enabled) process.exit(0);\nprocess.env.UV_THREADPOOL_SIZE = config.settings.UV_THREADPOOL_SIZE || '8';\nimport(pathToFileURL(path.join(config.home, 'service/releases', config.current, 'src/user-service.js')).href).then(m => m.runServiceForeground(config)).catch(e => { console.error(e); process.exitCode = 1; });\n`;
        await fs.writeFile(paths.runner, runner, { mode: 0o600 });
        await writeConfig(paths.config, installed);
        await applyPreference();
        try { await native.register(installed); await start(installed); }
        catch (error) {
          try { if (await native.query()) { await ownership(installed); await stop(await config()); await native.remove(); } }
          catch (cleanup) { throw new AggregateError([error, cleanup], "Installation failed; managed files retained for inspection."); }
          await fs.rm(paths.config, { force: true });
          throw error;
        }
      } else {
        if (!value) throw new Error("No managed service is installed.");
        await ownership(value);
        const live = await health(value);
        restartWasRunning = command === "restart" && Boolean(live);
        if (["start", "restart"].includes(command)) await applyPreference();
        if (command === "start") await start(value);
        else if (command === "stop") await stop(value);
        else if (command === "restart") { await stop(value); await start({ ...value, enabled: false }); }
        else if (command === "update" || command === "rollback") {
          const current = command === "update" ? await stage() : value.previous;
          if (!current) throw new Error("No previous runtime is available.");
          await confined(releasePath(current));
          await transaction(value, { ...value, current, previous: value.current });
        } else if (command === "uninstall") {
          await stop(value);
          await native.remove();
          // Only the managed subtree is removed; sessions, preferences and logs remain.
          await confined(paths.root);
          await fs.rm(paths.root, { recursive: true });
        }
      }
      const final = command === "uninstall" ? null : await config();
      return { managed: command !== "uninstall", command, port: final?.port, url: final ? `http://localhost:${final.port}/` : null, code: 0 };
    } catch (error) {
      if (createdRoot) {
        try {
          if (!await native.query()) { await confined(paths.root); await fs.rm(paths.root, { recursive: true }); }
        } catch (cleanup) { throw new AggregateError([error, cleanup], "Installation failed; owned service files retained for inspection."); }
      }
      if (preferenceChanged) {
        if (previousPreference) await writePalliumPreference(previousPreference, { minimapHome: home });
        else await clearPalliumPreference({ minimapHome: home });
        if (restartWasRunning) {
          try { await start(await config()); }
          catch (restore) { throw new AggregateError([error, restore], "Restart failed and previous Participants state could not be restored."); }
        }
      }
      throw error;
    } finally {
      await lock.close();
      if ((await readJson(paths.lock))?.token === lockToken) await fs.unlink(paths.lock);
    }
  }
  return { action, config, paths };
}

export async function runServiceForeground(config) {
  if (!config.enabled) return;
  const service = createUserService({ home: config.home });
  const verified = await service.config();
  if (!verified || verified.token !== config.token || verified.current !== config.current) throw new Error("Foreground service configuration changed.");
  if (!verified.enabled) return;
  const ownRuntime = fileURLToPath(new URL("../server.js", import.meta.url));
  const expected = path.join(service.paths.root, "releases", config.current, "server.js");
  if (!samePath(await fs.realpath(ownRuntime), expected, process.platform)) throw new Error("Foreground runner is outside the managed runtime.");
  const entry = await readServerRegistry({ minimapHome: config.home });
  const instanceFile = path.join(service.paths.root, "instance.json");
  if (entry) {
    const previous = await readJson(instanceFile);
    if (entry.port !== config.port || entry.pid !== previous?.pid || previous.token !== config.token
      || !samePath(previous.sourcePath, ownRuntime, process.platform)) throw new Error("Foreign server registry prevents managed startup.");
    let dead = false;
    try { process.kill(entry.pid, 0); } catch (error) { dead = error.code === "ESRCH"; }
    if (!dead) throw new Error("Previous managed PID is still present; refusing a second instance.");
    await deleteServerRegistry({ minimapHome: config.home });
  }
  await writeConfig(instanceFile, { pid: process.pid, token: config.token, sourcePath: ownRuntime });
  const stored = await readPalliumPreference({ minimapHome: config.home });
  const preference = parsePalliumConfig(stored?.palliumEndpoint || "", stored?.palliumDashboardEndpoint || "");
  if ((preference.configured && !preference.endpoint) || (preference.dashboardConfigured && !preference.dashboardEndpoint)) throw new Error("Invalid stored Participants settings.");
  // Resolve integration settings from the preserved preference, not the launcher.
  for (const name of ["MINIMAP_PALLIUM_ENDPOINT", "MINIMAP_PALLIUM_DASHBOARD_ENDPOINT", "NODE_OPTIONS"]) delete process.env[name];
  process.env.MINIMAP_HOME = config.home;
  process.env.PORT = String(config.port);
  process.env.MINIMAP_NO_PORT_FALLBACK = "1";
  if (preference.endpoint) process.env.MINIMAP_PALLIUM_ENDPOINT = preference.endpoint;
  if (preference.dashboardEndpoint) process.env.MINIMAP_PALLIUM_DASHBOARD_ENDPOINT = preference.dashboardEndpoint;
  await import(pathToFileURL(ownRuntime));
}

export async function routeManagedLifecycle(command) {
  const service = createUserService();
  if (!await service.config()) return false;
  if (Object.hasOwn(process.env, "PORT") && Number(process.env.PORT) !== (await service.config()).port) throw new Error("Managed service port is pinned; PORT differs from its installation.");
  const result = await service.action(command);
  if (command === "status") {
    process.stdout.write(`Minimap managed service is ${result.running ? "running" : result.enabled ? "unhealthy" : "stopped"}.\n`
      + `  port: ${result.port}\n  pid: ${result.pid ?? "unknown"}\n  version: ${result.runtime?.version ?? "unknown"}\n`
      + `  API: ${result.runtime?.apiCompatibility ?? "unknown"}\n  source: ${result.source}\n`
      + `  participants: ${result.participants?.mode ?? "unknown"}\n  participant links: ${result.participants?.links ?? "unknown"}\n`
      + `  native result: ${result.lastResult ?? "unknown"}\n`
      + `  url: http://localhost:${result.port}/\n`);
    printLifecycleHistory(undefined, result.pid);
  } else process.stdout.write(`Minimap managed service ${command} succeeded${result.url ? ` at ${result.url}` : ""}.\n`);
  process.exit(result.code);
}
