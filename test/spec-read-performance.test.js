import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { attachFileSession, getFileSessionContext, getFileSessionFileContent, parseMarkdownOutline, resolveTextAnchor } from "../package/minimap/src/sessions.js";

const run = promisify(execFile);
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeSource = process.env.MINIMAP_PERFORMANCE_RUNTIME_ROOT || project;

async function fixture(t, extension = "md", text = "# Spec\n\nCurrent target.\n") {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-spec-read-"));
  t.after(async () => {
    assert.equal(path.dirname(owned), os.tmpdir());
    assert.match(path.basename(owned), /^minimap-spec-read-/);
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });
  const home = path.join(owned, "home"), target = path.join(owned, `spec.${extension}`);
  await fs.writeFile(target, text);
  const { session } = await attachFileSession(target, { minimapHome: home });
  const directory = path.join(home, "sessions", session.id);
  return { owned, home, target, session, directory };
}

test("Spec content reads its current target once without discarded collaboration work", async (t) => {
  for (const extension of ["md", "txt"]) await t.test(extension, async (child) => {
    const data = await fixture(child, extension);
    const text = "# Changed spec\n\n## Current\n\nFresh target text.\n";
    await fs.writeFile(data.target, text);
    await fs.writeFile(path.join(data.directory, "comments.jsonl"), '{"anchor":{"scope":"global"}}\n');
    await fs.writeFile(path.join(data.directory, "suggestions.jsonl"), '{"anchor":{"scope":"global"}}\n');
    const original = fs.readFile;
    const reads = [];
    try {
      fs.readFile = async (file, ...args) => { reads.push(String(file)); return original(file, ...args); };
      const result = await getFileSessionFileContent(data.target, { minimapHome: data.home });
      assert.deepEqual(Object.keys(result).sort(), ["content", "outline", "session"]);
      assert.equal(result.session.id, data.session.id);
      assert.equal(result.content, text);
      assert.equal(result.session.contentHash, `sha256:${createHash("sha256").update(text).digest("hex")}`);
      assert.equal(result.session.markdown, extension === "md");
      assert.deepEqual(result.outline, extension === "md" ? parseMarkdownOutline(text) : []);
      assert.equal(reads.filter((file) => file === data.target).length, 1);
      assert.equal(reads.filter((file) => /(?:comments|suggestions)\.jsonl$/.test(file)).length, 0);
    } finally { fs.readFile = original; }
    await fs.rm(data.target);
    await assert.rejects(getFileSessionFileContent(data.target, { minimapHome: data.home }), { code: "target_missing" });
  });
});

test("Spec context preserves resolver results and stops at a signal boundary after progress", async (t) => {
  const text = "# Spec\n\nRepeated quote.\n\n## Child\n\nRepeated quote.\n";
  const data = await fixture(t, "md", text);
  const anchors = [{ scope: "global" }, { scope: "section", headingPath: ["Spec", "Child"] },
    { scope: "text", quote: "Repeated quote." }, { scope: "text", quote: "Missing historical quote." },
    { scope: "text", quote: "Repeated quote.", lineStart: 3, lineEnd: 3 }];
  const comments = Array.from({ length: 21 }, (_, index) => ({ id: `c-${index}`, anchor: anchors[index % anchors.length] }));
  const suggestions = Array.from({ length: 13 }, (_, index) => ({ id: `s-${index}`, anchor: anchors[index % anchors.length] }));
  await fs.writeFile(path.join(data.directory, "comments.jsonl"), comments.map(JSON.stringify).join("\n") + "\n");
  await fs.writeFile(path.join(data.directory, "suggestions.jsonl"), suggestions.map(JSON.stringify).join("\n") + "\n");
  const context = await getFileSessionContext(data.target, { minimapHome: data.home });
  assert.deepEqual(context.comments, comments.map((entry) => ({ ...entry, anchorStatus: resolveTextAnchor(text, entry.anchor) })));
  assert.deepEqual(context.suggestions, suggestions.map((entry) => ({ ...entry, anchorStatus: resolveTextAnchor(text, entry.anchor) })));
  const cancelledEntries = Array.from({ length: 24 }, (_, index) => ({ id: `cancel-${index}`,
    anchor: { quote: `cancel-anchor-${index}`, lineStart: 1, lineEnd: 1 } }));
  await fs.writeFile(path.join(data.directory, "comments.jsonl"), cancelledEntries.map(JSON.stringify).join("\n") + "\n");
  await fs.writeFile(path.join(data.directory, "suggestions.jsonl"), "");
  const controller = new AbortController();
  const original = String.prototype.includes;
  let lastQuote, progress = 0;
  try {
    String.prototype.includes = function (quote, ...args) {
      if (typeof quote === "string" && quote.startsWith("cancel-anchor-") && quote !== lastQuote) {
        lastQuote = quote;
        if (++progress === 9) controller.abort(new Error("cancelled context"));
      }
      return original.call(this, quote, ...args);
    };
    await assert.rejects(getFileSessionContext(data.target, { minimapHome: data.home, signal: controller.signal }), /cancelled context/);
  } finally { String.prototype.includes = original; }
  assert.equal(progress, 16, "cancellation after progress stops at the next eight-anchor batch boundary");
});

