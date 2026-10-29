import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createUserService, createNativeService, serviceDefinitions, servicePaths } from "../package/minimap/src/user-service.js";
import { readRuntimeIdentity, readPalliumPreference } from "../package/minimap/src/server-registry.js";
import { parsePalliumConfig, palliumConfigId } from "../package/minimap/src/pallium.js";

const source = fileURLToPath(new URL("../package/minimap", import.meta.url));
async function fixture(t, platform = "linux") {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-service-unit-"));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  let definition = null, live = null, entry = null, failStart = false, linger = false, pendingShutdown = 0;
  const calls = [];
  const env = { PORT: "54321", UV_THREADPOOL_SIZE: "3", SECRET_TOKEN: "never-persist" };
  let service;
  const native = {
    identity: async () => "test-user",
    query: async () => definition,
    register: async (config) => { calls.push("register"); definition = { ...serviceDefinitions(config, service.paths), cwd: service.paths.root, userId: config.userId, running: false }; },
    enable: async (enabled) => { calls.push(`enable:${enabled}`); },
    start: async () => {
      calls.push("start");
      if (failStart) { failStart = false; throw new Error("Injected start failure"); }
      const config = await service.config();
      const preference = await readPalliumPreference({ minimapHome: home });
      live = { ok: true, pid: 12345, runtime: await readRuntimeIdentity(path.join(service.paths.root, "releases", config.current, "server.js")),
        participants: { configId: palliumConfigId(parsePalliumConfig(preference?.palliumEndpoint || "", preference?.palliumDashboardEndpoint || "")) } };
      entry = { pid: live.pid, port: config.port };
      definition.running = true;
    },
    remove: async () => { calls.push("remove"); definition = null; },
  };
  service = createUserService({ platform, home, userHome: home, source, native, timeout: 400, env, pidAlive: (pid) => pid === process.pid, removeRegistry: async () => { entry = null; },
    registry: async () => entry, probe: async () => {
      if (pendingShutdown && --pendingShutdown === 0) { live = null; definition.running = false; }
      return live;
    },
    shutdown: async () => { calls.push("shutdown"); assert.equal((await service.config()).enabled, false); entry = null;
      if (linger) pendingShutdown = 2;
      else { live = null; definition.running = false; }
    },
  });
  return { service, home, calls, env, failStart: () => { failStart = true; }, foreign: () => { live.runtime.sourcePath += "-foreign"; },
    crash: async () => { const config = await service.config(); await fs.writeFile(path.join(service.paths.root, "instance.json"), JSON.stringify({ token: config.token, pid: live.pid, sourcePath: live.runtime.sourcePath })); live = null; definition.running = false; },
    linger: () => { linger = true; }, nativeStopped: () => { definition.running = false; },
    stale: () => { live = null; entry = { pid: 44, port: 1234 }; }, foreignDefinition: () => { definition.marker = "foreign"; definition.definition = "foreign"; } };
}

for (const platform of ["win32", "linux"]) {
  test(`${platform}: shared lifecycle, rollback, stopped updates and data preservation`, async (t) => {
    const { service, home, calls } = await fixture(t, platform);
    await fs.writeFile(path.join(home, "existing-session.jsonl"), "preserve me");
    await service.action("install");
    const initial = await service.config();
    assert.equal((await service.action("status")).code, 0);
    assert.equal(initial.settings.UV_THREADPOOL_SIZE, "3");
    assert.doesNotMatch(await fs.readFile(service.paths.config, "utf8"), /SECRET_TOKEN|never-persist/);
    assert.equal(initial.port, 54321);
    await service.action("update");
    const updated = await service.config();
    assert.notEqual(updated.current, initial.current);
    assert.equal(updated.previous, initial.current);
    await service.action("rollback");
    assert.equal((await service.config()).current, initial.current);
    await service.action("stop");
    assert.equal((await service.action("status")).code, 3);
    const starts = calls.filter((call) => call === "start").length;
    await service.action("update");
    assert.equal(calls.filter((call) => call === "start").length, starts, "stopped update must stay stopped");
    await service.action("start");
    await service.action("restart");
    await service.action("uninstall");
    assert.equal(await fs.readFile(path.join(home, "existing-session.jsonl"), "utf8"), "preserve me");
    assert.equal((await service.action("status")).managed, false);
  });

  test(`${platform}: failed update restores prior runtime and prior running state`, async (t) => {
    const { service, failStart } = await fixture(t, platform);
    await service.action("install");
    const before = await service.config();
    failStart();
    await assert.rejects(service.action("update"), /Injected start failure/);
    assert.equal((await service.config()).current, before.current);
    assert.equal((await service.action("status")).code, 0);
  });

  test(`${platform}: foreign runtime and definition fail closed before shutdown`, async (t) => {
    const a = await fixture(t, platform);
    await a.service.action("install");
    a.foreign();
    await assert.rejects(a.service.action("restart"), /ownership mismatch/);
    assert.equal(a.calls.includes("shutdown"), false);
    const b = await fixture(t, platform);
    await b.service.action("install");
    b.foreignDefinition();
    await assert.rejects(b.service.action("uninstall"), /Foreign service definition/);
    assert.equal(b.calls.includes("shutdown"), false);
  });
}

