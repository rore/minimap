#!/usr/bin/env node
// Restarts the minimap server. Composes stop-then-start, leaving a fresh
// server running in the background and exiting cleanly.
//
// Useful when a code change requires bouncing the server, or when an agent
// wants a known-good restart without thinking about port state.
//
// Exit codes:
//   0 — restart succeeded; new server is running and /health-checks ok.
//   1 — failed to stop, or new server did not come up within the timeout.
import net from "node:net";
import fs from "node:fs/promises";
import { readFileSync, unlinkSync, rmdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readServerRegistry, readPalliumPreference, writePalliumPreference, clearPalliumPreference } from "../runtime/src/server-registry.js";
import { parsePalliumConfig, palliumConfigId } from "../runtime/src/pallium.js";
import { resolveMinimapHome } from "../runtime/src/sessions.js";
import { probePort, isSameRuntime, replacementGuidance } from "./health-check.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requestedPort = Number(process.env.PORT || 4312);
const STOP_WAIT_TIMEOUT_MS = 5000;
const START_WAIT_TIMEOUT_MS = 10000;
const POLL_INTERVAL_MS = 100;
const replaceRuntime = process.argv.slice(2).includes("--replace-runtime");
if (process.argv.slice(2).some((arg) => arg !== "--replace-runtime")) {
  process.stderr.write("Usage: restart-server.mjs [--replace-runtime]\n");
  process.exit(1);
}

const restartLockPath = path.join(resolveMinimapHome(), "restart.lock");
const restartLockToken = randomUUID();
const restartLockOwnerName = `${restartLockToken}.json`;
const restartLockOwnerPath = path.join(restartLockPath, restartLockOwnerName);
await fs.mkdir(path.dirname(restartLockPath), { recursive: true });
const lockDeadline = Date.now() + 30_000;

function lockOwnerIsStale(owner, stat) {
  let stale = false;
  if (Number.isSafeInteger(owner?.pid) && owner.pid > 0) {
    // Signal 0 checks the launcher PID without stopping it or the server.
    try { process.kill(owner.pid, 0); } catch (error) { stale = error?.code === "ESRCH"; }
  }
  if (stat && Date.now() - stat.mtimeMs > (owner ? 120_000 : 5_000)) stale = true;
  return stale;
}

async function readLockOwner(lockStat) {
  if (lockStat.isDirectory()) {
    const entries = await fs.readdir(restartLockPath).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (entries === null) return { kind: "unknown", owner: null, raw: null, stat: lockStat };
    if (entries.length === 0) return { kind: "empty-directory", owner: null, raw: null, stat: lockStat };
    if (entries.length !== 1 || !entries[0].endsWith(".json")) return { kind: "unknown", owner: null, raw: null, stat: lockStat };
    const ownerPath = path.join(restartLockPath, entries[0]);
    const ownerStat = await fs.lstat(ownerPath).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (!ownerStat?.isFile()) return { kind: "unknown", owner: null, raw: null, stat: lockStat };
    const raw = await fs.readFile(ownerPath, "utf8").catch(async (error) => {
      if (error?.code === "ENOENT") return null;
      const latest = await fs.lstat(restartLockPath).catch((statError) => statError?.code === "ENOENT" ? null : Promise.reject(statError));
      if (latest?.isDirectory()) return null;
      throw error;
    });
    if (raw === null) return { kind: "unknown", owner: null, raw: null, stat: lockStat };
    let owner = null;
    try { owner = JSON.parse(raw); } catch {}
    if (!owner || entries[0] !== `${owner.token}.json`) return { kind: "unknown", owner: null, raw, stat: lockStat };
    return { kind: "directory", owner, raw, ownerPath, stat: ownerStat, lockStat };
  }
  if (!lockStat.isFile()) return { kind: "unknown", owner: null, raw: null, stat: lockStat };
  const raw = await fs.readFile(restartLockPath, "utf8").catch(async (error) => {
    if (error?.code === "ENOENT") return null;
    const latest = await fs.lstat(restartLockPath).catch((statError) => statError?.code === "ENOENT" ? null : Promise.reject(statError));
    if (latest?.isDirectory()) return null;
    throw error;
  });
  if (raw === null) return { kind: "unknown", owner: null, raw: null, stat: lockStat };
  let owner = null;
  try { owner = JSON.parse(raw); } catch {}
  return { kind: "legacy-file", owner, raw, stat: lockStat };
}

