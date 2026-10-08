import test from "node:test";
import assert from "node:assert/strict";
import * as worktrees from "../package/minimap/ui/worktrees.js";

test("projection reuse keys all view inputs without mutating the aggregate", () => {
  const aggregate = { workspace: {}, features: [], groups: [] };
  const before = structuredClone(aggregate);
  const project = worktrees.createWorktreeProjector();
  const participants = new Map();
  const options = { lens: "board", searchQuery: "", activeFilters: {}, inPlay: false, showEmptyGroups: true, participantCounts: participants };
  const first = project(aggregate, options);
  assert.equal(project(aggregate, { ...options }), first);
  for (const changed of [{ searchQuery: "alpha" }, { lens: "status" }, { activeFilters: { status: ["active"] } }, { inPlay: true }, { showEmptyGroups: false }, { participantCounts: new Map() }]) {
    assert.notEqual(project(aggregate, { ...options, ...changed }), first);
    assert.notEqual(project(aggregate, options), first); // Only the last projection is retained.
  }
  assert.deepEqual(aggregate, before);
  assert.equal(first.items.size, 0);
});

test("cached projections preserve each matching source's Spec summary", () => {
  const versions = ["main", "blue"].map((sourceKey, index) => ({
    sourceKey, itemId: "alpha", group: "Now", groupKind: "board",
    summary: { id: "alpha", title: sourceKey, searchText: sourceKey, metadata: {},
      specSession: { targetFile: `/${sourceKey}/alpha.md`, openComments: index + 1 } },
  }));
  const feature = { key: "alpha-key", id: "alpha", versions };
  const aggregate = { workspace: {}, features: [feature], groups: [{ name: "Now", kind: "board", items: [feature] }] };
  const before = structuredClone(aggregate);
  const project = worktrees.createWorktreeProjector();
  const first = project(aggregate);
  assert.equal(first.groups[0].items[0].sourceVersion.summary.specSession.openComments, 1);
  const filtered = project(aggregate, { searchQuery: "blue" });
  assert.equal(filtered.groups[0].items[0].sourceVersion.summary.specSession.openComments, 2);
  assert.equal(filtered.items.get(filtered.groups[0].items[0].id), filtered.groups[0].items[0]);
  assert.notEqual(project(structuredClone(aggregate), { searchQuery: "blue" }), filtered);
  assert.deepEqual(aggregate, before);
});
