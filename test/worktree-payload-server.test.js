import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expandWorktreePayload } from "../package/minimap/ui/worktree-payload.js";

const exec = promisify(execFile);
const scripts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../package/minimap/skills/minimap-roadmap/scripts");
const preload = `import cp from "node:child_process";
import {syncBuiltinESMExports} from "node:module";
import {promisify} from "node:util";
if (process.send) {
  let count=0; const original=cp.execFile;
  function observed(file,args,...rest) { if(file==="git")count++; return original(file,args,...rest); }
  observed[promisify.custom]=(...args)=>new Promise((resolve,reject)=>observed(...args,(error,stdout,stderr)=>{
    if(error){error.stdout=stdout;error.stderr=stderr;reject(error);}else resolve({stdout,stderr});
  }));
  cp.execFile=observed; const spawn=cp.spawn;
  cp.spawn=(file,...args)=>{if(file==="git")count++;return spawn(file,...args);};
  syncBuiltinESMExports();
  process.on("message",m=>{if(m==="git-count")process.send({gitCount:count});});
}`;
async function port() {
  const socket = http.createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const value = socket.address().port;
  await new Promise((resolve) => socket.close(resolve)); return value;
}
function gitCount(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.off("message", receive); reject(new Error("Missing owned Git counters")); }, 3000);
    function receive(message) { if (typeof message?.gitCount === "number") { clearTimeout(timer); child.off("message", receive); resolve(message.gitCount); } }
    child.on("message", receive); child.send("git-count");
  });
}

