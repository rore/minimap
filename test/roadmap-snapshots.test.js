import test from "node:test";
import assert from "node:assert/strict";
import { createRoadmapSnapshotCoordinator } from "../package/minimap/src/roadmap-snapshots.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function makeCoordinator(overrides = {}) {
  let id = 0;
  let now = 1_000;
  const coordinator = createRoadmapSnapshotCoordinator({
    createId: () => `snapshot-${++id}`,
    now: () => now,
    limits: { maxConcurrent: 2, maxQueued: 8, jobTimeoutMs: 500, freshMs: 30, retainMs: 300, maxEntries: 16, maxBytes: 4096, ...overrides },
  });
  return { coordinator, setNow: (value) => { now = value; } };
}

const result = (value, manifest = { refs: [] }, admission = { root: "repo" }) => ({ value, manifest, admission });

test("coalesces identical scans and returns detached values", async () => {
  const { coordinator } = makeCoordinator();
  const gate = deferred();
  let loads = 0;
  const load = async () => { loads += 1; return gate.promise; };
  const first = coordinator.read({ key: "repo:this", load });
  const second = coordinator.read({ key: "repo:this", load });
  await new Promise(setImmediate);
  assert.equal(loads, 1);
  gate.resolve(result({ items: ["feature-a"] }, { refs: ["item:a"] }));
  const [a, b] = await Promise.all([first, second]);
  const serialized = '{"items":["feature-a"]}';
  assert.equal(a.valueJson, serialized);
  assert.equal(b.valueJson, serialized);
  assert.notStrictEqual(a.value, b.value);
  a.value.items.push("local mutation");
  assert.deepEqual(b.value.items, ["feature-a"]);
  assert.equal(a.valueJson, serialized);
  b.value = { replacement: true };
  assert.deepEqual(b.value, { replacement: true });
  assert.equal(b.valueJson, serialized);
  const cached = await coordinator.read({ key: "repo:this", cached: true, load, admit: async () => true });
  assert.deepEqual(cached.value.items, ["feature-a"]);
});

test("isolates scopes and validates cached admission before reuse", async () => {
  const { coordinator } = makeCoordinator();
  let loadsA = 0;
  let loadsB = 0;
  const loadA = async () => result({ scope: "a", run: ++loadsA }, { refs: ["a"] }, { root: "a" });
  const loadB = async () => result({ scope: "b", run: ++loadsB }, { refs: ["b"] }, { root: "b" });
  const a = await coordinator.read({ key: "repo-a:this", load: loadA });
  await coordinator.read({ key: "repo-b:this", load: loadB });
  const reused = await coordinator.read({ key: "repo-a:this", cached: true, load: loadA, admit: async (evidence) => evidence.root === "a" });
  assert.equal(reused.value.run, 1);
  assert.equal(reused.snapshot.id, a.snapshot.id);
  const refreshed = await coordinator.read({ key: "repo-a:this", cached: true, load: loadA, admit: async () => false });
  assert.equal(refreshed.value.run, 2);
  assert.notEqual(refreshed.snapshot.id, a.snapshot.id);
  assert.equal(loadsB, 1);
});

test("non-retained reads stay inside the coordinator without reusing or caching results", async () => {
  const { coordinator } = makeCoordinator();
  let loads = 0;
  const retained = await coordinator.read({ key: "repo:participants", load: async () => result({ run: ++loads }) });
  assert.ok(coordinator.getManifest(retained.snapshot.id, "repo:participants"));
  const read = () => coordinator.read({ key: "repo:participants", cached: true, retain: false,
    load: async () => result({ run: ++loads }) });
  const first = await read();
  assert.equal(first.value.run, 2);
  assert.equal(coordinator.getManifest(retained.snapshot.id, "repo:participants"), null);
  assert.equal(coordinator.getManifest(first.snapshot.id, "repo:participants"), null);
  const second = await read();
  assert.equal(second.value.run, 3);
  assert.equal(coordinator.getManifest(second.snapshot.id, "repo:participants"), null);
});

test("one subscriber can cancel without cancelling another; abandoned work is aborted", async () => {
  const { coordinator } = makeCoordinator();
  const first = new AbortController();
  const second = new AbortController();
  let scanSignal;
  let aborted = false;
  const load = ({ signal }) => new Promise((resolve, reject) => {
    scanSignal = signal;
    signal.addEventListener("abort", () => { aborted = true; reject(signal.reason); }, { once: true });
  });
  const a = coordinator.read({ key: "repo:this", signal: first.signal, load });
  const b = coordinator.read({ key: "repo:this", signal: second.signal, load });
  await new Promise(setImmediate);
  first.abort();
  await assert.rejects(a);
  assert.equal(scanSignal.aborted, false);
  second.abort();
  await assert.rejects(b);
  await new Promise(setImmediate);
  assert.equal(aborted, true);
});

