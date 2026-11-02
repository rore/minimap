import test from "node:test";
import assert from "node:assert/strict";
import { createAcrossRelatedWork, readAcrossRelatedWork, cacheAcrossRelatedWork, acrossRelatedWorkKey, acrossRelatedWorkDisclosureKey } from "../package/minimap/ui/related-work.js";

const version = (key) => ({ sourceKey: key, itemId: "feature", summary: { revision: `revision-${key}` },
  sourceContext: { sourceKey: key, repoRoot: `/${key}`, git: { headCommit: key, branchRef: `refs/heads/${key}` }, roadmapBinding: { path: "roadmap" } } });
const feature = (count = 2) => ({ key: "proven-feature", versions: Array.from({ length: count }, (_, index) => version(String(index))) });
const record = (id, title = id) => ({ id, title, recordedState: "Blocked", pullRequests: [`https://github.com/a/b/pull/${id.length}`] });
const page = (context, records, options = {}) => ({ status: "ok", records, generation: context.sourceKey, nextOffset: null,
  source: { repoRoot: context.repoRoot, sourceKey: context.sourceKey, headCommit: context.git.headCommit }, ...options });

test("order-only source changes retain exact version pages without weakening read scope", async () => {
  const input = feature(), reordered = { ...input, versions: [...input.versions].reverse() };
  const before = acrossRelatedWorkDisclosureKey("repo", input);
  assert.equal(acrossRelatedWorkDisclosureKey("repo", reordered), before);
  assert.notEqual(acrossRelatedWorkKey("repo", reordered), acrossRelatedWorkKey("repo", input));
  const initial = await readAcrossRelatedWork(createAcrossRelatedWork(input), { read: async (_, { sourceContext }) => page(sourceContext, [record("shared")]) });
  const retained = createAcrossRelatedWork(reordered, false, { ...initial, visibleLimit: 40 });
  assert.deepEqual(retained.states.map((state) => state.version.sourceKey), ["1", "0"]);
  assert.equal(retained.states[0].result, initial.states[1].result);
  assert.equal(retained.visibleLimit, 40);
  const readUneven = async (_, { sourceContext }) => page(sourceContext,
    Array.from({ length: 20 }, (_, index) => record(String(index + Number(sourceContext.sourceKey)).padStart(2, "0"))));
  const uneven = await readAcrossRelatedWork(createAcrossRelatedWork(input), { read: readUneven });
  const reorderedPages = createAcrossRelatedWork(reordered, false, uneven);
  assert.deepEqual(reorderedPages.records.map((entry) => entry.id), uneven.records.map((entry) => entry.id));
  const checked = await readAcrossRelatedWork(reorderedPages, { read: readUneven });
  assert.deepEqual(checked.records.map((entry) => entry.id), uneven.records.map((entry) => entry.id));
  assert.deepEqual(checked.records[1].versions.map((entry) => entry.sourceContext.sourceKey), ["1", "0"]);
  for (const mutate of [
    (f) => { f.key = "other"; }, (f) => { f.versions[0].summary.revision = "changed"; },
    (f) => { f.versions[0].sourceContext.git.headCommit = "changed"; },
    (f) => { f.versions[0].sourceContext.roadmapBinding.path = "other"; },
    (f) => { f.versions[0].itemId = "other"; }, (f) => { f.versions.pop(); },
  ]) {
    const changed = structuredClone(input); mutate(changed);
    assert.notEqual(acrossRelatedWorkDisclosureKey("repo", changed), before);
  }
  assert.notEqual(acrossRelatedWorkDisclosureKey("other", input), before);
  assert.notEqual(acrossRelatedWorkDisclosureKey("repo", input, true), before);
  const changed = structuredClone(input); changed.versions[0].summary.revision = "changed";
  assert.equal(createAcrossRelatedWork(changed, false, initial).states[0].result, undefined);
});

test("empty main includes sibling tasks and exact duplicate IDs preserve divergent versions", async () => {
  assert.equal(createAcrossRelatedWork(undefined).incomplete, true);
  assert.equal(createAcrossRelatedWork(undefined).status, "partial");
  const view = await readAcrossRelatedWork(createAcrossRelatedWork(feature(3)), { read: async (_, { sourceContext }) => page(sourceContext,
    sourceContext.sourceKey === "0" ? [] : [record("shared", `Version ${sourceContext.sourceKey}`)]) });
  assert.equal(view.total, 1);
  assert.equal(view.incomplete, false);
  assert.deepEqual(view.records[0].versions.map((entry) => [entry.title, entry.sourceContext.sourceKey, entry.itemId, entry.generation]),
    [["Version 1", "1", "feature", "1"], ["Version 2", "2", "feature", "2"]]);
});

test("More extends the retained order before a second source reorder", async () => {
  const input = feature(), reversed = { ...input, versions: [...input.versions].reverse() };
  const read = async (_, { sourceContext, offset = 0 }) => page(sourceContext,
    Array.from({ length: 20 }, (_, index) => record(`${sourceContext.sourceKey}-${offset + index}`)), { nextOffset: offset ? null : 20 });
  const initial = await readAcrossRelatedWork(createAcrossRelatedWork(input), { read });
  let view = createAcrossRelatedWork(reversed, false, initial);
  view = await readAcrossRelatedWork(view, { read, append: true });
  view = await readAcrossRelatedWork(view, { read, append: true });
  assert.equal(view.records.length, 60);
  assert.equal(view.recordOrder.length, 80);
  const again = createAcrossRelatedWork(input, false, view);
  assert.deepEqual(again.records.map((entry) => entry.id), view.records.map((entry) => entry.id));
  const removed = { ...again, states: again.states.map((state) => ({ ...state, result: { ...state.result, records: [] } })) };
  assert.deepEqual(createAcrossRelatedWork(reversed, false, removed).recordOrder, []);
});

