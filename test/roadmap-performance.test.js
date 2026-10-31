import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveRoadmapItemReference } from "../package/minimap/src/pallium.js";

// Routine CI skips this qualification. Run it alone after mirrors are ready:
// MINIMAP_RUN_PERFORMANCE=1 node --test test/roadmap-performance.test.js
// Smoke: additionally select MINIMAP_PERFORMANCE_SOURCES=1,
// MINIMAP_PERFORMANCE_ITEMS=100 and MINIMAP_PERFORMANCE_SAMPLES=1.
// MINIMAP_PERFORMANCE_WARM_SAMPLES=5 repeats cheap cached reads after each
// full scan without multiplying cold scans or concurrent project waves.
// MINIMAP_PERFORMANCE_DIAGNOSTICS=1 additionally observes server JSON sizes
// and admission hashes; leave it off for ordinary latency comparisons.
// Baseline: MINIMAP_PERFORMANCE_RUNTIME_ROOT=<owned archive root> and
// MINIMAP_PERFORMANCE_LEGACY=1 use only supported legacy fresh-read routes.
// Timings include HTTP transfer/JSON parsing, not browser rendering. The first
// validation is cold at the snapshot layer; subsequent ones force revalidation.
// p95 uses nearest rank and reports its sample count; 200 ms is a target, not a
// universal assertion. Slow-provider/abort semantics have deterministic suites.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = process.env.MINIMAP_PERFORMANCE_RUNTIME_ROOT
  ? path.resolve(process.env.MINIMAP_PERFORMANCE_RUNTIME_ROOT) : projectRoot;
const scripts = path.join(runtimeRoot, "package/minimap/skills/minimap-roadmap/scripts");
// Archives from before the bootstrap remain usable for matched baselines.
const launcherName = await fs.access(path.join(scripts, "start-server.cjs"))
  .then(() => "start-server.cjs", () => "start-server.mjs");
