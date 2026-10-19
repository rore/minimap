import test from "node:test";
import assert from "node:assert/strict";
import { countDistinctWorktreeFeatures, createWorktreeProjector, projectWorktreeGroups, versionDifferences, recordedStatusSummary } from "../package/minimap/ui/worktrees.js";

test("recorded status summary keeps conflicts without choosing a newest file or inferring execution", () => {
  for (const [statuses, expected] of [
    [["queued", "active"], ["Marked active", true, "progress"]],
    [["ACTIVE", "in-progress", "in progress"], ["Marked active", false, "progress"]],
    [["queued", "active", "blocked"], ["Marked active · blocked", true, "blocked"]],
    [["active", "done", "queued"], ["Marked active", true, "progress"]],
    [["done", "queued"], ["Statuses differ", true, ""]],
    [["done", "done"], ["Marked done", false, ""]],
    [["queued"], ["Marked queued", false, ""]],
    [["blocked", "done"], ["Marked blocked", true, "blocked"]],
    [["active", null], ["Marked active", true, "progress"]],
    [[null], ["Status unavailable", false, ""]],
    [[], ["Status unavailable", false, ""]],
  ]) {
    const item = { status: "done", participantCount: 99, matchingVersions: statuses.map((status) => ({ summary: { status } })) };
    const result = recordedStatusSummary(item);
    assert.deepEqual([result.label, result.differs, result.tone], expected, JSON.stringify(statuses));
  }
  assert.equal(recordedStatusSummary({ metadata: { status: "queued" }, participantCount: 99 }).label, "Marked queued");
});

function fixture(versions, { availableLenses = [] } = {}) {
  const features = versions.map(({ key, id, entries }) => ({ key, id, versions: entries, conflicts: [] }));
  const groupMap = new Map();
  for (const feature of features) for (const version of feature.versions) {
    const key = `${version.groupKind}:${version.group}`;
    if (!groupMap.has(key)) groupMap.set(key, { name: version.group, kind: version.groupKind, items: [] });
    const group = groupMap.get(key);
    let item = group.items.find((entry) => entry.key === feature.key);
    if (!item) group.items.push(item = { key: feature.key, id: feature.id, versions: [], conflicts: [] });
    item.versions.push(version);
  }
  return { features, groups: [...groupMap.values()], workspace: { availableLenses } };
}

const version = (sourceKey, group, summary, groupKind = "board") => ({
  sourceKey, repoRoot: sourceKey, itemId: summary.id, summary, group, groupKind,
});

test("version differences use the selected version and line-ending-normalized content evidence", () => {
  const selected = { sourceKey: "main", summary: { status: "done", priority: "low", revision: "raw-a" }, displayRevision: "same-content" };
  const identical = { sourceKey: "other", summary: { ...selected.summary, revision: "raw-crlf" }, displayRevision: "same-content" };
  assert.deepEqual(versionDifferences(identical, selected), []);
  const changed = { sourceKey: "blue", summary: { status: "active", priority: "high", revision: "raw-b" }, displayRevision: "changed-content" };
  assert.deepEqual(versionDifferences(changed, selected), ["Status: active (selected: done)", "Priority: high (selected: low)", "Content differs"]);
  assert.deepEqual(versionDifferences(selected, changed), ["Status: done (selected: active)", "Priority: low (selected: high)", "Content differs"]);
  assert.deepEqual(versionDifferences({ ...identical, displayRevision: "body-only" }, selected), ["Content differs"]);
  assert.deepEqual(versionDifferences(selected, selected), []);
});

test("search and metadata filters must match one version, not combine siblings", () => {
  const aggregate = fixture([{ key: "f", id: "x", entries: [
    version("opened", "A", { id: "x", title: "needle", searchText: "needle", metadata: { status: "queued" } }),
    version("sibling", "A", { id: "x", title: "other", searchText: "other", metadata: { status: "done" } }),
  ] }]);
  assert.deepEqual(projectWorktreeGroups(aggregate, { searchQuery: "needle", activeFilters: { status: ["done"] } }), []);
});

test("board group shows a sibling's in-progress version and keeps conflicts", () => {
  const aggregate = fixture([{ key: "f", id: "x", entries: [
    version("opened", "A", { id: "x", title: "opened", searchText: "", metadata: { status: "done" } }),
    version("sibling", "A", { id: "x", title: "sibling", searchText: "", metadata: { status: "in-progress" } }),
  ] }]);
  const [group] = projectWorktreeGroups(aggregate, { inPlay: true });
  assert.deepEqual(group.items[0].versions.map((entry) => entry.sourceKey), ["sibling"]);
});