// Instrument only the disposable child: messages originate inside anchor matching,
// after both JSONL reads, so responsiveness cannot accidentally measure file I/O.
const preload = String.raw`
import fs from "node:fs/promises";
import http from "node:http";
const originalRead = fs.readFile;
const read = new Set();
fs.readFile = async (file, ...args) => {
  const value = await originalRead(file, ...args);
  if (String(file).endsWith("comments.jsonl")) read.add("comments");
  if (String(file).endsWith("suggestions.jsonl")) read.add("suggestions");
  return value;
};
const includes = String.prototype.includes;
let lastQuote, count = 0;
const end = http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end = function (body, ...args) {
  if (this.statusCode === 200 && ["/health", "/api/workspace"].includes(this.req.url.split("?")[0])) {
    const value = JSON.parse(body);
    value.specAnchorProgress = { count, bothArraysRead: read.size === 2 };
    body = JSON.stringify(value);
  }
  return end.call(this, body, ...args);
};
String.prototype.includes = function (quote, ...args) {
  if (typeof quote === "string" && quote.startsWith("perf-spec-anchor-") && quote !== lastQuote) {
    lastQuote = quote;
    process.send?.({ type: "spec-anchor-progress", count: ++count, bothArraysRead: read.size === 2 });
  }
  return includes.call(this, quote, ...args);
};
`;