async function removeStaleLock(observed) {
  if (observed.kind === "empty-directory") {
    if (Date.now() - observed.stat.mtimeMs <= 5_000) return false;
    try { await fs.rmdir(restartLockPath); return true; }
    catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTEMPTY" || error?.code === "EEXIST") return false;
      throw error;
    }
  }
  if (observed.kind === "directory") {
    if (!lockOwnerIsStale(observed.owner, observed.stat)) return false;
    const current = await fs.readFile(observed.ownerPath, "utf8").catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (current !== observed.raw) return false;
    await fs.unlink(observed.ownerPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
    try { await fs.rmdir(restartLockPath); return true; }
    catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTEMPTY" || error?.code === "EEXIST") return false;
      throw error;
    }
  }
  if (observed.kind === "legacy-file") {
    if (!lockOwnerIsStale(observed.owner, observed.stat)) return false;
    const currentStat = await fs.lstat(restartLockPath).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (!currentStat?.isFile()) return false;
    const current = await fs.readFile(restartLockPath, "utf8").catch(async (error) => {
      if (error?.code === "ENOENT") return null;
      const latest = await fs.lstat(restartLockPath).catch((statError) => statError?.code === "ENOENT" ? null : Promise.reject(statError));
      if (latest?.isDirectory()) return null;
      throw error;
    });
    if (current !== observed.raw) return false;
    try { await fs.unlink(restartLockPath); return true; }
    catch (error) {
      if (error?.code === "ENOENT") return false;
      const latest = await fs.lstat(restartLockPath).catch((statError) => statError?.code === "ENOENT" ? null : Promise.reject(statError));
      if (latest?.isDirectory()) return false;
      throw error;
    }
  }
  return false;
}

async function createPreparedLock() {
  const preparedPath = path.join(path.dirname(restartLockPath), `.restart-lock-${restartLockToken}`);
  await fs.mkdir(preparedPath);
  try {
    await fs.writeFile(path.join(preparedPath, restartLockOwnerName), JSON.stringify({ pid: process.pid, token: restartLockToken }), { flag: "wx" });
    return preparedPath;
  } catch (error) {
    await fs.unlink(path.join(preparedPath, restartLockOwnerName)).catch((cleanupError) => {
      if (cleanupError?.code !== "ENOENT") throw cleanupError;
    });
    await fs.rmdir(preparedPath).catch(() => {});
    throw error;
  }
}