const enabled = process.env.MINIMAP_RUN_PERFORMANCE === "1";
const legacy = process.env.MINIMAP_PERFORMANCE_LEGACY === "1";
const warmSamples = Number(process.env.MINIMAP_PERFORMANCE_WARM_SAMPLES || 1);
const workRecordCount = Number(process.env.MINIMAP_PERFORMANCE_WORK_RECORDS || 0);
// Exercise status proof rather than only identical-HEAD fast paths (4 x 100 is a bounded cell).
const statusHistory = process.env.MINIMAP_PERFORMANCE_STATUS_HISTORY === "1";
// Generated only inside the disposable fixture. IPC is available solely to the
// owning test parent; no production diagnostic route or installed preload.
export const performancePreload = String.raw`
import childProcess from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import workerThreads from "node:worker_threads";
import { syncBuiltinESMExports, createRequire } from "node:module";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
const isGitThread = !workerThreads.isMainThread && workerThreads.workerData?.minimapGitRead === true;
if (isGitThread || ["start-server.cjs", "start-server.mjs"].includes(path.basename(process.argv[1] || "")) && process.send) {
  const poolAtPreload = process.env.UV_THREADPOOL_SIZE ?? null;
  const counters = { gitExecFile: 0, gitSpawn: 0, gitExecFileSync: 0,
    fileReadAsync: 0, fileReadCallback: 0, fileReadSync: 0 };
  const gitCommands = {};
  const worktreeScans = {};
  const ioTimings = {};
  const collectWorkers = createRequire(process.cwd() + "/minimap-test-preload.cjs")(process.env.MINIMAP_TEST_WORKER_METRICS)(
    () => ({ counters: { ...counters }, gitCommands: { ...gitCommands }, worktreeScans: { ...worktreeScans } }));
  const serializations = [];
  let memoryPeak = { ...process.memoryUsage() };
  const memoryTimer = setInterval(() => {
    const current = process.memoryUsage();
    for (const key of Object.keys(current)) memoryPeak[key] = Math.max(memoryPeak[key] || 0, current[key]);
  }, 50);
  memoryTimer.unref();
  const stringify = JSON.stringify;
  if (process.env.MINIMAP_PERFORMANCE_DIAGNOSTICS === "1") JSON.stringify = function (value, ...args) {
    const result = stringify(value, ...args);
    let kind = null;
    if (value?.features && value?.coverage && value?.sources) kind = value.snapshot ? "aggregate-response" : "aggregate-value";
    else if (value?.openedRepo && value?.observation) kind = "snapshot-manifest";
    else if (value?.evidence || Array.isArray(value) && value[0]?.evidence) kind = "snapshot-admission";
    else if (value?.bindingRoot && Object.hasOwn(value, "gitRoot")) kind = "admission-evidence";
    if (kind && serializations.length < 512) serializations.push({ kind, bytes: Buffer.byteLength(result),
      features: value.features?.length, sources: value.sources?.length,
      evidenceHash: kind === "admission-evidence" ? createHash("sha256").update(result).digest("hex") : undefined });
    return result;
  };
  const countGit = (kind, file, args, options) => {
    if (path.basename(String(file)).toLowerCase().replace(/\.exe$/, "") !== "git") return;
    counters[kind]++;
    const command = args?.[0] || "(none)";
    gitCommands[command] = (gitCommands[command] || 0) + 1;
    if (args?.[0] === "worktree" && args?.[1] === "list" && options?.cwd) {
      const root = path.resolve(options.cwd).toLowerCase();
      worktreeScans[root] = (worktreeScans[root] || 0) + 1;
    }
  };
  const exec = childProcess.execFile;
  function observedExecFile(file, args, ...rest) {
    countGit("gitExecFile", file, args, rest[0]);
    return exec(file, args, ...rest);
  }
  observedExecFile[promisify.custom] = (...args) => new Promise((resolve, reject) => {
    observedExecFile(...args, (error, stdout, stderr) => {
      if (error) { error.stdout = stdout; error.stderr = stderr; reject(error); }
      else resolve({ stdout, stderr });
    });
  });
  childProcess.execFile = observedExecFile;
  for (const [method, kind] of [["spawn", "gitSpawn"], ["execFileSync", "gitExecFileSync"]]) {
    const original = childProcess[method];
    childProcess[method] = (file, args, ...rest) => {
      countGit(kind, file, args, rest[0]); return original(file, args, ...rest);
    };
  }
  const readAsync = fsp.readFile, readCallback = fs.readFile, readSync = fs.readFileSync;
  fsp.readFile = (...args) => { counters.fileReadAsync++; return readAsync(...args); };
  fs.readFile = (...args) => { counters.fileReadCallback++; return readCallback(...args); };
  fs.readFileSync = (...args) => { counters.fileReadSync++; return readSync(...args); };
  if (!isGitThread) for (const method of ["readFile", "stat", "lstat", "realpath", "readdir"]) {
    const original = fsp[method];
    const timing = ioTimings[method] = { count: 0, totalMs: 0 };
    fsp[method] = async (...args) => {
      const start = performance.now();
      try { return await original(...args); }
      finally { timing.count++; timing.totalMs += performance.now() - start; }
    };
  }
  syncBuiltinESMExports();
  const histogram = monitorEventLoopDelay({ resolution: 10 });
  histogram.enable();
  if (!isGitThread) process.on("message", async (message) => {
    if (message?.type !== "minimap-performance-snapshot") return;
    const workers = await collectWorkers();
    const merged = (key) => {
      const value = { ...({ counters, gitCommands, worktreeScans }[key]) };
      for (const worker of workers) for (const [name, count] of Object.entries(worker[key])) value[name] = (value[name] || 0) + count;
      return value;
    };
    const count = Number(histogram.count);
    const ms = (value) => count ? Math.round(value / 10000) / 100 : null;
    process.send({ type: "minimap-performance-metrics", id: message.id, pid: process.pid, serializations: serializations.splice(0),
      poolAtPreload, childNode: process.version, poolEnvironment: process.env.UV_THREADPOOL_SIZE ?? null,
      memoryCurrent: process.memoryUsage(), memoryPeak,
      counters: merged("counters"), gitCommands: merged("gitCommands"), worktreeScans: merged("worktreeScans"),
      ioTimings,
      eventLoopDelay: { samples: count, resolutionMs: 10, p50Ms: ms(histogram.percentile(50)),
        p95Ms: ms(histogram.percentile(95)), maxMs: ms(histogram.max), meanMs: ms(histogram.mean) } });
    if (message.reset) { histogram.reset(); memoryPeak = { ...process.memoryUsage() }; }
  });
}
`;
const git = (cwd, ...args) => execFileSync("git", args, {
  cwd, windowsHide: true, encoding: "utf8", stdio: "pipe", timeout: 15000,
}).trim();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function selection(name, allowed) {
  const values = process.env[name] ? process.env[name].split(",").map(Number) : allowed;
  assert.ok(values.length && values.every((value) => allowed.includes(value)), `Invalid ${name}`);
  return [...new Set(values)];
}

