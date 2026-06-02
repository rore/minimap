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
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readServerRegistry, deleteServerRegistry } from "../runtime/src/server-registry.js";
import { probePort, probeRunningServer } from "./health-check.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requestedPort = Number(process.env.PORT || 4312);
const STOP_WAIT_TIMEOUT_MS = 3000;
const START_WAIT_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 50;

// 1. Stop whatever is running.
const existing = await readServerRegistry();
if (existing && typeof existing.port === "number") {
  const probe = await probePort(existing.port, existing);
  if (probe) {
    try {
      const resp = await fetch(`http://localhost:${existing.port}/api/shutdown`, { method: "POST" });
      if (!resp.ok) {
        process.stderr.write(`Shutdown request returned ${resp.status}.\n`);
        process.exit(1);
      }
    } catch (error) {
      process.stderr.write(`Shutdown request failed: ${error.message}\n`);
      process.exit(1);
    }
    // Wait for the port to be free.
    const deadline = Date.now() + STOP_WAIT_TIMEOUT_MS;
    let stillUp = true;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      stillUp = Boolean(await probePort(existing.port));
      if (!stillUp) break;
    }
    if (stillUp) {
      process.stderr.write(`Old server did not exit within ${STOP_WAIT_TIMEOUT_MS}ms.\n`);
      process.exit(1);
    }
  } else {
    // Stale registry — clean it up so the new server can write a fresh one.
    await deleteServerRegistry();
  }
}

// 2. Spawn the new server, detached, so it outlives this script.
const bundledServer = path.join(__dirname, "..", "runtime", "server.js");
const child = spawn(process.execPath, [bundledServer], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(requestedPort) },
  detached: true,
  stdio: "ignore",
});
child.unref();

// 3. Wait for /health to come up on the requested port.
const startDeadline = Date.now() + START_WAIT_TIMEOUT_MS;
let alive = null;
while (Date.now() < startDeadline) {
  await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  alive = await probeRunningServer();
  if (alive && alive.port === requestedPort) break;
  alive = null;
}

if (!alive) {
  process.stderr.write(`New server did not come up on port ${requestedPort} within ${START_WAIT_TIMEOUT_MS}ms.\n`);
  process.exit(1);
}

process.stdout.write(`Minimap restarted on http://localhost:${alive.port} (pid ${alive.pid ?? "?"}).\n`);
process.exit(0);
