import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

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
const enabled = process.env.MINIMAP_RUN_PERFORMANCE === "1";
const legacy = process.env.MINIMAP_PERFORMANCE_LEGACY === "1";
const warmSamples = Number(process.env.MINIMAP_PERFORMANCE_WARM_SAMPLES || 1);
// Generated only inside the disposable fixture. IPC is available solely to the
// owning test parent; no production diagnostic route or installed preload.
export const performancePreload = String.raw`
import childProcess from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
if (path.basename(process.argv[1] || "") === "start-server.mjs" && process.send) {
  const counters = { gitExecFile: 0, gitSpawn: 0, gitExecFileSync: 0,
    fileReadAsync: 0, fileReadCallback: 0, fileReadSync: 0 };
  const gitCommands = {};
  const serializations = [];
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
  const countGit = (kind, file, args) => {
    if (path.basename(String(file)).toLowerCase().replace(/\.exe$/, "") !== "git") return;
    counters[kind]++;
    const command = args?.[0] || "(none)";
    gitCommands[command] = (gitCommands[command] || 0) + 1;
  };
  const exec = childProcess.execFile;
  function observedExecFile(file, args, ...rest) {
    countGit("gitExecFile", file, args);
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
      countGit(kind, file, args); return original(file, args, ...rest);
    };
  }
  const readAsync = fsp.readFile, readCallback = fs.readFile, readSync = fs.readFileSync;
  fsp.readFile = (...args) => { counters.fileReadAsync++; return readAsync(...args); };
  fs.readFile = (...args) => { counters.fileReadCallback++; return readCallback(...args); };
  fs.readFileSync = (...args) => { counters.fileReadSync++; return readSync(...args); };
  syncBuiltinESMExports();
  const histogram = monitorEventLoopDelay({ resolution: 10 });
  histogram.enable();
  process.on("message", (message) => {
    if (message?.type !== "minimap-performance-snapshot") return;
    const count = Number(histogram.count);
    const ms = (value) => count ? Math.round(value / 10000) / 100 : null;
    process.send({ type: "minimap-performance-metrics", id: message.id, pid: process.pid, serializations: serializations.splice(0),
      counters: { ...counters }, gitCommands: { ...gitCommands },
      eventLoopDelay: { samples: count, resolutionMs: 10, p50Ms: ms(histogram.percentile(50)),
        p95Ms: ms(histogram.percentile(95)), maxMs: ms(histogram.max), meanMs: ms(histogram.mean) } });
    if (message.reset) histogram.reset();
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
  return root;
}

async function start(root, env) {
  const child = spawn(process.execPath, [path.join(scripts, "start-server.mjs")], {
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

async function qualify(sources, items, samples, signal) {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-roadmap-performance-"));
  let child;
  const env = { ...process.env, MINIMAP_HOME: path.join(owned, "home"),
    MINIMAP_PALLIUM_ENDPOINT: "", MINIMAP_PALLIUM_DASHBOARD_ENDPOINT: "",
    MINIMAP_PALLIUM_SETTINGS_PATH: path.join(owned, "empty-settings.json"), PORT: String(await freePort()) };
  await fs.writeFile(env.MINIMAP_PALLIUM_SETTINGS_PATH, "{}");
  await fs.mkdir(env.MINIMAP_HOME);
  const preload = path.join(env.MINIMAP_HOME, "performance-preload.mjs");
  await fs.writeFile(preload, performancePreload);
  env.NODE_OPTIONS = `${env.NODE_OPTIONS || ""} --import=${pathToFileURL(preload).href}`;
  const measurements = { firstUsable: [], fullSnapshot: [], warmAcross: [], healthDuringScan: [],
    warmOtherProjectDuringScan: [], sameProjectTabs: [], independentProjects: [] };
  const serverScenarios = [];
  const observe = async (scenario, sample, work) => {
    const before = await serverMetrics(child, true);
    const begin = performance.now();
    try { return await work(); }
    finally {
      const after = await serverMetrics(child);
      assert.equal(after.pid, child.pid);
      serverScenarios.push({ scenario, sample, durationMs: Math.round(performance.now() - begin),
        countersBefore: before.counters, countersAfter: after.counters,
        counters: Object.fromEntries(Object.keys(after.counters).map((key) => [key, after.counters[key] - before.counters[key]])),
        gitCommands: Object.fromEntries(Object.keys(after.gitCommands).map((key) => [key, after.gitCommands[key] - (before.gitCommands[key] || 0)])),
        eventLoopDelay: after.eventLoopDelay });
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
        signal: AbortSignal.any([signal, AbortSignal.timeout(legacy ? 120000 : 35000)]),
      });
      const responseText = await response.text();
      const responseBytes = Buffer.byteLength(responseText);
      const body = JSON.parse(responseText);
      return { status: response.status, ms: Math.round((performance.now() - begin) * 100) / 100,
        responseBytes,
        snapshot: body.snapshot, loaded: body.coverage?.loaded, features: body.features?.length,
        versions: body.features?.reduce((sum, feature) => sum + (feature.versions?.length || 0), 0),
        partial: body.partial, identityUncertain: body.coverage?.identityUncertain?.map((entry) => entry.reason),
        pid: body.pid, runtime: body.runtime, code: body.code, error: response.ok ? undefined : body.error };
    } catch (error) {
      return { status: 0, ms: Math.round((performance.now() - begin) * 100) / 100, error: error.message };
    }
  };
  const full = legacy ? "/api/worktree-workspace" : "/api/worktree-workspace?participants=0&compact=1";
  const openedRoute = legacy ? `${full}?openedOnly=1` : `${full}&openedOnly=1`;
  const repeatedRoute = legacy ? full : `${full}&cached=1`;
  const otherRoute = legacy ? "/api/workspace" : "/api/workspace?cached=1";
  const requireSuccessful = (records, scenario) => assert.ok(records.every((record) => record.status === 200),
    `${scenario} failed: ${JSON.stringify(records.filter((record) => record.status !== 200))}`);
  const resultReport = () => ({ sources, itemsPerSource: items, samples, mode: legacy ? "legacy-fresh" : "snapshot", httpRequests,
    summary: Object.fromEntries(Object.entries(measurements).map(([key, records]) => [key,
      statistics(records, ["warmAcross", "healthDuringScan", "warmOtherProjectDuringScan", "retainedIndependentProjects"].includes(key) ? 200 : null)])),
    measurementLabels: { warmAcross: legacy ? "Repeated fresh Across read (no cache)" : "Warm cached Across read",
      warmOtherProjectDuringScan: legacy ? "Fresh This read of other project during scan" : "Warm cached This read of other project during scan" },
    measurements, serverScenarios,
    serverGitCalls: serverScenarios.reduce((sum, row) => sum + row.counters.gitExecFile + row.counters.gitSpawn + row.counters.gitExecFileSync, 0),
    serverFileReadCalls: serverScenarios.reduce((sum, row) => sum + row.counters.fileReadAsync + row.counters.fileReadCallback + row.counters.fileReadSync, 0),
    limits: "HTTP first usable excludes browser paint. Existing identity caps may retain separate features and partial coverage. OS caches are not flushed. Preload instrumentation adds overhead. File counts measure wrapped readFile/readFileSync calls, not all filesystem syscalls; Git counts measure wrapped execFile/spawn/execFileSync launches. Event-loop delay is measured inside the actual server process, with its histogram reset between named scenarios; mixed scan/probe scenarios are not attributed to individual requests." });
  try {
    const a = await fixture(owned, "project-a", sources, items);
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
        ]);
        const usable = await Promise.any([opened, across].map((pending) => pending.then((result) => {
          if (result.status !== 200) throw result;
          return { ...result, ms: Math.round((performance.now() - begin) * 100) / 100, coldSnapshot: n === 0 };
        }))).catch(() => ({ status: 0, ms: null, error: "No usable opened/full snapshot" }));
        measurements.firstUsable.push(usable);
        const fullResult = await across;
        measurements.fullSnapshot.push({ ...fullResult, coldSnapshot: n === 0 });
        const openedResult = await opened; await probes;
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
      const projects = await observe("two-independent-projects", n, () => Promise.all([read(full, a), read(full, b)]));
      measurements.independentProjects.push(...projects);
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
  const sources = selection("MINIMAP_PERFORMANCE_SOURCES", [1, 4, 16]);
  const items = selection("MINIMAP_PERFORMANCE_ITEMS", [100, 1000]);
  const samples = Number(process.env.MINIMAP_PERFORMANCE_SAMPLES || 1);
  assert.ok(Number.isInteger(samples) && samples >= 1 && samples <= 20, "Samples must be 1..20");
  assert.ok(Number.isInteger(warmSamples) && warmSamples >= 1 && warmSamples <= 20, "Warm samples must be 1..20");
  assert.ok(!legacy || warmSamples === 1, "Extra warm samples require the snapshot runtime");
  const runtimeProvenance = runtimeRoot === projectRoot ? { source: "working-checkout", revision: git(projectRoot, "rev-parse", "HEAD"),
    workingTreeDirty: Boolean(git(projectRoot, "status", "--porcelain")) }
    : JSON.parse(await fs.readFile(path.join(runtimeRoot, "performance-provenance.json"), "utf8"));
  assert.match(runtimeProvenance.revision, /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i);
  const report = { startedAt: new Date().toISOString(), node: process.version, platform: process.platform,
    git: git(projectRoot, "--version"), revision: git(projectRoot, "rev-parse", "HEAD"),
    workingTreeDirty: Boolean(git(projectRoot, "status", "--porcelain")), runtimeRoot, runtimeProvenance,
    mode: legacy ? "legacy-fresh" : "snapshot", sources, items, samples, warmSamples, results: [] };
  await fs.mkdir(path.join(projectRoot, "tmp"), { recursive: true });
  const evidence = path.join(projectRoot, "tmp", `roadmap-performance-${Date.now()}.json`);
  matrix: for (const sourceCount of sources) for (const itemCount of items) {
    let failed = true;
    await t.test(`${sourceCount} sources x ${itemCount} items`, { timeout: 15 * 60 * 1000 }, async (cell) => {
      const result = await qualify(sourceCount, itemCount, samples, cell.signal);
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
        }
      }
      failed = false;
    });
    if (failed) break matrix;
  }
});