function statistics(records, targetMs = null) {
  const timings = records.filter((record) => record.status === 200).map((record) => record.ms).sort((a, b) => a - b);
  const rank = (p) => timings.length ? timings[Math.ceil(timings.length * p) - 1] : null;
  return { samples: records.length, successful: timings.length, p50Ms: rank(0.5), p95Ms: timings.length < 5 ? null : rank(0.95),
    percentileEvidence: timings.length < 5 ? "Insufficient samples for a credible p95 claim; raw calibration only" : "Empirical nearest-rank percentile, not a universal guarantee",
    maxMs: timings.at(-1) ?? null, targetMs, targetMet: targetMs === null || timings.length < 5 ? null : rank(0.95) < targetMs,
    errors: records.filter((record) => record.status !== 200) };
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function fixture(owned, name, sources, count) {
  const root = path.join(owned, name, "main");
  await fs.mkdir(path.join(root, "roadmap/features"), { recursive: true });
  await fs.mkdir(path.join(root, "roadmap/ideas"));
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.invalid");
  git(root, "config", "core.autocrlf", "false");
  git(root, "remote", "add", "origin", `https://github.com/example/${name}-performance.git`);
  const ids = Array.from({ length: count }, (_, i) => `item-${String(i).padStart(4, "0")}`);
  await fs.writeFile(path.join(root, "roadmap/board.md"), `# Now\n${ids.map((id) => `- ${id}`).join("\n")}\n`);
  await fs.writeFile(path.join(root, "roadmap/scope.md"), "Generic qualification scope.\n");
  await fs.writeFile(path.join(root, "roadmap/ideas/.keep"), "");
  for (const id of ids) {
    await fs.writeFile(path.join(root, "roadmap/features", `${id}.md`),
      `---\nid: ${id}\ntitle: ${id}\nstatus: queued\npriority: medium\ncommitment: committed\n---\n\n## Summary\nGeneric ${id} body.\n`);
  }
  git(root, "add", "."); git(root, "commit", "-m", "generic fixture");
  for (let i = 1; i < sources; i++) {
    git(root, "worktree", "add", "-b", `feature/source-${i}`, path.join(owned, name, `source-${i}`));
  }
  if (statusHistory && sources > 1) {
    for (const id of ids.filter((_, index) => index % 2 === 0)) {
      const file = path.join(root, "roadmap/features", `${id}.md`);
      await fs.writeFile(file, (await fs.readFile(file, "utf8")).replace("status: queued", "status: done"));
    }
    git(root, "add", "."); git(root, "commit", "-m", "complete fixture features");
    for (let index = 1; index < sources; index += 1) {
      const sibling = path.join(owned, name, `source-${index}`);
      await fs.writeFile(path.join(sibling, `unrelated-${index}.txt`), "Unrelated branch work.\n");
      git(sibling, "add", "."); git(sibling, "commit", "-m", "advance unrelated branch");
    }
  }
  return root;
}

async function seedWorkRecords(repoRoot, count) {
  const directory = path.join(repoRoot, ".agent-workflow", "tasks");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(repoRoot, "agent-workflow.yaml"), [
    "version: 1", "workRecord:", "  backend: local", "  local:",
    "    taskPath: .agent-workflow/tasks/{slug}.md", "",
  ].join("\n"));
  const relationship = await resolveRoadmapItemReference(repoRoot, "roadmap", "item-0000");
  assert.ok(relationship?.scope_ref && relationship?.local_ref, "Fixture must use the authoritative source-reference helper");
  const sharedFixture = JSON.parse(await fs.readFile(path.join(projectRoot, "test/work-record/fixtures/relationships.json"), "utf8"));
  for (let index = 0; index < count; index += 1) {
    const slug = `fixture-${String(index).padStart(4, "0")}`;
    const outcome = `Synthetic performance record ${index}`;
    const relationshipJson = JSON.stringify({ schema_version: 1,
      sources: [{ provider: "minimap", scope_ref: relationship.scope_ref, local_ref: relationship.local_ref }],
      pull_requests: [`https://github.com/example/project-a-performance/pull/${index + 1}`] });
    const content = sharedFixture.record_template.replace("Fixture Work Record", outcome)
      .replace("__RELATIONSHIPS__", `**Relationships:**\n${relationshipJson}`);
    await fs.writeFile(path.join(directory, `${slug}.md`), content);
  }
}