test("mutations serialize, stale ownership fails closed and unsafe release paths cannot escape", async (t) => {
  const { service, stale, calls } = await fixture(t);
  await service.action("install");
  await fs.writeFile(service.paths.lock, "another operation");
  await assert.rejects(service.action("stop"), /Another managed service operation/);
  await fs.unlink(service.paths.lock);
  stale();
  await assert.rejects(service.action("stop"), /Foreign or unrecognized server registry/);
  assert.equal(calls.includes("shutdown"), false);
  const config = await service.config();
  await fs.writeFile(service.paths.config, JSON.stringify({ ...config, current: "../../data" }));
  await assert.rejects(service.action("uninstall"), /Invalid managed service configuration/);
});

test("definitions quote XML, VBS and systemd values and reject Windows environment expansion", () => {
  const config = { platform: "win32", token: "test-token", node: "C:\\Program Files\\Nödé & Co\\node.exe", wscript: "C:\\Windows\\System32\\wscript.exe", userId: "S-1-5-21-123", enabled: false };
  const paths = { root: "C:\\A & B\\日本語", runner: "C:\\A & B\\日本語\\runner.cjs", config: "C:\\A & B\\日本語\\config.json", wrapper: "C:\\A & B\\日本語\\runner.vbs" };
  const result = serviceDefinitions(config, paths);
  assert.match(result.definition, /A &amp; B/);
  assert.match(result.definition, /<LogonType>InteractiveToken/);
  assert.match(result.definition, /<RunLevel>LeastPrivilege/);
  assert.match(result.definition, /<Count>3<\/Count>/);
  assert.match(result.wrapper, /shell.Run\("""C:\\Program Files/);
  assert.match(result.wrapper, /, 0, True\)/);
  assert.match(result.wrapper, /WScript.Quit code/);
  assert.throws(() => serviceDefinitions(config, { ...paths, runner: "C:\\%USERPROFILE%\\runner.cjs" }), /cannot contain %/);
  const unit = serviceDefinitions({ ...config, platform: "linux", node: '/a b/"node' }, { ...paths, root: "/a$b/%x", runner: "/a$b/%x/runner", config: "/a$b/%x/config" }).definition;
  assert.match(unit, /ExecStart="\/a b\/\\"node" "\/a\$\$b\/%%x\/runner"/);
  assert.match(unit, /WorkingDirectory=\/a\$b\/%%x/);
  assert.match(unit, /Restart=on-failure/);
  assert.throws(() => serviceDefinitions({ ...config, platform: "linux" }, { ...paths, root: "/unsafe\n[Service]" }), /control characters/);
});

test("failed initial installation can be retried without adopting a foreign service root", async (t) => {
  const { service, failStart, home } = await fixture(t);
  failStart();
  await assert.rejects(service.action("install"), /Injected start failure/);
  await assert.rejects(fs.access(service.paths.root), { code: "ENOENT" });
  await service.action("install");
  assert.equal((await service.action("status")).code, 0);
  const foreign = await fixture(t);
  await fs.mkdir(foreign.service.paths.root);
  await assert.rejects(foreign.service.action("install"), /Unrecognized service directory/);
  assert.deepEqual(await fs.readdir(foreign.service.paths.root), []);
});

test("own crashed instance is observable and can be stopped without touching foreign ownership", async (t) => {
  const { service, crash } = await fixture(t);
  await service.action("install");
  await crash();
  assert.equal((await service.action("status")).code, 1);
  await service.action("stop");
  assert.equal((await service.action("status")).code, 3);
  await service.action("start");
  assert.equal((await service.action("status")).code, 0);
});

test("managed explicit Participants settings validate, persist, and restore on failed restart", async (t) => {
  const { service, env, home, failStart } = await fixture(t);
  env.MINIMAP_PALLIUM_ENDPOINT = "http://127.0.0.1:12345";
  await service.action("install");
  const before = await readPalliumPreference({ minimapHome: home });
  env.MINIMAP_PALLIUM_ENDPOINT = "http://127.0.0.1:23456";
  failStart();
  await assert.rejects(service.action("restart"), /Injected start failure/);
  assert.deepEqual(await readPalliumPreference({ minimapHome: home }), before);
  assert.equal((await service.action("status")).code, 0);
  env.MINIMAP_PALLIUM_ENDPOINT = "http://example.com";
  await assert.rejects(service.action("restart"), /Invalid Participants/);
  assert.deepEqual(await readPalliumPreference({ minimapHome: home }), before);
});

test("Windows path expansion is rejected before filesystem or native mutation", async (t) => {
  const { service, env, calls } = await fixture(t, "win32");
  env.SystemRoot = "C:\\%BAD%";
  await assert.rejects(service.action("install"), /cannot contain %/);
  assert.equal(calls.length, 0);
  await assert.rejects(fs.access(service.paths.root), { code: "ENOENT" });
});

test("native Windows runner uses argument arrays, UTF16 BOM files, and surfaces command failure", async (t) => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-native-"));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  const paths = servicePaths(home, "win32", home);
  await fs.mkdir(paths.root);
  const calls = [];
  const native = createNativeService({ platform: "win32", paths, run: async (file, args) => { calls.push([file, args]); return ""; } });
  await native.register({ platform: "win32", token: "test", node: process.execPath, userId: "test", wscript: "C:\\Windows\\System32\\wscript.exe", enabled: false });
  assert.equal((await fs.readFile(paths.wrapper)).readUInt16LE(0), 0xfeff);
  assert.equal((await fs.readFile(paths.definition)).readUInt16LE(0), 0xfeff);
  assert.deepEqual(calls[0], ["schtasks.exe", ["/Create", "/TN", paths.name, "/XML", paths.definition]]);
  const failing = createNativeService({ platform: "linux", paths, run: async () => { throw new Error("No user manager"); } });
  await assert.rejects(failing.enable(true), /No user manager/);
});

test("Linux native query rejects shadow units and preserves foreign definition", async (t) => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-native-linux-"));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  const paths = servicePaths(home, "linux", home);
  const missing = createNativeService({ platform: "linux", paths, run: async () => "LoadState=not-found\nFragmentPath=\nActiveState=inactive\n" });
  assert.equal(await missing.query(), null);
  const shadow = createNativeService({ platform: "linux", paths, run: async () => "LoadState=loaded\nFragmentPath=/elsewhere/foreign.service\nActiveState=inactive\n" });
  await assert.rejects(shadow.query(), /Foreign systemd unit/);
});

test("Windows query normalizes account names to SID and returns native failure details", async () => {
  const expected = { marker: "owned", execute: "wscript.exe", args: "fixture", userId: "S-1-5-21-42", running: false, lastResult: 7 };
  let query;
  const native = createNativeService({ platform: "win32", paths: { name: "test" }, run: async (file, args) => { query = Buffer.from(args.at(-1), "base64").toString("utf16le"); return JSON.stringify(expected); } });
  assert.deepEqual(await native.query(), expected);
  assert.match(query, /NTAccount/);
  assert.match(query, /Translate\(\[Security.Principal.SecurityIdentifier\]\)/);
  assert.match(query, /LastTaskResult/);
  assert.match(query, /Get-ScheduledTask -TaskPath '\\' -ErrorAction Stop\|Where-Object \{\$_\.TaskName -eq 'test'\}/);
  assert.doesNotMatch(query, /-TaskName|SilentlyContinue/);
});

test("Windows native query returns null for a unique absent task without registration", { skip: process.platform !== "win32" }, async () => {
  const native = createNativeService({ platform: "win32", paths: { name: `Minimap-readonly-absent-${randomUUID()}` } });
  assert.equal(await native.query(), null);
});

test("Windows native query preserves genuine Scheduler errors", async () => {
  const failure = new Error("Scheduler access denied");
  const native = createNativeService({ platform: "win32", paths: { name: "test" }, run: async () => { throw failure; } });
  await assert.rejects(native.query(), (error) => error === failure);
});

test("stop tolerates its own disappearing registry while exact health PID finishes exiting", async (t) => {
  const { service, linger } = await fixture(t);
  await service.action("install");
  linger();
  await service.action("stop");
  assert.equal((await service.action("status")).code, 3);
});

test("healthy HTTP with inactive native owner is inconsistent status", async (t) => {
  const { service, nativeStopped } = await fixture(t);
  await service.action("install");
  nativeStopped();
  assert.equal((await service.action("status")).code, 1);
});

test("lock recovers a proven dead owner and refuses a live owner", async (t) => {
  const { service } = await fixture(t);
  await service.action("install");
  await fs.writeFile(service.paths.lock, JSON.stringify({ pid: process.pid, token: randomUUID() }));
  await assert.rejects(service.action("stop"), /Another managed service operation/);
  await fs.writeFile(service.paths.lock, JSON.stringify({ pid: 123456789, token: randomUUID() }));
  await service.action("stop");
  await assert.rejects(fs.access(service.paths.lock), { code: "ENOENT" });
});

test("Linux explicit start resets exhausted failure budget before starting", async () => {
  const calls = [];
  const native = createNativeService({ platform: "linux", paths: { name: "fixture.service" }, run: async (file, args) => { calls.push([file, args]); return ""; } });
  await native.start();
  assert.deepEqual(calls, [["systemctl", ["--user", "reset-failed", "fixture.service"]], ["systemctl", ["--user", "start", "fixture.service"]]]);
});