test("HTTP health and an independent workspace progress while Spec anchors are unresolved", { timeout: 30_000 }, async (t) => {
  const total = 256;
  const text = Array.from({ length: 20000 }, (_, index) => `line ${index} generic specification text`).join("\n");
  const data = await fixture(t, "md", text);
  const entries = Array.from({ length: total }, (_, index) => ({ id: `anchor-${index}`,
    anchor: { scope: "text", quote: `perf-spec-anchor-${index}`, lineStart: 20000, lineEnd: 20000 } }));
  await fs.writeFile(path.join(data.directory, "comments.jsonl"), entries.slice(0, total / 2).map(JSON.stringify).join("\n") + "\n");
  await fs.writeFile(path.join(data.directory, "suggestions.jsonl"), entries.slice(total / 2).map(JSON.stringify).join("\n") + "\n");
  const repo = path.join(data.owned, "independent");
  await fs.mkdir(path.join(repo, "roadmap/features"), { recursive: true });
  await fs.mkdir(path.join(repo, "roadmap/ideas"));
  await fs.writeFile(path.join(repo, "roadmap/board.md"), "# Now\n- item\n");
  await fs.writeFile(path.join(repo, "roadmap/scope.md"), "Independent scope.\n");
  await fs.writeFile(path.join(repo, "roadmap/features/item.md"), "---\nid: item\ntitle: Item\nstatus: queued\npriority: medium\ncommitment: committed\n---\n\n## Summary\nIndependent item.\n");
  const gitOptions = { cwd: repo, windowsHide: true };
  await run("git", ["init", "-b", "main"], gitOptions);
  await run("git", ["add", "."], gitOptions);
  await run("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture"], gitOptions);

  // Build an owned packaged runtime from source, without touching either mirror.
  const skill = path.join(data.owned, "skill"), runtime = path.join(skill, "runtime");
  await fs.cp(path.join(runtimeSource, "package/minimap/skills/minimap-roadmap/scripts"), path.join(skill, "scripts"), { recursive: true });
  await fs.mkdir(path.join(runtime, "ui"), { recursive: true });
  await fs.cp(path.join(runtimeSource, "package/minimap/src"), path.join(runtime, "src"), { recursive: true });
  for (const file of ["server.js", "package.json"]) await fs.copyFile(path.join(runtimeSource, "package/minimap", file), path.join(runtime, file));
  for (const file of ["worktree-payload.js", "appearance.js"]) {
    await fs.copyFile(path.join(runtimeSource, "package/minimap/ui", file), path.join(runtime, "ui", file));
  }
  const preloadPath = path.join(data.owned, "preload.mjs");
  await fs.writeFile(preloadPath, preload);
  const reservation = net.createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const env = { ...process.env, MINIMAP_HOME: data.home, PORT: String(port),
    MINIMAP_PALLIUM_ENDPOINT: "", MINIMAP_PALLIUM_DASHBOARD_ENDPOINT: "",
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --import=${pathToFileURL(preloadPath).href}`.trim() };
  const child = spawn(process.execPath, [path.join(skill, "scripts/start-server.cjs")], {
    cwd: data.owned, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Disposable startup timeout")), 10000);
      child.on("message", (message) => { if (message?.type === "minimap-ready") { clearTimeout(timer); resolve(); } });
      child.once("error", reject);
    });
    const base = `http://127.0.0.1:${port}`;
    assert.equal((await (await fetch(`${base}/health`)).json()).pid, child.pid);
    const headers = { "X-Minimap-Repo-Encoded": encodeURIComponent(repo) };
    const primed = await fetch(`${base}/api/workspace`, { headers });
    assert.equal(primed.status, 200);
    const primedWorkspace = await primed.json();
    let firstProgress;
    const started = new Promise((resolve) => {
      child.on("message", (message) => {
        if (message?.type !== "spec-anchor-progress") return;
        if (!firstProgress) { firstProgress = message; resolve(); }
      });
    });
    const begin = performance.now();
    const contextRequest = fetch(`${base}/api/spec-sessions/by-file/context?path=${encodeURIComponent(data.target)}`, { signal: AbortSignal.timeout(10000) })
      .then(async (response) => ({ status: response.status, value: await response.json(), ms: performance.now() - begin }));
    await Promise.race([started, contextRequest.then(() => { throw new Error("Context completed before CPU-phase instrumentation"); })]);
    const probe = async (route, headers = {}) => {
      const start = performance.now();
      const response = await fetch(`${base}${route}`, { headers, signal: AbortSignal.timeout(10000) });
      const value = await response.json();
      return { status: response.status, processed: value.specAnchorProgress.count, ms: Math.round(performance.now() - start), value };
    };
    const [health, workspace, context] = await Promise.all([
      probe("/health"), probe("/api/workspace?cached=1", headers), contextRequest,
    ]);
    t.diagnostic(JSON.stringify({ anchors: total, textBytes: Buffer.byteLength(text), bothArraysRead: firstProgress.bothArraysRead,
      contextMs: Math.round(context.ms), healthMs: health.ms, healthAtAnchor: health.processed,
      workspaceMs: workspace.ms, workspaceAtAnchor: workspace.processed }));
    assert.equal(context.status, 200);
    assert.equal(health.status, 200);
    assert.equal(workspace.status, 200);
    assert.ok(workspace.value.items.item);
    assert.equal(workspace.value.snapshot.id, primedWorkspace.snapshot.id, "the independent request must reuse its ready snapshot");
    assert.ok(health.processed < total, "health must finish during anchor processing");
    assert.ok(workspace.processed < total, "independent workspace must finish during anchor processing");
    assert.equal(firstProgress.bothArraysRead, true, "both arrays must be captured before resolving anchors");
    assert.deepEqual([...context.value.comments, ...context.value.suggestions].map((entry) => entry.id), entries.map((entry) => entry.id));
    assert.ok([...context.value.comments, ...context.value.suggestions].every((entry) => entry.anchorStatus.status === "orphaned"));
  } finally {
    if (child.exitCode === null) {
      await run(process.execPath, [path.join(skill, "scripts/stop-server.mjs")], { env, windowsHide: true, timeout: 10000 });
      if (child.exitCode === null) await new Promise((resolve) => child.once("exit", resolve));
    }
  }
});