test("Across In play includes a blocked version without participants and composes filters per version", () => {
  const aggregate = fixture([{ key: "f", id: "x", entries: [
    version("opened", "A", { id: "x", title: "opened", searchText: "opened", metadata: { status: "queued", milestone: "v1" } }),
    version("sibling", "A", { id: "x", title: "blocked sibling", searchText: "blocked sibling", metadata: { status: " BLOCKED ", milestone: "v2" } }),
  ] }]);
  const [group] = projectWorktreeGroups(aggregate, { inPlay: true, participantCounts: new Map() });
  assert.deepEqual(group.items[0].matchingVersions.map((entry) => entry.sourceKey), ["sibling"]);
  assert.deepEqual(projectWorktreeGroups(aggregate, { inPlay: true, searchQuery: "opened" }), []);
  assert.deepEqual(projectWorktreeGroups(aggregate, { inPlay: true, activeFilters: { milestone: ["v1"] } }), []);
  assert.equal(projectWorktreeGroups(aggregate, { inPlay: true, activeFilters: { milestone: ["v2"] } })[0].items.length, 1);
});

test("the same feature in separate groups counts once", () => {
  const aggregate = fixture([{ key: "f", id: "x", entries: [
    version("opened", "A", { id: "x", title: "x", searchText: "", metadata: {} }),
    version("sibling", "B", { id: "x", title: "x", searchText: "", metadata: {} }),
  ] }]);
  const groups = projectWorktreeGroups(aggregate);
  assert.equal(groups.length, 2);
  assert.notEqual(groups[0].items[0].id, groups[1].items[0].id);
  assert.equal(groups[0].items[0].featureKey, "f");
  assert.equal(groups[0].items[0].matchingVersions.length, 1);
  assert.equal(countDistinctWorktreeFeatures(groups), 1);
});

test("derived lens groups each version by its own value", () => {
  const aggregate = fixture([{ key: "f", id: "x", entries: [
    version("opened", "A", { id: "x", title: "x", searchText: "", metadata: { status: "queued" } }),
    version("sibling", "A", { id: "x", title: "x", searchText: "", metadata: { status: "done" } }),
  ] }], { availableLenses: [{ key: "status", values: ["queued", "done"] }] });
  const groups = projectWorktreeGroups(aggregate, { lens: "status" });
  assert.deepEqual(groups.map((group) => group.name), ["queued", "done"]);
  assert.deepEqual(groups.map((group) => group.items[0].sourceVersion.sourceKey), ["opened", "sibling"]);
});

test("derived lens merges same feature appearances across board groups", () => {
  const aggregate = fixture([{ key: "f", id: "x", entries: [
    version("opened", "A", { id: "x", title: "x", searchText: "", metadata: { status: "queued" } }),
    version("sibling", "B", { id: "x", title: "x", searchText: "", metadata: { status: "queued" } }),
  ] }], { availableLenses: [{ key: "status", values: ["queued"] }] });
  const groups = projectWorktreeGroups(aggregate, { lens: "status" });
  assert.equal(groups[0].items.length, 1);
  assert.deepEqual(groups[0].items[0].matchingVersions.map((entry) => entry.sourceKey), ["opened", "sibling"]);
  assert.equal(groups[0].items[0].sourceVersion.sourceKey, "opened");
});

test("derived groups preserve feature order and merging without scanning the growing card list", () => {
  const aggregate = fixture(Array.from({ length: 128 }, (_, index) => ({ key: `feature-${index}`, id: `item-${index}`, entries: [
    version("opened", "A", { id: `item-${index}`, title: `Item ${index}`, metadata: { status: "queued" } }),
    version("sibling", "B", { id: `item-${index}`, title: `Item ${index}`, metadata: { status: "queued" } }),
  ] })), { availableLenses: [{ key: "status", values: ["queued"] }] });
  const original = Array.prototype.find;
  let scannedCards = 0, groups;
  try {
    Array.prototype.find = function (...args) {
      if (this[0]?.featureKey) scannedCards += this.length;
      return original.apply(this, args);
    };
    groups = projectWorktreeGroups(aggregate, { lens: "status" });
  } finally { Array.prototype.find = original; }
  assert.equal(scannedCards, 0);
  assert.deepEqual(groups[0].items.map((card) => card.featureKey), aggregate.features.map((feature) => feature.key));
  assert.ok(groups[0].items.every((card) => card.matchingVersions.length === 2 && card.sourceVersion.sourceKey === "opened"));
});