test("queued jobs include queue time in their total deadline", async () => {
  const { coordinator } = makeCoordinator({ maxConcurrent: 1, jobTimeoutMs: 40 });
  const gate = deferred();
  const first = coordinator.read({ key: "repo-a:this", load: () => gate.promise });
  const firstFailure = assert.rejects(first, (error) => error.code === "snapshot_unavailable");
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = coordinator.read({ key: "repo-b:this", load: async () => result({ scope: "b" }) });
  try {
    await assert.rejects(second, (error) => error.code === "snapshot_unavailable");
  } finally {
    gate.resolve(result({ scope: "a" }));
  }
  await firstFailure;
});

test("invalidated scan cannot publish and same-scope validation waits for it to settle", async () => {
  const { coordinator } = makeCoordinator({ maxConcurrent: 1 });
  const old = deferred();
  let loads = 0;
  const load = async () => {
    loads += 1;
    if (loads === 1) return old.promise;
    return result({ version: loads }, { refs: [`version-${loads}`] });
  };
  const stale = coordinator.read({ key: "repo:this", load });
  await new Promise(setImmediate);
  coordinator.invalidateAll();
  await assert.rejects(stale, (error) => error.code === "snapshot_invalidated");
  const fresh = coordinator.read({ key: "repo:this", load });
  await new Promise(setImmediate);
  assert.equal(loads, 1);
  old.resolve(result({ version: 1 }, { refs: ["obsolete"] }));
  const current = await fresh;
  assert.equal(loads, 2);
  assert.equal(current.value.version, 2);
  assert.equal(coordinator.getManifest(current.snapshot.id, "repo:this").refs[0], "version-2");
});

test("recovery invalidation rejects pre-recovery data and requires a complete new read", async () => {
  const { coordinator } = makeCoordinator();
  let version = 1;
  const obsolete = coordinator.read({ key: "repo:this", load: async ({ signal }) => {
    const captured = version;
    version = 2;
    // An obsolete caller cannot exempt its own pre-recovery read from invalidation.
    coordinator.invalidateAll({ exceptSignal: signal });
    return result({ version: captured });
  } });
  await assert.rejects(obsolete, (error) => error.code === "snapshot_invalidated");
  const current = await coordinator.read({ key: "repo:this", load: async () => result({ version }) });
  assert.equal(current.value.version, 2);
  assert.equal(current.generation, coordinator.generation());
  assert.ok(coordinator.getManifest(current.snapshot.id, "repo:this"));
});

test("cancellation before the loader microtask starts performs no scan", async () => {
  const { coordinator } = makeCoordinator();
  const controller = new AbortController();
  let loads = 0;
  const read = coordinator.read({ key: "repo:this", signal: controller.signal,
    load: async () => { loads++; return result({ obsolete: true }); } });
  controller.abort();
  await assert.rejects(read);
  await new Promise(setImmediate);
  assert.equal(loads, 0);
});

for (const cause of ["subscriber cancellation", "deadline"]) {
  test(`same-key replacement waits for cleanup after ${cause}`, async () => {
    const { coordinator } = makeCoordinator({ maxConcurrent: 2, jobTimeoutMs: cause === "deadline" ? 40 : 500 });
    const controller = new AbortController();
    const old = deferred();
    let loads = 0, scanSignal;
    const load = async ({ signal }) => {
      loads++;
      if (loads === 1) { scanSignal = signal; return old.promise; }
      return result({ version: loads });
    };
    const first = coordinator.read({ key: "repo:this", signal: controller.signal, load });
    const rejected = assert.rejects(first, (error) => cause !== "deadline" || error.code === "snapshot_unavailable");
    await new Promise(setImmediate);
    assert.equal(loads, 1);
    if (cause === "subscriber cancellation") controller.abort();
    await rejected;
    assert.equal(scanSignal.aborted, true);
    const next = coordinator.read({ key: "repo:this", load });
    try {
      await new Promise(setImmediate);
      assert.equal(loads, 1);
    } finally {
      old.resolve(result({ version: 1 }));
      const current = await next;
      assert.equal(current.value.version, 2);
    }
  });
}

test("rejects work beyond the queued-scope bound and leaves existing work intact", async () => {
  const { coordinator } = makeCoordinator({ maxConcurrent: 1, maxQueued: 1, jobTimeoutMs: 300 });
  const gate = deferred();
  const first = coordinator.read({ key: "running", load: () => gate.promise });
  await new Promise(setImmediate);
  const queued = coordinator.read({ key: "queued", load: async () => result({ ok: true }) });
  await assert.rejects(coordinator.read({ key: "overflow", load: async () => result({ ok: true }) }),
    (error) => error.code === "snapshot_unavailable" && error.status === 503);
  gate.resolve(result({ ok: true }));
  await Promise.all([first, queued]);
});

