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
