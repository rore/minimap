import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeFilterValues,
  normalizeFilterMap,
  itemMatchesFilters,
  filterBoardItemIds,
  getItemLensGroupValue,
  buildDerivedVisibleGroups,
} from "../package/minimap/ui/filters.js";

test("normalizeFilterValues: array passes through trimmed and non-empty", () => {
  assert.deepEqual(normalizeFilterValues([" a", "b ", "  ", "c"]), ["a", "b", "c"]);
});

test("normalizeFilterValues: scalar becomes single-element array", () => {
  assert.deepEqual(normalizeFilterValues("foo"), ["foo"]);
  assert.deepEqual(normalizeFilterValues(""), []);
  assert.deepEqual(normalizeFilterValues(null), []);
});

test("normalizeFilterMap: drops empty keys and empty value arrays, sorts/dedupes values", () => {
  const result = normalizeFilterMap({
    status: ["queued", "queued", "done"],
    "  ": ["x"],
    priority: [],
  });
  assert.deepEqual(result, { status: ["done", "queued"] });
});

test("itemMatchesFilters: empty context matches anything", () => {
  assert.equal(itemMatchesFilters({ id: "a", metadata: {} }, {}), true);
});

test("itemMatchesFilters: searchQuery matches against searchText substring", () => {
  const item = { id: "a", searchText: "hello world body", metadata: {} };
  assert.equal(itemMatchesFilters(item, { searchQuery: "world" }), true);
  assert.equal(itemMatchesFilters(item, { searchQuery: "missing" }), false);
});

test("itemMatchesFilters: filter key requires at least one selected value to match", () => {
  const item = { id: "a", metadata: { status: ["queued"] } };
  assert.equal(itemMatchesFilters(item, { activeFilters: { status: ["done"] } }), false);
  assert.equal(itemMatchesFilters(item, { activeFilters: { status: ["queued"] } }), true);
});

test("itemMatchesFilters: returns false for null item", () => {
  assert.equal(itemMatchesFilters(null, {}), false);
});

test("filterBoardItemIds: with no filters returns all non-missing ids in board order", () => {
  const workspace = {
    boardGroups: [
      { name: "G1", items: [{ id: "a" }, { id: "b" }] },
      { name: "G2", items: [{ id: "c", missing: true }, { id: "d" }] },
    ],
    items: { a: {}, b: {}, d: {} },
  };
  assert.deepEqual(filterBoardItemIds(workspace), ["a", "b", "d"]);
});

test("filterBoardItemIds: with searchQuery filters by item.searchText", () => {
  const workspace = {
    boardGroups: [{ name: "G", items: [{ id: "a" }, { id: "b" }] }],
    items: {
      a: { id: "a", searchText: "alpha" },
      b: { id: "b", searchText: "beta" },
    },
  };
  assert.deepEqual(filterBoardItemIds(workspace, { searchQuery: "beta" }), ["b"]);
});

test("filterBoardItemIds: empty workspace returns empty", () => {
  assert.deepEqual(filterBoardItemIds(null), []);
  assert.deepEqual(filterBoardItemIds(undefined), []);
});

test("getItemLensGroupValue: default lens returns empty", () => {
  const item = { metadata: { status: ["queued"] } };
  assert.equal(getItemLensGroupValue(item, "board", { defaultLensKey: "board", unassignedKey: "__unassigned__" }), "");
});

test("getItemLensGroupValue: kind lens reads item.kind", () => {
  const item = { kind: "feature", metadata: {} };
  assert.equal(getItemLensGroupValue(item, "kind", { defaultLensKey: "board", unassignedKey: "__u__" }), "feature");
});

test("getItemLensGroupValue: status lens reads first value, falls back to unassigned", () => {
  assert.equal(
    getItemLensGroupValue({ metadata: { status: ["queued", "blocked"] } }, "status", { defaultLensKey: "board", unassignedKey: "__u__" }),
    "queued",
  );
  assert.equal(
    getItemLensGroupValue({ metadata: {} }, "status", { defaultLensKey: "board", unassignedKey: "__u__" }),
    "__u__",
  );
});

test("buildDerivedVisibleGroups: groups items by lens key and preserves preferred order", () => {
  const workspace = {
    boardGroups: [{ name: "G", items: [{ id: "a" }, { id: "b" }, { id: "c" }] }],
    items: {
      a: { id: "a", metadata: { status: ["queued"] }, searchText: "" },
      b: { id: "b", metadata: { status: ["done"] }, searchText: "" },
      c: { id: "c", metadata: { status: ["queued"] }, searchText: "" },
    },
  };
  const lens = { key: "status", values: ["queued", "done"], draggable: true };
  const groups = buildDerivedVisibleGroups(workspace, lens, {
    defaultLensKey: "board",
    unassignedKey: "__u__",
    unassignedLabel: "Unassigned",
  });
  assert.equal(groups.length, 2);
  assert.equal(groups[0].name, "queued");
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[1].name, "done");
  assert.equal(groups[1].items.length, 1);
  assert.equal(groups[0].draggable, true);
});

test("buildDerivedVisibleGroups: empty preferred values still groups by encountered values", () => {
  const workspace = {
    boardGroups: [{ name: "G", items: [{ id: "a" }] }],
    items: { a: { id: "a", metadata: { status: ["queued"] }, searchText: "" } },
  };
  const groups = buildDerivedVisibleGroups(
    workspace,
    { key: "status", values: [], draggable: false },
    { defaultLensKey: "board", unassignedKey: "__u__", unassignedLabel: "Unassigned" },
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "queued");
});

test("buildDerivedVisibleGroups: showEmptyGroups keeps preferred values with no items", () => {
  const workspace = {
    boardGroups: [{ name: "G", items: [{ id: "a" }] }],
    items: { a: { id: "a", metadata: { status: ["queued"] }, searchText: "" } },
  };
  const groups = buildDerivedVisibleGroups(
    workspace,
    { key: "status", values: ["queued", "done"], draggable: false },
    { defaultLensKey: "board", unassignedKey: "__u__", unassignedLabel: "Unassigned", showEmptyGroups: true },
  );
  assert.equal(groups.length, 2);
  assert.equal(groups[1].name, "done");
  assert.equal(groups[1].items.length, 0);
});

test("buildDerivedVisibleGroups: items without the lens key go into Unassigned group at the end", () => {
  const workspace = {
    boardGroups: [{ name: "G", items: [{ id: "a" }, { id: "b" }] }],
    items: {
      a: { id: "a", metadata: { status: ["queued"] }, searchText: "" },
      b: { id: "b", metadata: {}, searchText: "" },
    },
  };
  const groups = buildDerivedVisibleGroups(
    workspace,
    { key: "status", values: ["queued"], draggable: false },
    { defaultLensKey: "board", unassignedKey: "__u__", unassignedLabel: "Unassigned" },
  );
  assert.equal(groups.length, 2);
  assert.equal(groups[1].name, "Unassigned");
  assert.equal(groups[1].draggable, false);
});