test("25 known sources read at most four at once, deduplicate memberships, and do not drain pages", async () => {
  const input = feature(25);
  input.versions.push(input.versions[0]);
  let active = 0, maximum = 0, calls = 0;
  const view = await readAcrossRelatedWork(createAcrossRelatedWork(input), { read: async (_, { sourceContext, offset }) => {
    assert.equal(offset, undefined);
    calls++; active++; maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
    return page(sourceContext, [record(`task-${sourceContext.sourceKey}`)], { nextOffset: 20 });
  } });
  assert.equal(calls, 25);
  assert.equal(maximum, 4);
  assert.equal(view.records.length, 20);
  assert.equal(view.total, 25);
  assert.equal(view.incomplete, true);
  await readAcrossRelatedWork(view, { append: true, read: () => { throw new Error("Backlog must not read"); } });
});

test("More is source-generation-bound and eviction reloads only its source once without mixed versions", async () => {
  let view = await readAcrossRelatedWork(createAcrossRelatedWork(feature()), { read: async (_, { sourceContext }) => page(sourceContext,
    [record(`old-${sourceContext.sourceKey}`)], { nextOffset: 20 }) });
  const calls = [];
  view = await readAcrossRelatedWork(view, { append: true, read: async (_, options) => {
    calls.push([options.sourceContext.sourceKey, options.generation, options.offset, options.fresh]);
    if (options.sourceContext.sourceKey === "0" && options.generation) throw Object.assign(new Error("evicted"), { code: "related_work_changed" });
    return page(options.sourceContext, [record(options.fresh ? "replacement" : "peer-next")], { generation: options.fresh ? "new-generation" : options.sourceContext.sourceKey });
  } });
  assert.equal(calls.length, 3);
  assert.deepEqual(view.records.map((entry) => entry.id), ["replacement", "old-1", "peer-next"]);
  assert.equal(view.records[0].versions[0].generation, "new-generation");
  assert.equal(view.incomplete, false);
  assert.match(view.notices[0], /earlier pages.*removed/);
  const reopened = cacheAcrossRelatedWork(view);
  assert.equal(reopened.records.some((entry) => entry.id === "old-0"), false);
  assert.equal(reopened.records[0].versions[0].generation, "new-generation");
  assert.deepEqual(reopened.notices, view.notices);
  const refreshed = await readAcrossRelatedWork(view, { fresh: true, read: async (_, { sourceContext }) => page(sourceContext, []) });
  assert.deepEqual(refreshed.notices, []);
});

test("failed eviction retry removes old source versions but preserves peers and lower-bound count", async () => {
  const initial = await readAcrossRelatedWork(createAcrossRelatedWork(feature()), { read: async (_, { sourceContext }) => page(sourceContext,
    [record(sourceContext.sourceKey)], { nextOffset: sourceContext.sourceKey === "0" ? 20 : null }) });
  const result = await readAcrossRelatedWork(initial, { append: true, read: async (_, options) => {
    throw Object.assign(new Error("gone"), options.fresh ? {} : { code: "related_work_changed" });
  } });
  assert.deepEqual(result.records.map((entry) => entry.id), ["1"]);
  assert.equal(result.incomplete, true);
  assert.equal(result.status, "stale");
});

test("wrong source responses and failed peers never fabricate zero or overwrite same-scope data", async () => {
  const initial = await readAcrossRelatedWork(createAcrossRelatedWork(feature()), { read: async (_, { sourceContext }) => page(sourceContext, [record(sourceContext.sourceKey)]) });
  const result = await readAcrossRelatedWork(initial, { fresh: true, read: async (_, { sourceContext }) => page(sourceContext,
    [record("wrong")], { source: { ...sourceContext, headCommit: "changed" } }) });
  assert.deepEqual(result.records.map((entry) => entry.id), ["0", "1"]);
  assert.equal(result.incomplete, true);
  assert.equal(result.status, "stale");
  const missing = await readAcrossRelatedWork(createAcrossRelatedWork(feature()), { read: async (_, { sourceContext }) => {
    if (sourceContext.sourceKey === "0") throw new Error("unreadable");
    return page(sourceContext, []);
  } });
  assert.equal(missing.incomplete, true);
  assert.equal(missing.status, "partial");
});

test("same-generation refresh retains loaded pages while cache keeps only first pages", async () => {
  const read = async (_, { sourceContext, offset }) => page(sourceContext, [record(offset ? "second" : "first")], { nextOffset: offset ? null : 20 });
  const initial = await readAcrossRelatedWork(createAcrossRelatedWork(feature(1)), { read });
  const more = await readAcrossRelatedWork(initial, { read, append: true });
  const refreshed = await readAcrossRelatedWork(more, { read, fresh: true });
  assert.equal(refreshed.total, 2);
  assert.equal(refreshed.nextOffset, null);
  const cached = cacheAcrossRelatedWork(refreshed);
  assert.equal(cached.total, 1);
  assert.equal(cached.states[0].result.nextOffset, 20);
});

test("scope identity contains source set bindings and revisions, and cancellation stops queued reads", async () => {
  const input = feature(25);
  const before = acrossRelatedWorkKey("repo", input);
  assert.equal(acrossRelatedWorkKey("repo", { ...input }), before);
  input.versions[0].summary.revision = "changed";
  assert.notEqual(acrossRelatedWorkKey("repo", input), before);
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(readAcrossRelatedWork(createAcrossRelatedWork(input), { signal: controller.signal, read: async (_, { sourceContext }) => {
    calls++;
    controller.abort();
    return page(sourceContext, []);
  } }), { name: "AbortError" });
  assert.ok(calls <= 4);
});
