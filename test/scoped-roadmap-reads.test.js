import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { attachFileSession, listFileSessions } from "../package/minimap/src/sessions.js";
import { lookupPalliumParticipants } from "../package/minimap/src/pallium.js";

const run = promisify(execFile);
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = path.join(project, "package/minimap/skills/minimap-roadmap/scripts");

test("scoped session listing skips unrelated details and preserves normalized and unfiltered reads", async (t) => {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-scoped-sessions-"));
  t.after(() => fs.rm(owned, { recursive: true, force: true }));
  const minimapHome = path.join(owned, "home");
  const selected = path.join(owned, "Selected.md");
  const unrelated = path.join(owned, "Other.md");
  await fs.writeFile(selected, "# Selected");
  await fs.writeFile(unrelated, "# Other");
  // Explicit Windows normalization is testable on every host.
  const options = { minimapHome, platform: "win32" };
  const first = await attachFileSession(selected, options);
  const other = await attachFileSession(unrelated, options);
  const reads = [];
  const readFile = fs.readFile;
  fs.readFile = async (file, ...args) => { reads.push(String(file)); return readFile(file, ...args); };
  try {
    const scoped = await listFileSessions({ ...options, targetFiles: [selected.toUpperCase()] });
    assert.equal(scoped.length, 1);
    assert.equal(scoped[0].id, first.session.id);
    assert.deepEqual(scoped[0].counts, { openComments: 0, pendingSuggestions: 0 });
    assert.equal(reads.some((file) => file.includes(other.session.id)), false, "unrelated session files must not be read");
    reads.length = 0;
    assert.deepEqual(await listFileSessions({ ...options, targetFiles: [] }), []);
    assert.equal(reads.some((file) => file.includes(first.session.id) || file.includes(other.session.id)), false);
    assert.equal((await listFileSessions(options)).length, 2, "omitted filter keeps global listing");
  } finally { fs.readFile = readFile; }
});

test("pre-aborted participant detail makes no provider request", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const options = { signal: controller.signal, fetchImpl: async () => { calls += 1; throw new Error("unexpected fetch"); } };
  const reference = { contract: "minimap-roadmap-item/v1", scope_ref: "roadmap:v1:git:github.com/example/fixture#roadmap", local_ref: "item:v1:feature" };
  await assert.rejects(lookupPalliumParticipants({ configured: true, endpoint: "http://127.0.0.1:19836" }, reference, options), { name: "AbortError" });
  assert.equal(calls, 0);
  assert.equal((await lookupPalliumParticipants({ configured: false }, reference, options)).status, "disabled");
  assert.equal((await lookupPalliumParticipants({ configured: true }, null, options)).status, "identity-unavailable");
  assert.equal((await lookupPalliumParticipants({ configured: true }, reference, options)).status, "unsupported");
});

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

test("participant HTTP detail reads each item once and preserves missing-item errors", { timeout: 30000 }, async (t) => {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-scoped-http-"));
  const root = path.join(owned, "repo"), home = path.join(owned, "home");
  await fs.mkdir(root);
  await fs.cp(path.join(project, "package/minimap/templates"), root, { recursive: true });
  await fs.writeFile(path.join(root, "roadmap.config.json"), '{"roadmapPath":"roadmap"}');
  await run("git", ["init", "-b", "main"], { cwd: root, windowsHide: true });
  await run("git", ["remote", "add", "origin", "https://github.com/example/fixture"], { cwd: root, windowsHide: true });
  const provider = http.createServer((_req, res) => { res.writeHead(503); res.end(); });
  const providerPort = await listen(provider);
  const probe = http.createServer();
  const port = await listen(probe);
  await new Promise((resolve) => probe.close(resolve));
  const log = path.join(owned, "reads.log"), hook = path.join(owned, "reads.mjs");
  await fs.writeFile(log, "");
  await fs.writeFile(hook, `import fs from "node:fs/promises";
import path from "node:path";
const original = fs.readFile;
fs.readFile = async (file, ...args) => {
  if (path.basename(String(file)) === "example-feature.md") await fs.appendFile(${JSON.stringify(log)}, "read\\n");
  return original(file, ...args);
};
`);
  const env = { ...process.env, MINIMAP_HOME: home, PORT: String(port),
    MINIMAP_PALLIUM_ENDPOINT: `http://127.0.0.1:${providerPort}`, MINIMAP_PALLIUM_DASHBOARD_ENDPOINT: "",
    NODE_OPTIONS: `--import=${pathToFileURL(hook).href}` };
  let child;
  t.after(async () => {
    try {
      await run(process.execPath, [path.join(scripts, "stop-server.mjs")], { env, windowsHide: true, timeout: 10000 });
      if (child && child.exitCode === null && child.signalCode === null) await once(child, "exit", { signal: AbortSignal.timeout(10000) });
    } finally {
      provider.closeAllConnections();
      await new Promise((resolve) => provider.close(resolve));
      assert.equal(path.dirname(path.resolve(owned)), path.resolve(os.tmpdir()));
      await fs.rm(owned, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
  child = spawn(process.execPath, [path.join(scripts, "start-server.mjs")], { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`Startup timeout: ${output}`)), 10000);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Startup exited ${code}: ${output}`)); });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.includes(`localhost:${port}`)) { clearTimeout(timer); resolve(); }
    });
  });
  const headers = { "x-minimap-repo": root };
  const response = await fetch(`http://127.0.0.1:${port}/api/items/example-feature/participants`, { headers });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "unreachable");
  assert.equal((await fs.readFile(log, "utf8")).trim().split("\n").length, 1, "one full item-index read, not two");
  for (const id of ["missing-item", "constructor", "toString"]) {
    const missing = await fetch(`http://127.0.0.1:${port}/api/items/${id}/participants`, { headers });
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, "not_found");
  }
});
