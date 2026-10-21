import test from "node:test";
import assert from "node:assert/strict";
import { countDistinctWorktreeFeatures, createWorktreeProjector, projectWorktreeGroups, normalizeWorktreeCardId, versionDifferences, recordedStatusSummary } from "../package/minimap/ui/worktrees.js";

test("recorded status summary keeps conflicts without choosing a newest file or inferring execution", () => {
  for (const [statuses, expected] of [
    [["queued", "active"], ["Active", true, "progress"]],
    [["ACTIVE", "in-progress", "in progress"], ["Active", false, "progress"]],
    [["queued", "active", "blocked"], ["Active · Blocked", true, "blocked"]],
    [["active", "done", "queued"], ["Active", true, "progress"]],
    [["done", "queued"], ["Statuses differ", true, ""]],
    [["done", "done"], ["Done", false, "done"]],
    [[" DONE ", "Done"], ["Done", false, "done"]],
    [["done", null], ["Statuses differ", true, ""]],
    [["done", "complete"], ["Statuses differ", true, ""]],
    [["done", "shipped"], ["Statuses differ", true, ""]],
    [["complete", "complete"], ["Complete", false, ""]],
    [["queued"], ["Queued", false, ""]],
    [["blocked", "done"], ["Blocked", true, "blocked"]],
    [["active", null], ["Active", true, "progress"]],
    [[null], ["Status unavailable", false, ""]],
    [[], ["Status unavailable", false, ""]],
  ]) {
    const item = { status: "done", participantCount: 99, matchingVersions: statuses.map((status) => ({ summary: { status } })) };
    const result = recordedStatusSummary(item);
    assert.deepEqual([result.label, result.differs, result.tone], expected, JSON.stringify(statuses));
  }
  assert.equal(recordedStatusSummary({ metadata: { status: "queued" }, participantCount: 99 }).label, "Queued");
  assert.equal(recordedStatusSummary({ metadata: { status: "done" } }).tone, "done");
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

test("the same feature projects once with all matching placement evidence", () => {
  const aggregate = fixture([{ key: "f", id: "x", entries: [
    version("opened", "A", { id: "x", title: "x", searchText: "", metadata: {} }),
    version("sibling", "B", { id: "x", title: "x", searchText: "", metadata: {} }),
  ] }]);
  const groups = projectWorktreeGroups(aggregate);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "A");
  assert.equal(groups[0].items[0].id, JSON.stringify(["f", "board", "A"]));
  assert.equal(groups[0].items[0].featureKey, "f");
  assert.equal(groups[0].items[0].matchingVersions.length, 2);
  assert.equal(countDistinctWorktreeFeatures(groups), 1);
});

test("derived lens chooses the first matching version and retains other statuses", () => {
  const aggregate = fixture([{ key: "f", id: "x", entries: [
    version("opened", "A", { id: "x", title: "x", searchText: "", metadata: { status: "queued" } }),
    version("sibling", "A", { id: "x", title: "x", searchText: "", metadata: { status: "done" } }),
  ] }], { availableLenses: [{ key: "status", values: ["queued", "done"] }] });
  const groups = projectWorktreeGroups(aggregate, { lens: "status" });
  assert.deepEqual(groups.map((group) => group.name), ["queued"]);
  assert.deepEqual(groups[0].items[0].matchingVersions.map((entry) => entry.sourceKey), ["opened", "sibling"]);
  const [filtered] = projectWorktreeGroups(aggregate, { lens: "status", activeFilters: { status: ["done"] } });
  assert.equal(filtered.name, "done");
  assert.equal(filtered.items[0].sourceVersion.sourceKey, "sibling");
  assert.equal(filtered.items[0].id, groups[0].items[0].id);
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

test("chosen board placement preserves board order rather than feature-array or sibling order", () => {
  const aggregate = fixture([
    { key: "first", id: "same", entries: [version("opened", "B", { id: "same", title: "first", metadata: { status: "done" } }), version("sibling", "A", { id: "same", metadata: { status: "active" } })] },
    { key: "second", id: "same", entries: [version("opened", "B", { id: "same", title: "second", metadata: { status: "done" } })] },
  ], { availableLenses: [{ key: "status", values: ["done", "active"] }] });
  aggregate.groups.find((group) => group.name === "B").items.reverse();
  aggregate.groups.reverse();
  const before = JSON.stringify(aggregate);
  const [board] = projectWorktreeGroups(aggregate);
  assert.equal(board.name, "B");
  assert.deepEqual(board.items.map((item) => item.title), ["second", "first"]);
  assert.equal(new Set(board.items.map((item) => item.id)).size, 2);
  const [filtered] = projectWorktreeGroups(aggregate, { inPlay: true });
  assert.equal(filtered.name, "A");
  assert.equal(filtered.items[0].id, board.items[1].id);
  assert.equal(filtered.items[0].sourceVersion.sourceKey, "sibling");
  assert.equal(JSON.stringify(aggregate), before);
});

test("derived ordering retains aggregate traversal while representative placement stays opened-first", () => {
  const aggregate = fixture([
    { key: "a", id: "a", entries: [version("opened", "A", { id: "a", metadata: { status: "done" } })] },
    { key: "b", id: "b", entries: [version("opened", "A", { id: "b", metadata: { status: "done" } })] },
  ], { availableLenses: [{ key: "status", values: ["done"] }] });
  aggregate.groups[0].items.reverse();
  assert.deepEqual(projectWorktreeGroups(aggregate, { lens: "status" })[0].items.map((item) => item.featureKey), ["b", "a"]);
});

test("known legacy placements normalize by exact feature identity only", () => {
  const aggregate = fixture([{ key: "f", id: "x", entries: [
    version("opened", "A", { id: "x", metadata: { status: "queued" } }),
    version("sibling", "B", { id: "x", metadata: { status: "done" } }),
  ] }], { availableLenses: [{ key: "status", values: ["queued", "done"] }] });
  const canonical = JSON.stringify(["f", "board", "A"]);
  for (const placement of [["f", "board", "A"], ["f", "board", "B"], ["f", "derived", "done"]]) {
    assert.equal(normalizeWorktreeCardId(aggregate, JSON.stringify(placement)), canonical);
  }
  for (const id of ["x", "invalid", JSON.stringify(["x", "board", "B"]), JSON.stringify(["f", "board", "unknown"]), JSON.stringify(["f", "derived", "unknown"])]) {
    assert.equal(normalizeWorktreeCardId(aggregate, id), id);
  }
  aggregate.features[0].versions[1].summary.metadata = {};
  assert.equal(normalizeWorktreeCardId(aggregate, JSON.stringify(["f", "derived", "Unassigned"])), canonical);
});

test("multiple memberships from one source stay evidence on one card and missing references survive", () => {
  const aggregate = fixture([{ key: "f", id: "x", entries: [
    version("opened", "A", { id: "x", metadata: { status: "done" } }),
    version("opened", "B", { id: "x", metadata: { status: "done" } }),
  ] }]);
  aggregate.groups[1].items.push({ id: "missing", key: "missing", missing: true });
  const groups = projectWorktreeGroups(aggregate);
  assert.equal(countDistinctWorktreeFeatures(groups), 1);
  assert.equal(groups[0].items[0].matchingVersions.length, 2);
  assert.equal(groups[1].items[0].missing, true);
  assert.equal(projectWorktreeGroups(aggregate, { searchQuery: "x" }).flatMap((group) => group.items).some((item) => item.missing), false);
});
