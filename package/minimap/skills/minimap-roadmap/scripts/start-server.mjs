#!/usr/bin/env node
import { probeRunningServer, probePort } from "./health-check.mjs";
import { readPalliumPreference, writePalliumPreference, clearPalliumPreference } from "../runtime/src/server-registry.js";
import { parsePalliumEndpoint, palliumConfigId } from "../runtime/src/pallium.js";

const requestedPort = Number(process.env.PORT || 4312);
const explicit = Object.hasOwn(process.env, "MINIMAP_PALLIUM_ENDPOINT");
const storedEndpoint = explicit ? null : await readPalliumPreference();
let rawEndpoint = explicit ? process.env.MINIMAP_PALLIUM_ENDPOINT : (storedEndpoint || "");
let palliumConfig = parsePalliumEndpoint(rawEndpoint);

if (palliumConfig.configured && !palliumConfig.endpoint) {
  if (explicit) {
    process.stderr.write("Invalid MINIMAP_PALLIUM_ENDPOINT; use a loopback HTTP origin or an empty value.\n");
    process.exit(1);
  }
  process.stderr.write("Ignoring an invalid stored Pallium endpoint; Participants remain disabled.\n");
  rawEndpoint = "";
  palliumConfig = parsePalliumEndpoint(rawEndpoint);
}

if (!explicit && palliumConfig.endpoint) {
  process.env.MINIMAP_PALLIUM_ENDPOINT = palliumConfig.endpoint;
}

const expectedConfigId = palliumConfigId(palliumConfig);

function configMatches(server) {
  return server?.participantConfigId === expectedConfigId;
}

function rejectConfigMismatch() {
  process.stderr.write("Minimap is already running with a different or unknown Participants configuration. Run restart-server.mjs with the requested MINIMAP_PALLIUM_ENDPOINT.\n");
  process.exit(1);
}

async function persistExplicitPreference() {
  if (!explicit) return;
  if (palliumConfig.endpoint) await writePalliumPreference(palliumConfig.endpoint);
  else await clearPalliumPreference();
}

const existing = await probeRunningServer();
if (existing) {
  if (!configMatches(existing)) rejectConfigMismatch();
  await persistExplicitPreference();
  process.stdout.write(`Minimap already running at http://localhost:${existing.port} (pid ${existing.pid ?? "?"})\n`);
  process.exit(0);
}

// Tell the bundled server: do NOT fall forward on EADDRINUSE for the first port.
// If we lose the race against another launcher, we'll re-probe and exit cleanly.
process.env.MINIMAP_NO_PORT_FALLBACK = "1";

try {
  await import("../runtime/server.js");
  await persistExplicitPreference();
} catch (error) {
  if (error && error.code === "EADDRINUSE") {
    // Another launcher beat us. Re-probe directly on the requested port.
    const winner = await probePort(requestedPort);
    if (winner) {
      if (!configMatches(winner)) rejectConfigMismatch();
      await persistExplicitPreference();
      process.stdout.write(`Minimap already running at http://localhost:${requestedPort}\n`);
      process.exit(0);
    }
    process.stderr.write(`Port ${requestedPort} is in use by a non-minimap process.\n`);
    process.exit(1);
  }
  throw error;
}