test("compact and legacy HTTP callers share retained scans, participants and source guards", { timeout: 60_000 }, async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-compact-http-"));
  const home = path.join(dir, "home"), root = path.join(dir, "main"), sibling = path.join(dir, "sibling");
  let providerGate;
  const provider = http.createServer(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (providerGate) { providerGate.enter(); await providerGate.pending; }
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
      contract: "relay-work-ref-counts/v1", as_of: "2026-10-01T00:00:00Z", recent_seconds: 86400,
      counts: payload.references.map((reference) => ({ ...reference, participant_count: 2,
        recent_participant_count: 1, dormant_participant_count: 1 })),
    }));
  });
  let child;
  const env = { ...process.env, MINIMAP_HOME: home, PORT: String(await port()) };
  try {
    await fs.mkdir(home); await fs.mkdir(path.join(root, "roadmap/features"), { recursive: true });
    await fs.mkdir(path.join(root, "roadmap/ideas"));
    const git = (...args) => exec("git", args, { cwd: root, windowsHide: true });
    await git("init", "-b", "main"); await git("config", "user.name", "Test");
    await git("config", "user.email", "test@example.invalid"); await git("config", "core.autocrlf", "false");
    await git("remote", "add", "origin", "https://github.com/example/compact-fixture.git");
    await fs.writeFile(path.join(root, "roadmap/board.md"), "# Now\n- alpha\n- absent\n\n# Later\n- alpha\n");
    await fs.writeFile(path.join(root, "roadmap/scope.md"), "Generic scope.\n");
    await fs.writeFile(path.join(root, "roadmap/features/alpha.md"), "---\nid: alpha\ntitle: Alpha\nstatus: queued\npriority: medium\ncommitment: committed\n---\n\n## Summary\nGeneric body.\n");
    await fs.writeFile(path.join(root, "roadmap/ideas/.keep"), "");
    await git("add", "."); await git("commit", "-m", "fixture");
    await git("worktree", "add", "-b", "feature/sibling", sibling);
    await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
    env.MINIMAP_PALLIUM_ENDPOINT = `http://127.0.0.1:${provider.address().port}`;
    env.MINIMAP_PALLIUM_DASHBOARD_ENDPOINT = "";
    const preloadPath = path.join(home, "git-counts.mjs"); await fs.writeFile(preloadPath, preload);
    env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ""} --import=${pathToFileURL(preloadPath).href}`.trim();
    child = spawn(process.execPath, [path.join(scripts, "start-server.mjs")], { cwd: root, env,
      windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"] });
    await new Promise((resolve, reject) => {
      let output = ""; const timer = setTimeout(() => reject(new Error(output || "Startup timeout")), 15000);
      const receive = (chunk) => { output += chunk; if (output.includes("Minimap running at")) { clearTimeout(timer); resolve(); } };
      child.stdout.on("data", receive); child.stderr.on("data", receive); child.once("error", reject);
    });
    const health = await (await fetch(`http://127.0.0.1:${env.PORT}/health`)).json();
    assert.equal(health.pid, child.pid, "Only the disposable server may be stopped");
    const headers = { "X-Minimap-Repo-Encoded": encodeURIComponent(root) };
    const read = async (query, signal) => {
      const response = await fetch(`http://127.0.0.1:${env.PORT}/api/worktree-workspace${query}`, { headers, signal });
      const text = await response.text(); return { status: response.status, bytes: Buffer.byteLength(text), value: JSON.parse(text) };
    };
    const before = await gitCount(child);
    const [modern, legacy] = await Promise.all([read("?compact=1&participants=0"), read("?participants=0")]);
    const scanCalls = await gitCount(child) - before;
    assert.equal(modern.status, 200); assert.equal(legacy.status, 200);
    assert.equal(modern.value.worktreeFormat, "compact-v1");
    assert.equal(Object.hasOwn(legacy.value, "worktreeFormat"), false);
    assert.equal(modern.value.snapshot.id, legacy.value.snapshot.id);
    assert.deepEqual(expandWorktreePayload(modern.value), legacy.value);
    assert.ok(modern.bytes < legacy.bytes * 0.7);
    const freshBefore = await gitCount(child);
    const fresh = await read("?compact=1&participants=0");
    assert.equal(fresh.status, 200, JSON.stringify(fresh.value));
    assert.equal(await gitCount(child) - freshBefore, scanCalls, "Mixed styles must perform one scan");
    const warmBefore = await gitCount(child);
    for (const query of ["?compact=1&cached=1", "?cached=1"]) {
      const warm = await read(query); assert.equal(warm.status, 200);
      assert.equal(warm.value.snapshot.id, fresh.value.snapshot.id);
      assert.equal(warm.value.participantCounts.status, "ok");
      assert.equal(warm.value.participantCounts.counts[0].participantCount, 2);
    }
    assert.equal(await gitCount(child), warmBefore, "Both retained response styles launch zero Git processes");
    let entered, release;
    const providerEntered = new Promise((resolve) => { entered = resolve; });
    providerGate = { enter: entered, pending: new Promise((resolve) => { release = resolve; }), release: () => release() };
    let observationSettled = false;
    const observation = fetch(`http://127.0.0.1:${env.PORT}/api/board/observations?snapshot=${encodeURIComponent(fresh.value.snapshot.id)}`, {
      headers, signal: AbortSignal.timeout(5000),
    }).then(async (response) => ({ status: response.status, value: await response.json() }))
      .finally(() => { observationSettled = true; });
    try {
      await Promise.race([providerEntered, observation.then(() => { throw new Error("Observation did not enter the held provider"); })]);
      const probes = [], heldBefore = await gitCount(child);
      for (let index = 0; index < 5; index++) {
        const started = performance.now();
        const [board, responsiveHealth] = await Promise.all([
          read("?compact=1&cached=1&participants=0", AbortSignal.timeout(1000)),
          fetch(`http://127.0.0.1:${env.PORT}/health`, { signal: AbortSignal.timeout(1000) }).then(async (response) => ({
            status: response.status, value: await response.json(),
          })),
        ]);
        probes.push(Math.round((performance.now() - started) * 100) / 100);
        assert.equal(board.status, 200); assert.equal(board.value.snapshot.id, fresh.value.snapshot.id);
        assert.equal(responsiveHealth.status, 200); assert.equal(responsiveHealth.value.pid, child.pid);
        assert.equal(observationSettled, false, "Board and health must finish before the provider is released");
      }
      assert.equal(await gitCount(child), heldBefore, "Held-provider probes launch zero Git processes");
      t.diagnostic(JSON.stringify({ heldProviderBoardAndHealthMs: probes, samples: 5, timingTargetAsserted: false }));
    } finally { providerGate.release(); providerGate = null; await observation.catch(() => {}); }
    const observed = await observation;
    assert.equal(observed.status, 200); assert.equal(observed.value.status, "ok");
    assert.equal(observed.value.counts[0].participantCount, 2);
    const opened = await read("?compact=1&openedOnly=1");
    assert.equal(opened.status, 200); assert.equal(opened.value.provisional, true);
    assert.equal(opened.value.participantCounts.status, "loading");
    for (const query of ["?compact=0", "?compact=1&compact=1"]) assert.equal((await read(query)).status, 400);
    const version = expandWorktreePayload(fresh.value).features[0].versions[0];
    const guarded = await fetch(`http://127.0.0.1:${env.PORT}/api/source/items/alpha`, { headers: {
      "X-Minimap-Repo-Encoded": encodeURIComponent(root), "X-Minimap-Source-Context": JSON.stringify({ ...version.sourceContext, sourceKey: "invalid" }),
    } });
    assert.equal(guarded.status, 409);
    const changed = await fetch(`http://127.0.0.1:${env.PORT}/api/scope`, { method: "POST",
      headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({
        scopeText: "Updated generic scope.\n", expectedRevision: fresh.value.workspace.scopeRevision,
      }) });
    assert.equal(changed.status, 200, await changed.text());
    const invalidated = await read("?compact=1&cached=1&participants=0");
    assert.equal(invalidated.status, 200);
    assert.notEqual(invalidated.value.snapshot.id, fresh.value.snapshot.id);
    assert.equal(invalidated.value.workspace.scopeText, "Updated generic scope.\n");
  } finally {
    providerGate?.release();
    if (child) {
      await exec(process.execPath, [path.join(scripts, "stop-server.mjs")], { env, windowsHide: true, timeout: 15000 });
      if (child.exitCode === null) await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Owned server did not exit; retaining fixture")), 5000);
        child.once("exit", () => { clearTimeout(timer); resolve(); });
      });
    }
    if (provider.listening) await new Promise((resolve) => provider.close(resolve));
    assert.equal(path.dirname(dir), os.tmpdir()); assert.match(path.basename(dir), /^minimap-compact-http-/);
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
