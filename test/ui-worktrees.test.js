import test from "node:test";
import assert from "node:assert/strict";
import { countDistinctWorktreeFeatures, projectWorktreeGroups } from "../package/minimap/ui/worktrees.js";

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