test("the cached projector indexes full features for group cues and replaces the index with the aggregate", () => {
  const aggregate = fixture([{ key: "f", id: "x", entries: [version("opened", "A", { id: "x", metadata: {} })] }]);
  aggregate.features[0].groups = [{ kind: "board", name: "A" }, { kind: "board", name: "B" }];
  const project = createWorktreeProjector();
  const first = project(aggregate);
  assert.equal(first.features.get("f"), aggregate.features[0]);
  assert.equal(project(aggregate), first);
  const next = { ...aggregate, features: [{ ...aggregate.features[0], groups: [{ kind: "board", name: "C" }] }] };
  assert.equal(project(next).features.get("f"), next.features[0]);
  assert.notEqual(project(next).features, first.features);
});

test("derived merge keeps conflicts and opened-first source when sibling group comes first", () => {
  const aggregate = fixture([{ key: "f", id: "x", entries: [
    version("opened", "A", { id: "x", title: "opened title", searchText: "", status: "done", priority: "high", milestone: "S3", metadata: { status: "done" } }),
    version("sibling", "B", { id: "x", title: "sibling title", searchText: "", status: "in-progress", priority: "low", milestone: "S3", metadata: { status: "in-progress" } }),
  ] }], { availableLenses: [{ key: "milestone", values: ["S3"] }] });
  aggregate.groups.reverse();
  const [group] = projectWorktreeGroups(aggregate, { lens: "milestone" });
  assert.equal(group.items.length, 1);
  assert.equal(group.items[0].sourceVersion.sourceKey, "opened");
  assert.equal(group.items[0].title, "opened title");
  assert.equal(group.items[0].status, "done");
  assert.equal(group.items[0].priority, "high");
  assert.deepEqual(group.items[0].conflicts.filter((entry) => entry.field === "status").map((entry) => [entry.sourceKey, entry.value]), [["opened", "done"], ["sibling", "in-progress"]]);
});

test("unlisted versions stay in Not on a board disclosure under derived lenses", () => {
  const aggregate = fixture([{ key: "f", id: "x", entries: [
    version("opened", "Not on a board", { id: "x", title: "x", searchText: "", metadata: { status: "done" } }, "unlisted"),
  ] }], { availableLenses: [{ key: "status", values: ["done"] }] });
  const groups = projectWorktreeGroups(aggregate, { lens: "status" });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "Not on a board");
  assert.equal(groups[0].kind, "unlisted");
});

test("same-ID ambiguous feature does not qualify from participant association", () => {
  const aggregate = fixture([
    { key: "one", id: "x", entries: [version("opened", "A", { id: "x", title: "one", searchText: "", metadata: { status: "done" } })] },
    { key: "two", id: "x", entries: [version("sibling", "A", { id: "x", title: "two", searchText: "", metadata: { status: "done" } })] },
  ]);
  assert.deepEqual(projectWorktreeGroups(aggregate, { inPlay: true, participantCounts: new Map([["one", { participantCount: 3 }], ["two", { participantCount: 2 }]]) }), []);
});

test("canonically equivalent IDs cannot qualify from participant association", () => {
  const aggregate = fixture([
    { key: "composed", id: "caf\u00e9", entries: [version("opened", "A", { id: "caf\u00e9", title: "one", searchText: "", metadata: { status: "queued" } })] },
    { key: "decomposed", id: "cafe\u0301", entries: [version("sibling", "A", { id: "cafe\u0301", title: "two", searchText: "", metadata: { status: "queued" } })] },
  ]);
  const participantCounts = new Map([
    ["composed", { participantCount: 1 }],
    ["decomposed", { participantCount: 1 }],
  ]);
  assert.deepEqual(projectWorktreeGroups(aggregate, { inPlay: true, participantCounts }), []);
});

test("projection does not invent a revision conflict for display-equivalent copies", () => {
  const aggregate = fixture([{ key: "f", id: "x", entries: [
    { ...version("opened", "A", { id: "x", title: "same", revision: "raw-lf", metadata: {} }), displayRevision: "normalized" },
    { ...version("sibling", "A", { id: "x", title: "same", revision: "raw-crlf", metadata: {} }), displayRevision: "normalized" },
  ] }]);
  assert.deepEqual(projectWorktreeGroups(aggregate)[0].items[0].conflicts, []);
});
