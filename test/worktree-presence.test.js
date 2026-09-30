import assert from "node:assert/strict";
import test from "node:test";
import { selectWorktreeParticipantCandidates as select } from "../package/minimap/src/worktree-presence.js";

const feature = (key, id, ...statuses) => ({ key, id, versions: statuses.map((status) => ({ summary: { status } })) });

test("deduplicates board appearances and includes mixed done/unfinished versions", () => {
  const shared = feature("shared", "shared", "done", "queued");
  assert.deepEqual(select({ features: [shared, shared], groups: [{ items: [shared, shared] }] }), {
    features: [{ key: "shared", id: "shared" }], partial: false, ambiguous: [],
  });
  assert.deepEqual(select({ features: [feature("done", "done", "done")] }).features, []);
  assert.deepEqual(select({ features: [feature("done", "done", "done")] }, { includeCompleted: true }).features,
    [{ key: "done", id: "done" }]);
});

test("excludes independent same-ID features, including NFC-equivalent IDs", () => {
  const result = select({ features: [
    feature("first", "same", "queued"), feature("second", "same", "done"),
    feature("third", "é", "queued"), feature("fourth", "e\u0301", "queued"),
  ] });
  assert.deepEqual(result.features, []);
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
