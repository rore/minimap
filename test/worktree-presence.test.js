import assert from "node:assert/strict";
import test from "node:test";
import { selectBoardParticipantCandidates, selectWorktreeParticipantCandidates as select } from "../package/minimap/src/worktree-presence.js";

const feature = (key, id, ...statuses) => ({ key, id, versions: statuses.map((status) => ({ summary: { status } })) });

test("deduplicates board appearances and includes mixed done/unfinished versions", () => {
  const shared = feature("shared", "shared", "done", "queued");
  assert.deepEqual(select({ features: [shared, shared], groups: [{ items: [shared, shared] }] }), {
    features: [{ key: "shared", id: "shared" }], partial: false, ambiguous: [],
  });
  assert.deepEqual(select({ features: [feature("done", "done", "done")] }).features, []);
  assert.deepEqual(select({ features: [feature("done", "done", "done")] }, { includeCompleted: true }).features,
    [{ key: "done", id: "done" }]);
  const completed = { features: [feature("completed", "completed", "Shipped", " done ")] };
  assert.deepEqual(select(completed).features, []);
  assert.deepEqual(select(completed, { includeCompleted: true }).features,
    [{ key: "completed", id: "completed" }]);
});

test("excludes independent same-ID features, including NFC-equivalent IDs", () => {
  const result = select({ features: [
    feature("first", "same", "queued"), feature("second", "same", "done"),
    feature("third", "é", "queued"), feature("fourth", "e\u0301", "queued"),
  ] });
  assert.deepEqual(result.features, []);
  assert.equal(result.partial, false);
  assert.deepEqual(result.ambiguous, [
    { reference: "same", keys: ["first", "second"] },
    { reference: "%C3%A9", keys: ["third", "fourth"] },
  ]);
});

test("caps lookup at 200 and reports partial", () => {
  const result = select({ features: Array.from({ length: 201 }, (_, index) => feature(String(index), String(index), "queued")) });
  assert.equal(result.features.length, 200);
  assert.equal(result.partial, true);
  assert.deepEqual(result.ambiguous, []);
});

test("unfinished candidates precede completed ones before the 200-reference cap", () => {
  const features = Array.from({ length: 200 }, (_, index) => feature(`done-${index}`, `done-${index}`, "done"));
  features.push(feature("unfinished", "unfinished", "queued"));
  features.push(feature("ambiguous-a", "same", "queued"), feature("ambiguous-b", "same", "done"));

  const result = select({ features }, { includeCompleted: true });
  assert.equal(result.features.length, 200);
  assert.equal(result.features[0].key, "unfinished");
  assert.equal(result.features.at(-1).key, "done-198");
  assert.equal(result.partial, true);
  assert.deepEqual(result.ambiguous, [{ reference: "same", keys: ["ambiguous-a", "ambiguous-b"] }]);
});

test("board unfinished candidates precede completed ones before the 200-reference cap", () => {
  const items = Array.from({ length: 200 }, (_, index) => ({ id: `done-${index}` }));
  items.push({ id: "unfinished" });
  const workspace = {
    boardGroups: [{ items }],
    items: Object.fromEntries(items.map(({ id }) => [id, { id, status: id === "unfinished" ? "queued" : "done" }])),
  };
  const result = selectBoardParticipantCandidates(workspace, { includeCompleted: true });
  assert.equal(result.ids.length, 200);
  assert.equal(result.ids[0], "unfinished");
  assert.equal(result.ids.at(-1), "done-198");
  assert.equal(result.partial, true);
});
