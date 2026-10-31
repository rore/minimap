import test from "node:test";
import assert from "node:assert/strict";
import { sortDerivedGroupsDoneLast, projectWorktreeGroups, createWorktreeProjector } from "../package/minimap/ui/worktrees.js";

const card = (id, status) => Object.freeze({ id, metadata: Object.freeze({ status }) });
const ids = (group) => group.items.map((item) => item.id);

test("derived and Unassigned groups stably move only displayed Done without mutating inputs", () => {
  const items = Object.freeze([card("d1", "done"), card("q", "queued"), card("d2", " DONE "), card("u", null), card("s", "shipped"), card("b", "blocked"), card("c", "cancelled")]);
  for (const group of [Object.freeze({ name: "Lane", isDerived: true, items }), Object.freeze({ name: "Unassigned", kind: "derived", items })]) {
    const [result] = sortDerivedGroupsDoneLast(Object.freeze([group]));
    assert.deepEqual(ids(result), ["q", "u", "s", "b", "c", "d1", "d2"]);
    assert.deepEqual(ids(group), ["d1", "q", "d2", "u", "s", "b", "c"]);
    assert.notEqual(result.items, items);
    assert.equal(result.items[0], items[1]);
  }
});

test("combined mixed, unknown and empty status evidence stays before unanimous Done", () => {
  const item = (id, statuses) => ({ id, status: "done", matchingVersions: statuses.map((status) => ({ summary: { status } })) });
  const items = [item("done", ["done", "Done"]), item("mixed", ["done", "queued"]), item("blocked", ["done", "blocked"]), item("unknown", ["done", null]), item("empty", []), item("other", ["shipped", "shipped"]), item("normalized", [" DONE ", "done"])];
  const [result] = sortDerivedGroupsDoneLast([{ isDerived: true, items }]);
  assert.deepEqual(ids(result), ["mixed", "blocked", "unknown", "empty", "other", "done", "normalized"]);
});

test("manual Board, unlisted, group order and empty groups are unchanged", () => {
  const items = Object.freeze([card("done", "done"), card("queued", "queued")]);
  const groups = Object.freeze([
    Object.freeze({ name: "Manual", kind: "board", items }),
    Object.freeze({ name: "This Board", isDerived: false, items }),
    Object.freeze({ name: "Not on a board", kind: "unlisted", items }),
    Object.freeze({ name: "Empty", kind: "derived", items: Object.freeze([]) }),
  ]);
  const result = sortDerivedGroupsDoneLast(groups);
  assert.deepEqual(result.map((group) => group.name), groups.map((group) => group.name));
  for (let index = 0; index < 3; index++) assert.equal(result[index], groups[index]);
  assert.deepEqual(result[3].items, []);
});

test("Across projection sorts after matching-version filtering, preserves unlisted order and cache inputs", () => {
  const states = [["done"], ["done", "queued"], ["active"], ["done", "done"], ["done"], ["queued"]];
  const features = states.map((statuses, index) => ({ key: `k${index}`, id: `i${index}`, versions: statuses.map((status, source) => ({
    sourceKey: `source-${source}`, itemId: `i${index}`, groupKind: index < 4 ? "board" : "unlisted", group: index < 4 ? "Manual" : "Not on a board",
    summary: { id: `i${index}`, title: `Item ${index}`, status, metadata: { status, lane: "Alpha" } },
  })) }));
  const aggregate = { features, workspace: { availableLenses: [{ key: "lane", values: ["Beta", "Alpha"] }] }, groups: [
    { kind: "board", name: "Manual", items: features.slice(0, 4).map((feature) => ({ key: feature.key })) },
    { kind: "unlisted", name: "Not on a board", items: features.slice(4).map((feature) => ({ key: feature.key })) },
  ] };
  const before = JSON.stringify(aggregate);
  const projector = createWorktreeProjector();
  const options = { lens: "lane", showEmptyGroups: true };
  const projected = projector(aggregate, options);
  assert.equal(projector(aggregate, options), projected);
  assert.deepEqual(projected.groups.map((group) => group.name), ["Beta", "Alpha", "Not on a board"]);
  assert.deepEqual(projected.groups[1].items.map((item) => item.featureKey), ["k1", "k2", "k0", "k3"]);
  assert.deepEqual(projected.groups[2].items.map((item) => item.featureKey), ["k4", "k5"]);
  const filtered = projector(aggregate, { lens: "lane", activeFilters: { status: ["done"] } });
  assert.deepEqual(filtered.groups.find((group) => group.name === "Alpha").items.map((item) => item.featureKey), ["k0", "k1", "k3"]);
  assert.deepEqual(projectWorktreeGroups(aggregate)[0].items.map((item) => item.featureKey), ["k0", "k1", "k2", "k3"]);
  assert.equal(JSON.stringify(aggregate), before);
});