test("cache freshness, retention, entry count and byte bounds are enforced", async () => {
  const { coordinator, setNow } = makeCoordinator({ maxEntries: 2, maxBytes: 256, freshMs: 30, retainMs: 100 });
  const load = (value) => async () => result({ value }, { refs: [value] });
  const a = await coordinator.read({ key: "a:this", load: load("a" ) });
  setNow(1_031);
  const stale = await coordinator.read({ key: "a:this", cached: true, load: load("unused"), admit: async () => true });
  assert.equal(stale.snapshot.id, a.snapshot.id);
  assert.equal(stale.snapshot.stale, true);
  const b = await coordinator.read({ key: "b:this", load: load("b") });
  await coordinator.read({ key: "c:this", load: load("c") });
  assert.equal(coordinator.getManifest(a.snapshot.id, "a:this"), null);
  setNow(1_131);
  assert.equal(coordinator.getManifest(b.snapshot.id, "b:this"), null);
});

test("oversized snapshots can retain only a bounded observation manifest", async () => {
  const { coordinator } = makeCoordinator({ maxBytes: 100 });
  const first = await coordinator.read({
    key: "large:this",
    load: async () => result({ body: "x".repeat(500) }, { refs: ["bounded"] }),
  });
  assert.deepEqual(coordinator.getManifest(first.snapshot.id, "large:this"), { refs: ["bounded"] });
  let loads = 0;
  const next = await coordinator.read({ key: "large:this", cached: true, load: async () => {
    loads += 1;
    return result({ body: "next".repeat(10) }, { refs: ["next"] });
  }, admit: async () => true });
  assert.equal(loads, 1);
  assert.notEqual(next.snapshot.id, first.snapshot.id);
});

test("byte pressure evicts the least recently used entry before the entry-count limit", async () => {
  const { coordinator } = makeCoordinator({ maxEntries: 16, maxBytes: 150 });
  const load = (key) => async () => result({ body: "x".repeat(20) }, { refs: [key] });
  const a = await coordinator.read({ key: "a", load: load("a") });
  const b = await coordinator.read({ key: "b", load: load("b") });
  assert.ok(coordinator.getManifest(a.snapshot.id, "a"));
  assert.ok(coordinator.getManifest(b.snapshot.id, "b"));
  await coordinator.read({ key: "a", cached: true, load: load("a"), admit: async () => true });
  const c = await coordinator.read({ key: "c", load: load("c") });
  assert.equal(coordinator.getManifest(b.snapshot.id, "b"), null);
  assert.ok(coordinator.getManifest(a.snapshot.id, "a"));
  assert.ok(coordinator.getManifest(c.snapshot.id, "c"));
});

test("an oversized manifest is not retained and cannot leave an older snapshot reusable", async () => {
  const { coordinator } = makeCoordinator({ maxBytes: 100 });
  const old = await coordinator.read({ key: "repo:this", load: async () => result({ version: 1 }) });
  assert.ok(coordinator.getManifest(old.snapshot.id, "repo:this"));
  const large = await coordinator.read({ key: "repo:this",
    load: async () => result({ version: 2 }, { refs: ["x".repeat(200)] }) });
  assert.equal(large.value.version, 2);
  assert.equal(coordinator.getManifest(large.snapshot.id, "repo:this"), null);
  assert.equal(coordinator.getManifest(old.snapshot.id, "repo:this"), null);
  let loads = 0;
  const next = await coordinator.read({ key: "repo:this", cached: true, admit: async () => true,
    load: async () => { loads++; return result({ version: 3 }); } });
  assert.equal(loads, 1);
  assert.equal(next.value.version, 3);
});

test("opened-only priority admits the oldest regular job after one priority job", async () => {
  const { coordinator } = makeCoordinator({ maxConcurrent: 1 });
  const held = deferred();
  const order = [];
  const first = coordinator.read({ key: "running", load: async () => { order.push("running"); return held.promise; } });
  await new Promise(setImmediate);
  const reads = [first];
  for (const key of ["regular", "priority-1", "priority-2", "priority-3"]) {
    reads.push(coordinator.read({ key, priority: key.startsWith("priority"),
      load: async () => { order.push(key); return result({ key }); } }));
  }
  assert.deepEqual(order, ["running"]);
  held.resolve(result({ key: "running" }));
  await Promise.all(reads);
  assert.deepEqual(order, ["running", "priority-1", "regular", "priority-2", "priority-3"]);
});