async function start(root, env) {
  const child = spawn(process.execPath, [path.join(scripts, launcherName)], {
    cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  const ready = new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`Disposable server startup timed out: ${output}`)), 20000);
    const collect = (chunk) => {
      output += chunk;
      if (output.includes(`Minimap running at http://localhost:${env.PORT}`)) { clearTimeout(timer); resolve(); }
    };
    child.stdout.on("data", collect); child.stderr.on("data", collect);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Disposable launcher exited ${code}: ${output}`)); });
  });
  return { child, ready };
}

let metricRequest = 0;
async function serverMetrics(child, reset = false) {
  const id = ++metricRequest;
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); child.off("message", onMessage); };
    const onMessage = (message) => {
      if (message?.type !== "minimap-performance-metrics" || message.id !== id) return;
      cleanup(); resolve(message);
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error("Disposable server metrics timed out")); }, 5000);
    child.on("message", onMessage);
    child.send({ type: "minimap-performance-snapshot", id, reset }, (error) => {
      if (error) { cleanup(); reject(error); }
    });
  });
}

async function stopAndRemove(child, env, owned) {
  try {
    if (child?.pid && child.exitCode === null) {
      const registry = JSON.parse(await fs.readFile(path.join(env.MINIMAP_HOME, "server.json"), "utf8"));
      assert.equal(registry.pid, child.pid, "Refuse to stop a server not launched by this fixture");
      execFileSync(process.execPath, [path.join(scripts, "stop-server.mjs")], {
        env, windowsHide: true, timeout: 15000, stdio: "pipe",
      });
      if (child.exitCode === null) {
        let timer;
        const exited = await Promise.race([
          new Promise((resolve) => child.once("exit", () => resolve(true))),
          new Promise((resolve) => { timer = setTimeout(() => resolve(false), 10000); }),
        ]);
        clearTimeout(timer);
        assert.equal(exited, true, "Packaged stop did not exit the disposable server; fixture retained");
      }
    }
  } finally {
    assert.equal(path.dirname(owned), os.tmpdir());
    assert.match(path.basename(owned), /^minimap-roadmap-performance-/);
    if (!child?.pid || child.exitCode !== null) await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

async function qualify(sources, items, samples, signal, recordCount = 0) {
  const qualifyColdFairness = !legacy && sources === 25 && (items === 1000 || statusHistory);
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-roadmap-performance-"));
  let child;
  const env = { ...process.env, MINIMAP_HOME: path.join(owned, "home"),
    MINIMAP_PALLIUM_ENDPOINT: "", MINIMAP_PALLIUM_DASHBOARD_ENDPOINT: "",
    MINIMAP_PALLIUM_SETTINGS_PATH: path.join(owned, "empty-settings.json"), PORT: String(await freePort()) };
  await fs.writeFile(env.MINIMAP_PALLIUM_SETTINGS_PATH, "{}");
  await fs.mkdir(env.MINIMAP_HOME);
  env.MINIMAP_TEST_WORKER_METRICS = path.join(projectRoot, "scripts/test-fixtures/worker-metrics.cjs");
  // Synchronous CommonJS preload avoids initializing libuv via ESM loading
  // before the canonical bootstrap sets its absent-only default.
  const preload = path.join(env.MINIMAP_HOME, "performance-preload.cjs");
  const commonjsPreload = performancePreload
    .replace(/import (\w+) from "([^"]+)";/g, 'const $1 = require("$2");')
    .replace(/import \{ ([^}]+) \} from "([^"]+)";/g, 'const { $1 } = require("$2");');
  assert.ok(!commonjsPreload.includes("import "), "Performance preload must not invoke ESM before bootstrap");
  await fs.writeFile(preload, commonjsPreload);
  env.NODE_OPTIONS = `${env.NODE_OPTIONS || ""} --require="${preload.split(path.sep).join("/")}"`;
  const measurements = { firstUsable: [], fullSnapshot: [], warmAcross: [], healthDuringScan: [],
    warmOtherProjectDuringScan: [], openedProvisional: [], sameProjectTabs: [], independentProjects: [],
    ...(qualifyColdFairness ? { coldThirdProjectDuringIndependentScans: [] } : {}),
    ...(recordCount ? { featureDetailDuringScan: [], featureDetailWarm: [], relatedCold: [], relatedWarm: [], relatedUnchangedRefresh: [], relatedShared: [], relatedOneEdit: [], healthDuringRelated: [], featureDetailDuringRelated: [] } : {}) };
  const serverScenarios = [];
  const observe = async (scenario, sample, work) => {
    const before = await serverMetrics(child, true);
    const begin = performance.now();
    try { return await work(); }
    finally {
      const after = await serverMetrics(child);
      assert.equal(after.pid, child.pid);
      assert.equal(after.poolAtPreload, env.UV_THREADPOOL_SIZE ?? null);
      assert.equal(after.poolEnvironment, env.UV_THREADPOOL_SIZE ?? (launcherName === "start-server.cjs" ? "8" : null));
      serverScenarios.push({ scenario, sample, durationMs: Math.round(performance.now() - begin),
        countersBefore: before.counters, countersAfter: after.counters,
        counters: Object.fromEntries(Object.keys(after.counters).map((key) => [key, after.counters[key] - before.counters[key]])),
        gitCommands: Object.fromEntries(Object.keys(after.gitCommands).map((key) => [key, after.gitCommands[key] - (before.gitCommands[key] || 0)])),
        ioTimings: Object.fromEntries(Object.entries(after.ioTimings || {}).map(([key, value]) => [key, {
          count: value.count - (before.ioTimings?.[key]?.count || 0),
          totalMs: Math.round((value.totalMs - (before.ioTimings?.[key]?.totalMs || 0)) * 100) / 100,
        }])),
        ioTimingMeaning: "HTTP-thread cumulative async operation time; overlapping waits are not exclusive CPU time",
        eventLoopDelay: after.eventLoopDelay, poolAtPreload: after.poolAtPreload,
        childNode: after.childNode, poolEnvironment: after.poolEnvironment,
        memoryBefore: before.memoryCurrent, memoryAfter: after.memoryCurrent, memoryPeak: after.memoryPeak });
      serverScenarios.at(-1).serializations = after.serializations;
    }
  };
  let httpRequests = 0;
  const read = async (route, root) => {
    httpRequests++;
    const begin = performance.now();
    try {
      const response = await fetch(`http://127.0.0.1:${env.PORT}${route}`, {
        headers: root ? { "X-Minimap-Repo-Encoded": encodeURIComponent(root) } : {},
        signal: AbortSignal.any([signal, AbortSignal.timeout(legacy ? 120000
          : route.startsWith("/api/worktree-workspace") && !route.includes("openedOnly=1") ? 65000 : 35000)]),
      });
      const responseText = await response.text();
      const responseBytes = Buffer.byteLength(responseText);
      const body = JSON.parse(responseText);
      return { status: response.status, ms: Math.round((performance.now() - begin) * 100) / 100,
        responseBytes, startedAtMs: begin, finishedAtMs: performance.now(),
        snapshot: body.snapshot, loaded: body.coverage?.loaded, features: body.features?.length,
        versions: body.features?.reduce((sum, feature) => sum + (feature.versions?.length || 0), 0),
        supersededStatuses: body.features?.reduce((sum, feature) => sum + feature.versions.filter((version) => version.statusSupersededBy?.length).length, 0),
        partial: body.partial, identityUncertain: body.coverage?.identityUncertain?.map((entry) => entry.reason),
        generation: body.generation, total: body.total, nextOffset: body.nextOffset,
        relatedRecords: body.records?.length, relatedStatus: body.status, firstRelatedTitle: body.records?.[0]?.title,
        relatedBodyReads: body.coverage?.bodyReads, relatedEnumerations: body.coverage?.enumerations,
        pid: body.pid, runtime: body.runtime, code: body.code, error: response.ok ? undefined : body.error };
    } catch (error) {
      return { status: 0, ms: Math.round((performance.now() - begin) * 100) / 100,
        startedAtMs: begin, finishedAtMs: performance.now(), error: error.message };
    }
  };
  const full = legacy ? "/api/worktree-workspace" : "/api/worktree-workspace?participants=0&compact=1";
  const featureDetail = "/api/items/item-0000";
  const openedRoute = legacy ? `${full}?openedOnly=1` : `${full}&openedOnly=1`;
  const repeatedRoute = legacy ? full : `${full}&cached=1`;
  const otherRoute = legacy ? "/api/workspace" : "/api/workspace?cached=1";
  const requireSuccessful = (records, scenario) => assert.ok(records.every((record) => record.status === 200),
    `${scenario} failed: ${JSON.stringify(records.filter((record) => record.status !== 200))}`);
  const resultReport = () => ({ sources, itemsPerSource: items, samples, workRecordCount: recordCount, statusHistory, mode: legacy ? "legacy-fresh" : "snapshot", httpRequests,
    summary: Object.fromEntries(Object.entries(measurements).map(([key, records]) => [key,
      statistics(records, ["warmAcross", "healthDuringScan", "warmOtherProjectDuringScan", "featureDetailDuringScan", "featureDetailWarm", "retainedIndependentProjects"].includes(key) ? 200 : null)])),
    measurementLabels: { warmAcross: legacy ? "Repeated fresh Across read (no cache)" : "Warm cached Across read",
      warmOtherProjectDuringScan: legacy ? "Fresh This read of other project during scan" : "Warm cached This read of other project during scan" },
    measurements, serverScenarios,
    serverGitCalls: serverScenarios.reduce((sum, row) => sum + row.counters.gitExecFile + row.counters.gitSpawn + row.counters.gitExecFileSync, 0),
    serverFileReadCalls: serverScenarios.reduce((sum, row) => sum + row.counters.fileReadAsync + row.counters.fileReadCallback + row.counters.fileReadSync, 0),
    limits: "HTTP first usable excludes browser paint. Existing identity caps may retain separate features and partial coverage. OS caches are not flushed. Preload instrumentation adds overhead. File counts measure wrapped readFile/readFileSync calls, not all filesystem syscalls; Git counts measure wrapped execFile/spawn/execFileSync launches. Event-loop delay is measured inside the actual server process, with its histogram reset between named scenarios; mixed scan/probe scenarios are not attributed to individual requests." });
  try {
    const a = await fixture(owned, "project-a", sources, items);
    if (recordCount) await seedWorkRecords(a, recordCount);
    const b = await fixture(owned, "project-b", sources, items);
    const launched = await start(a, env); child = launched.child; await launched.ready;
    const health = await read("/health");
    assert.equal(health.pid, child.pid, "Disposable startup must not reuse another server");
    assert.equal(health.status, 200);
    assert.equal(path.resolve(health.runtime.sourcePath), path.join(runtimeRoot, "package/minimap/skills/minimap-roadmap/runtime/server.js"));
    // Prime a This snapshot for the independent project. Its cached admission is
    // measured while Across scans A; no provider query or extra scan is implied.
    const otherPrime = await observe("prime-other-project-this", 0, () => read(otherRoute, b));
    assert.equal(otherPrime.status, 200);
    if (!legacy) assert.ok(otherPrime.snapshot?.id);
    for (let n = 0; n < samples; n++) {
      signal.throwIfAborted();
      const fullResult = await observe("opened-and-full-with-health-and-warm-other-project", n, async () => {
        const begin = performance.now();
        let finished = false;
        const opened = read(openedRoute, a);
        const across = read(full, a).finally(() => { finished = true; });
        const probe = async (route, root, destination, maxSamples, interval, expectedSnapshot = null) => {
          for (let i = 0; !finished && i < maxSamples; i++) {
            const record = await read(route, root);
            if (expectedSnapshot) record.snapshotReused = record.snapshot?.id === expectedSnapshot;
            destination.push(record);
            if (!finished) await delay(interval);
          }
        };
        const probes = Promise.all([
          probe("/health", null, measurements.healthDuringScan, 480, 250),
          probe(otherRoute, b, measurements.warmOtherProjectDuringScan, 240, 500, otherPrime.snapshot?.id),
          ...(recordCount ? [probe(featureDetail, a, measurements.featureDetailDuringScan, 480, 250)] : []),
        ]);
        const usable = await Promise.any([opened, across].map((pending) => pending.then((result) => {
          if (result.status !== 200) throw result;
          return { ...result, ms: Math.round((performance.now() - begin) * 100) / 100, coldSnapshot: n === 0 };
        }))).catch(() => ({ status: 0, ms: null, error: "No usable opened/full snapshot" }));
        measurements.firstUsable.push(usable);
        const fullResult = await across;
        measurements.fullSnapshot.push({ ...fullResult, coldSnapshot: n === 0 });
        const openedResult = await opened; await probes;
        measurements.openedProvisional.push(openedResult);
        requireSuccessful([openedResult, fullResult, ...measurements.healthDuringScan,
          ...measurements.warmOtherProjectDuringScan], "Opened/full scan and concurrent probes");
        if (!legacy) {
          assert.ok(fullResult.snapshot?.id);
          assert.equal(fullResult.loaded, sources);
          assert.equal(fullResult.versions, sources * items, "Every source version must survive projection");
          assert.equal(fullResult.features, items > 500 && sources > 1 ? sources * items : items);
          if (items > 500 && sources > 1) {
            assert.equal(fullResult.partial, true);
            assert.equal(fullResult.identityUncertain.length, sources * (sources - 1) / 2);
            assert.ok(fullResult.identityUncertain.every((reason) => reason === "ancestor-item-limit"));
          }
        }
        return fullResult;
      });
      for (let warmIndex = 0; warmIndex < warmSamples; warmIndex++) {
        const warm = await observe(legacy ? "repeated-fresh-across" : "warm-across", n * warmSamples + warmIndex, () => read(repeatedRoute, a));
        measurements.warmAcross.push({ ...warm,
          readPolicy: legacy ? "fresh after initial read; cache unavailable" : "cached requested",
          snapshotReused: legacy ? null : Boolean(fullResult.snapshot?.id && warm.snapshot?.id === fullResult.snapshot.id) });
        requireSuccessful([warm], "Repeated Across read");
        if (!legacy) {
          assert.equal(warm.snapshot?.id, fullResult.snapshot.id, "Warm request must reuse the retained snapshot");
          const counts = serverScenarios.at(-1).counters;
          assert.equal(counts.gitExecFile + counts.gitSpawn + counts.gitExecFileSync, 0, "Warm read must launch zero Git processes");
        }
      }
    }
    if (recordCount) {
      const relatedRoute = "/api/items/item-0000/related-work";
      const cold = await observe("related-work-cold-with-health-and-detail", 0, async () => {
        const results = await Promise.all([
          read(`${relatedRoute}?fresh=1`, a), read("/health"), read(featureDetail, a),
        ]);
        measurements.healthDuringRelated.push(results[1]);
        measurements.featureDetailDuringRelated.push(results[2]);
        requireSuccessful(results, "Cold related-work scan and concurrent probes");
        return results[0];
      });
      measurements.relatedCold.push(cold);
      assert.equal(cold.relatedRecords, 20);
      assert.equal(cold.total, recordCount);
      assert.equal(cold.relatedStatus, "ok");
      assert.equal(cold.relatedBodyReads, recordCount);
      for (let sample = 0; sample < Math.max(warmSamples, 5); sample += 1) {
        const warm = await observe("related-work-warm", sample, () => read(relatedRoute, a));
        measurements.relatedWarm.push(warm);
        requireSuccessful([warm], "Warm related-work read");
        assert.equal(warm.generation, cold.generation);
        assert.equal(warm.relatedBodyReads, recordCount, "Retained generation reports its original scan counters");
      }
      const unchanged = await observe("related-work-unchanged-refresh", 0, () => read(`${relatedRoute}?fresh=1`, a));
      measurements.relatedUnchangedRefresh.push(unchanged);
      requireSuccessful([unchanged], "Unchanged related-work validation");
      assert.equal(unchanged.relatedBodyReads, 0);
      assert.equal(unchanged.relatedEnumerations, 1);
      const shared = await observe("related-work-four-subscribers", 0,
        () => Promise.all(Array.from({ length: 4 }, () => read(`${relatedRoute}?fresh=1`, a))));
      measurements.relatedShared.push(...shared);
      requireSuccessful(shared, "Four same-scope related-work subscribers");
      assert.equal(new Set(shared.map((entry) => entry.generation)).size, 1, "Concurrent subscribers must share one generation");
      assert.ok(shared.every((entry) => entry.relatedBodyReads === 0));
      const changedFile = path.join(a, ".agent-workflow", "tasks", "fixture-0000.md");
      await fs.writeFile(changedFile, (await fs.readFile(changedFile, "utf8")).replaceAll("Synthetic performance record 0", "Edited performance record 0"));
      const edited = await observe("related-work-one-edit", 0, () => read(`${relatedRoute}?fresh=1`, a));
      measurements.relatedOneEdit.push(edited);
      requireSuccessful([edited], "One-record related-work refresh");
      assert.equal(edited.total, recordCount);
      assert.equal(edited.firstRelatedTitle, "Edited performance record 0");
      assert.equal(edited.relatedBodyReads, 1);
      const configFile = path.join(a, "agent-workflow.yaml");
      for (let sample = 1; sample < 5; sample += 1) {
        await fs.appendFile(configFile, `# cold sample ${sample}\n`);
        const fresh = await observe("related-work-cold", sample, () => read(`${relatedRoute}?fresh=1`, a));
        measurements.relatedCold.push(fresh);
        requireSuccessful([fresh], "Cold related-work reconfiguration");
        assert.equal(fresh.total, recordCount);
        assert.equal(fresh.relatedBodyReads, recordCount);
        const nextTitle = `Edited performance record 0 sample ${sample}`;
        await fs.writeFile(changedFile, (await fs.readFile(changedFile, "utf8")).replace(/^# .+$/m, `# ${nextTitle}`));
        const incremental = await observe("related-work-one-edit", sample, () => read(`${relatedRoute}?fresh=1`, a));
        measurements.relatedOneEdit.push(incremental);
        requireSuccessful([incremental], "One-record related-work refresh");
        assert.equal(incremental.total, recordCount);
        assert.equal(incremental.firstRelatedTitle, nextTitle);
        assert.equal(incremental.relatedBodyReads, 1);
      }
      for (let sample = 0; sample < Math.max(warmSamples, 5); sample += 1) {
        const detail = await observe("feature-detail-warm", sample, () => read(featureDetail, a));
        measurements.featureDetailWarm.push(detail);
        requireSuccessful([detail], "Feature detail during Work Record corpus qualification");
      }
    }
    for (let n = 0; n < samples; n++) {
      signal.throwIfAborted();
      const tabs = await observe("four-same-project-tabs", n,
        () => Promise.all(Array.from({ length: 4 }, () => read(full, a))));
      measurements.sameProjectTabs.push(...tabs);
      requireSuccessful(tabs, "Four same-project tabs");
      if (!legacy) assert.equal(new Set(tabs.map((record) => record.snapshot?.id)).size, 1,
        "Same-project tabs must coalesce into one published snapshot");
      // Record shared snapshot IDs as evidence; deterministic coalescing tests
      // separately validate exact scan counts and cancellation ownership.
      const coldThird = qualifyColdFairness ? await fixture(owned, `cold-project-${n}`, 1, 1) : null;
      const projects = await observe("two-independent-projects", n, async () => {
        const before = qualifyColdFairness ? await serverMetrics(child) : null;
        let finishedCount = 0;
        const pending = [a, b].map((root) => read(full, root).finally(() => { finishedCount++; }));
        if (!qualifyColdFairness) return Promise.all(pending);
        const probe = async (route, root, destination, interval) => {
          while (finishedCount < 2) {
            const record = await read(route, root);
            destination.push(record);
            if (finishedCount < 2) await delay(interval);
          }
        };
        const probes = Promise.all([
          probe("/health", null, measurements.healthDuringScan, 250),
          probe(otherRoute, b, measurements.warmOtherProjectDuringScan, 500),
        ]);
        const roots = [a, b].map((root) => path.resolve(root).toLowerCase());
        const readinessStart = performance.now();
        let bothStarted = false;
        while (!finishedCount && performance.now() - readinessStart < 5000) {
          const current = await serverMetrics(child);
          bothStarted = roots.every((root) => (current.worktreeScans[root] || 0) > (before.worktreeScans[root] || 0));
          if (bothStarted) break;
          await delay(25);
        }
        const acrossFinishedAtStart = finishedCount;
        const cold = await read("/api/workspace", coldThird);
        cold.bothAcrossStartedBeforeRequest = bothStarted;
        cold.acrossFinishedAtStart = acrossFinishedAtStart;
        measurements.coldThirdProjectDuringIndependentScans.push(cold);
        const results = await Promise.all(pending); await probes;
        measurements.independentProjects.push(...results);
        cold.completedBeforeBothAcross = results.every((record) => cold.finishedAtMs < record.finishedAtMs);
        requireSuccessful([cold], "Cold third project during two active Across scans");
        assert.equal(bothStarted, true, "Both Across scans must reach discovery before the cold request starts");
        assert.equal(cold.acrossFinishedAtStart, 0, "Neither Across scan may finish before the cold request starts");
        assert.equal(cold.completedBeforeBothAcross, true, "Cold This request must complete before either Across scan");
        for (const record of results) {
          assert.ok(record.snapshot?.id);
          assert.equal(record.loaded, sources);
          assert.equal(record.versions, sources * items);
          if (items > 500) {
            assert.equal(record.features, sources * items);
            assert.equal(record.partial, true);
            assert.equal(record.identityUncertain?.length, sources * (sources - 1) / 2);
            assert.ok(record.identityUncertain.every((reason) => reason === "ancestor-item-limit"));
          } else {
            assert.equal(record.features, items);
            assert.equal(record.partial, false);
            if (runtimeRoot === projectRoot) assert.equal(record.supersededStatuses, Math.ceil(items / 2) * (sources - 1));
            assert.deepEqual(record.identityUncertain, []);
          }
        }
        return results;
      });
      if (!qualifyColdFairness) measurements.independentProjects.push(...projects);
      requireSuccessful(projects, "Two independent projects");
      if (!legacy) {
        const retained = await observe("two-independent-retained-projects", n,
          () => Promise.all([read(repeatedRoute, a), read(repeatedRoute, b)]));
        measurements.retainedIndependentProjects ||= [];
        measurements.retainedIndependentProjects.push(...retained.map((record, index) => ({
          ...record, snapshotReused: record.snapshot?.id === projects[index].snapshot?.id,
        })));
        requireSuccessful(retained, "Both independent snapshots retained together");
        assert.ok(retained.every((record, index) => record.snapshot?.id === projects[index].snapshot?.id));
        const counts = serverScenarios.at(-1).counters;
        assert.equal(counts.gitExecFile + counts.gitSpawn + counts.gitExecFileSync, 0,
          "Both independent retained snapshots must launch zero Git processes");
      }
    }
    return resultReport();
  } catch (error) {
    return { ...resultReport(), functionalFailure: error.message };
  } finally {
    await stopAndRemove(child, env, owned);
  }
}

test("opt-in roadmap HTTP performance qualification", { skip: !enabled, timeout: 60 * 60 * 1000 }, async (t) => {
  const sources = selection("MINIMAP_PERFORMANCE_SOURCES", [1, 4, 16, 25]);
  const items = selection("MINIMAP_PERFORMANCE_ITEMS", [100, 1000]);
  const samples = Number(process.env.MINIMAP_PERFORMANCE_SAMPLES || 1);
  assert.ok(Number.isInteger(samples) && samples >= 1 && samples <= 20, "Samples must be 1..20");
  assert.ok(Number.isInteger(warmSamples) && warmSamples >= 1 && warmSamples <= 20, "Warm samples must be 1..20");
  assert.ok(!legacy || warmSamples === 1, "Extra warm samples require the snapshot runtime");
  assert.ok(Number.isInteger(workRecordCount) && (workRecordCount === 0 || workRecordCount === 1000),
    "MINIMAP_PERFORMANCE_WORK_RECORDS must be unset or 1000");
  const runtimeProvenance = runtimeRoot === projectRoot ? { source: "working-checkout", revision: git(projectRoot, "rev-parse", "HEAD"),
    workingTreeDirty: Boolean(git(projectRoot, "status", "--porcelain")) }
    : JSON.parse(await fs.readFile(path.join(runtimeRoot, "performance-provenance.json"), "utf8"));
  assert.match(runtimeProvenance.revision, /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i);
  const report = { startedAt: new Date().toISOString(), node: process.version, platform: process.platform,
    git: git(projectRoot, "--version"), revision: git(projectRoot, "rev-parse", "HEAD"),
    workingTreeDirty: Boolean(git(projectRoot, "status", "--porcelain")), runtimeRoot, runtimeProvenance,
    mode: legacy ? "legacy-fresh" : "snapshot", sources, items, samples, warmSamples, workRecordCount, results: [] };
  await fs.mkdir(path.join(projectRoot, "tmp"), { recursive: true });
  const evidence = path.join(projectRoot, "tmp", `roadmap-performance-${Date.now()}.json`);
  matrix: for (const sourceCount of sources) for (const itemCount of items) {
    let failed = true;
    await t.test(`${sourceCount} sources x ${itemCount} items`, { timeout: 15 * 60 * 1000 }, async (cell) => {
      const result = await qualify(sourceCount, itemCount, samples, cell.signal, workRecordCount);
      report.results.push(result);
      await fs.writeFile(evidence, `${JSON.stringify(report, null, 2)}\n`);
      t.diagnostic(JSON.stringify({ sources: sourceCount, items: itemCount, summary: result.summary, evidence }));
      assert.equal(result.functionalFailure, undefined, `Functional qualification failed; inspect ${evidence}`);
      // Failure statuses are recorded before failing qualification; latency
      // target misses remain explicit results for the owning acceptance review.
      for (const [name, records] of Object.entries(result.measurements)) {
        assert.ok(records.length, `No ${name} measurements`);
        assert.ok(records.every((record) => record.status === 200), `${name} has failed HTTP responses; inspect ${evidence}`);
      }
      for (const record of result.measurements.fullSnapshot) {
        if (!legacy) {
          assert.ok(record.snapshot?.id, "Full responses must expose snapshot metadata");
          assert.equal(record.loaded, sourceCount);
          if (statusHistory && runtimeRoot === projectRoot && sourceCount > 1 && itemCount <= 500) assert.equal(record.supersededStatuses,
            Math.ceil(itemCount / 2) * (sourceCount - 1), "Differing-history qualification must actually exercise successful status proof");
        }
      }
      failed = false;
    });
    if (failed) break matrix;
  }
});