while (true) {
  const existingStat = await fs.lstat(restartLockPath).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
  let mayPublish = existingStat === null;
  if (existingStat) {
    const observed = await readLockOwner(existingStat);
    if (observed.kind !== "unknown") mayPublish = await removeStaleLock(observed);
  }
  if (mayPublish) {
    const preparedPath = await createPreparedLock();
    try {
      await fs.rename(preparedPath, restartLockPath);
      break;
    } catch (error) {
      await fs.unlink(path.join(preparedPath, restartLockOwnerName)).catch((cleanupError) => {
        if (cleanupError?.code !== "ENOENT") throw cleanupError;
      });
      await fs.rmdir(preparedPath).catch((cleanupError) => {
        if (cleanupError?.code !== "ENOENT") throw cleanupError;
      });
      const target = await fs.lstat(restartLockPath).catch((statError) => statError?.code === "ENOENT" ? null : Promise.reject(statError));
      const owner = target?.isDirectory() && error?.code === "EPERM" ? await readLockOwner(target) : null;
      let collision = target?.isDirectory() && (
        error?.code === "EEXIST" || error?.code === "ENOTEMPTY" || owner?.kind === "directory"
      );
      if (!collision && error?.code === "EPERM" && target?.isDirectory() && owner?.kind !== "directory") {
        const latest = await fs.lstat(restartLockPath).catch((statError) => statError?.code === "ENOENT" ? null : Promise.reject(statError));
        collision = latest === null;
      }
      if (!collision && error?.code === "EEXIST" && target?.isFile()) collision = true;
      if (!collision) throw error;
    }
  }
  if (Date.now() >= lockDeadline) {
    process.stderr.write("Another Minimap restart is still running.\n");
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}
process.once("exit", () => {
  try {
    if (JSON.parse(readFileSync(restartLockOwnerPath, "utf8")).token === restartLockToken) unlinkSync(restartLockOwnerPath);
  } catch {}
  try { rmdirSync(restartLockPath); } catch {}
});

const endpointExplicit = Object.hasOwn(process.env, "MINIMAP_PALLIUM_ENDPOINT");
const dashboardExplicit = Object.hasOwn(process.env, "MINIMAP_PALLIUM_DASHBOARD_ENDPOINT");
const stored = await readPalliumPreference();
let rawEndpoint = endpointExplicit ? process.env.MINIMAP_PALLIUM_ENDPOINT : (stored?.palliumEndpoint || "");
let rawDashboardEndpoint = dashboardExplicit
  ? process.env.MINIMAP_PALLIUM_DASHBOARD_ENDPOINT
  : (endpointExplicit ? "" : (stored?.palliumDashboardEndpoint || ""));
if (endpointExplicit && !String(rawEndpoint || "").trim()) rawDashboardEndpoint = "";
let palliumConfig = parsePalliumConfig(rawEndpoint, rawDashboardEndpoint);
if (palliumConfig.configured && !palliumConfig.endpoint) {
  if (endpointExplicit) {
    process.stderr.write("Invalid MINIMAP_PALLIUM_ENDPOINT; use a loopback HTTP origin or an empty value.\n");
    process.exit(1);
  }
  process.stderr.write("Ignoring an invalid stored Pallium endpoint; Participants remain disabled.\n");
  rawEndpoint = "";
  rawDashboardEndpoint = "";
  palliumConfig = parsePalliumConfig(rawEndpoint, rawDashboardEndpoint);
}
if (palliumConfig.dashboardConfigured && !palliumConfig.dashboardEndpoint) {
  if (dashboardExplicit) {
    process.stderr.write("Invalid MINIMAP_PALLIUM_DASHBOARD_ENDPOINT; use a loopback HTTP origin or an empty value.\n");
    process.exit(1);
  }
  process.stderr.write("Ignoring an invalid stored Pallium dashboard endpoint; participant links remain disabled.\n");
  rawDashboardEndpoint = "";
  palliumConfig = parsePalliumConfig(rawEndpoint, rawDashboardEndpoint);
}
if (palliumConfig.dashboardEndpoint && !palliumConfig.endpoint) {
  if (dashboardExplicit) {
    process.stderr.write("MINIMAP_PALLIUM_DASHBOARD_ENDPOINT requires MINIMAP_PALLIUM_ENDPOINT.\n");
    process.exit(1);
  }
  rawDashboardEndpoint = "";
  palliumConfig = parsePalliumConfig(rawEndpoint, rawDashboardEndpoint);
}
const expectedConfigId = palliumConfigId(palliumConfig);
const childEnv = { ...process.env, PORT: String(requestedPort) };
if (palliumConfig.endpoint) childEnv.MINIMAP_PALLIUM_ENDPOINT = palliumConfig.endpoint;
else delete childEnv.MINIMAP_PALLIUM_ENDPOINT;
if (palliumConfig.dashboardEndpoint) childEnv.MINIMAP_PALLIUM_DASHBOARD_ENDPOINT = palliumConfig.dashboardEndpoint;
else delete childEnv.MINIMAP_PALLIUM_DASHBOARD_ENDPOINT;

// Test whether the port is actually bindable — survives the Windows TIME_WAIT
// window after a graceful stop, where /health is gone but the kernel still
// refuses bind(). probePort only tells us whether /health responds; this
// answers the related but different question of whether bind() would succeed.
function canBindPort(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      try { tester.close(); } catch {}
      resolve(ok);
    };
    tester.once("error", () => finish(false));
    tester.once("listening", () => finish(true));
    try {
      tester.listen(port, "127.0.0.1");
    } catch {
      finish(false);
    }
  });
}

// Cleanup is scoped to our child PID. Never stop a race winner on that port.
async function shutdownIfMinimap(port, expectedPid = null) {
  const found = await probePort(port);
  if (!found) return false;
  try {
    const headers = expectedPid === null ? undefined : { "X-Minimap-Instance-Pid": String(expectedPid) };
    const resp = await fetch(`http://127.0.0.1:${port}/api/shutdown`, { method: "POST", headers });
    return resp.ok;
  } catch {
    return false;
  }
}

// 1. Preflight every target BEFORE stopping anything. An untracked adjacent
// port may belong to another home; a global sweep cannot establish ownership.
const existing = await readServerRegistry();
const targetPorts = new Set([requestedPort]);
if (typeof existing?.port === "number") targetPorts.add(existing.port);
const targets = [];
for (const port of targetPorts) {
  const probe = await probePort(port);
  if (probe) {
    if ((!isSameRuntime(probe) || probe.pid === null || existing?.port !== port || existing?.pid !== probe.pid) && !replaceRuntime) {
      process.stderr.write("Restart refused; different, unknown, or unregistered runtime left untouched.\n" + replacementGuidance(probe));
      process.exit(1);
    }
    targets.push(probe);
  }
}
for (const probe of targets) {
    try {
      const headers = probe.pid === null ? undefined : { "X-Minimap-Instance-Pid": String(probe.pid) };
      const resp = await fetch(`http://127.0.0.1:${probe.port}/api/shutdown`, { method: "POST", headers });
      if (!resp.ok) {
        process.stderr.write(`Shutdown request returned ${resp.status}.\n`);
        process.exit(1);
      }
    } catch (error) {
      process.stderr.write(`Shutdown request failed: ${error.message}\n`);
      process.exit(1);
    }
    // Wait for /health to stop responding AND for the port to be bindable
    // again. The latter is what actually matters for the upcoming spawn —
    // on Windows the kernel can keep the port in TIME_WAIT after the server
    // process has exited, so /health goes silent before bind() is allowed.
    const deadline = Date.now() + STOP_WAIT_TIMEOUT_MS;
    let bindable = false;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const stillUp = Boolean(await probePort(probe.port));
      if (stillUp) continue;
      bindable = await canBindPort(probe.port);
      if (bindable) break;
    }
    if (!bindable) {
      process.stderr.write(`Port ${probe.port} did not become bindable within ${STOP_WAIT_TIMEOUT_MS}ms after shutdown.\n`);
      process.exit(1);
    }
}
// The new server overwrites a stale entry; don't delete a concurrent launcher's
// publication between a registry read and an asynchronous health probe.

// 2. Spawn the new server, detached, so it outlives this script.
//    Note: we do NOT set MINIMAP_NO_PORT_FALLBACK here. If the kernel still
//    has port 4312 in TIME_WAIT (Windows quirk), the bundled server's
//    listenOnAvailablePort will retry across attempts and find the port the
//    moment it's released. Pinning the port would turn that recoverable
//    blip into a hard failure.
const bundledServer = path.join(__dirname, "..", "runtime", "server.js");
const child = spawn(process.execPath, [bundledServer], {
  cwd: process.cwd(),
  env: childEnv,
  windowsHide: true,
  detached: true,
  stdio: ["ignore", "ignore", "ignore", "ipc"],
});
child.unref();

// The registry is shared; another restart may replace it before our first
// probe. The child reports its own bound port over IPC instead.
const ready = await new Promise((resolve) => {
  let settled = false;
  const finish = (message) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    resolve(message);
  };
  const timer = setTimeout(() => finish(null), START_WAIT_TIMEOUT_MS);
  child.once("message", finish);
  child.once("exit", () => finish(null));
  child.once("error", () => finish(null));
});

if (ready?.type !== "minimap-ready" || ready.pid !== child.pid || !Number.isInteger(ready.port)) {
  if (child.connected) child.disconnect();
  process.stderr.write("New server did not report its bound port within " + START_WAIT_TIMEOUT_MS + "ms.\n");
  process.exit(1);
}

const alive = await probePort(ready.port);
const registry = await readServerRegistry();
if (!alive || !isSameRuntime(alive) || alive.pid !== child.pid || alive.participantConfigId !== expectedConfigId
    || registry?.pid !== child.pid || registry.port !== ready.port) {
  if (!alive) {
    process.stderr.write("Restarted child did not respond to /health.\n");
  } else if (!isSameRuntime(alive) || alive.pid !== child.pid) {
    process.stderr.write("Restarted child runtime identity did not match the requested runtime.\n");
  } else if (alive.participantConfigId !== expectedConfigId) {
    process.stderr.write("Restarted server did not report the requested Participants configuration.\n");
  } else {
    process.stderr.write("Another server replaced the restarted child's registry entry.\n");
  }
  await shutdownIfMinimap(ready.port, child.pid);
  if (child.connected) child.disconnect();
  process.exitCode = 1;
} else {
  if (endpointExplicit || dashboardExplicit) {
    if (palliumConfig.endpoint) {
      await writePalliumPreference({
        palliumEndpoint: palliumConfig.endpoint,
        palliumDashboardEndpoint: palliumConfig.dashboardEndpoint,
      });
    } else await clearPalliumPreference();
  }

  try {
    await new Promise((resolve, reject) => {
      child.send({ type: "minimap-ready-ack" }, (error) => error ? reject(error) : resolve());
    });
  } catch (error) {
    await shutdownIfMinimap(ready.port, child.pid);
    if (child.connected) child.disconnect();
    process.stderr.write("Restart acknowledgement failed: " + error.message + "\n");
    process.exit(1);
  }
  if (child.connected) child.disconnect();

  const portNote = ready.port === requestedPort ? "" : " (requested " + requestedPort + ")";
  process.stdout.write("Minimap restarted on http://localhost:" + ready.port + portNote + " (pid " + child.pid + ").\n");
}
