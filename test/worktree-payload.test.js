import assert from "node:assert/strict";
import test from "node:test";
import { compactWorktreePayload, expandWorktreePayload } from "../package/minimap/ui/worktree-payload.js";

function fixture() {
  const sources = ["blue", "green"].map((sourceKey) => ({ sourceKey, repoRoot: `C:/fixtures/${sourceKey} ü`,
    label: sourceKey, git: { gitDir: `C:/fixtures/${sourceKey}/.git`, commonDir: "C:/fixtures/common",
      gitDirIdentity: [1, 2, 3], commonDirIdentity: [1, 4, 5], headCommit: "a".repeat(40), branchRef: `refs/heads/${sourceKey}` },
    roadmapBinding: { roadmapPath: "roadmap", resolvedPath: `C:/fixtures/${sourceKey} ü/roadmap` },
    availableLenses: [], availableFilters: [] }));
  const context = (source) => { const { sourceKey, repoRoot, label, git, roadmapBinding } = source;
    return { sourceKey, repoRoot, label, git, roadmapBinding }; };
  const version = (source, group, status) => ({ sourceKey: source.sourceKey, repoRoot: source.repoRoot,
    itemId: "alpha", group, groupKind: "board", sourceContext: context(source),
    summary: { id: "alpha", status, revision: status, filePath: `${source.repoRoot}/roadmap/features/a ü.md`,
      metadata: { team: ["one", "two"] }, specSession: { file: "a ü.md", unresolved: 1 } } });
  const versions = [version(sources[0], "Now", "queued"), version(sources[0], "Later", "queued"), version(sources[1], "Now", "blocked")];
  const missing = { key: "missing", id: "absent", missing: true, conflicts: [], versions: [{
    ...version(sources[1], "Now", ""), itemId: "absent", summary: { id: "absent", missing: true } }] };
  return { sources, openedRepoRoot: sources[0].repoRoot, workspace: { roadmapPath: "roadmap" },
    features: [{ key: "alpha-key", id: "alpha", filePath: "roadmap/features/a ü.md", versions,
      groups: [{ name: "Now", kind: "board" }, { name: "Later", kind: "board" }], conflicts: [{ field: "status", sourceKey: "green", value: "blocked" }] }],
    groups: [{ name: "Now", kind: "board", items: [{ key: "alpha-key", id: "alpha", versions: [versions[0], versions[2]], conflicts: [{ field: "status", value: "blocked" }] }, missing] },
      { name: "Later", kind: "board", items: [{ key: "alpha-key", id: "alpha", versions: [versions[1]], conflicts: [] }] }],
    partial: true, provisional: true, excluded: [{ reason: "unavailable" }],
    coverage: { loaded: 2, pending: true, identityUncertain: [{ reason: "ancestor-item-limit" }], missingBoardRefs: [{ itemId: "absent" }] },
    snapshot: { id: "retained", stale: true }, participantCounts: { status: "disabled", partial: true } };
}

test("compact payload round-trips contexts, placements, missing refs and partial observations without mutation", () => {
  const full = fixture(), original = structuredClone(full);
  const compact = compactWorktreePayload(full);
  assert.deepEqual(full, original);
  assert.ok(compact.features.every((feature) => feature.versions.every((version) => !Object.hasOwn(version, "sourceContext"))));
  assert.deepEqual(compact.groups[0].items[0].versionIndexes, [0, 2]);
  assert.deepEqual(compact.groups[1].items[0].versionIndexes, [1]);
  assert.equal(Object.hasOwn(compact.groups[0].items[0], "versions"), false);
  assert.equal(compact.groups[0].items[1].versions[0].sourceKey, "green");
  assert.ok(JSON.stringify(compact).length < JSON.stringify(full).length * 0.7);
  const wire = JSON.parse(JSON.stringify(compact)), before = structuredClone(wire);
  assert.deepEqual(expandWorktreePayload(wire), JSON.parse(JSON.stringify(full)));
  assert.deepEqual(wire, before);
});

test("unavailable and empty provisional payloads retain their observation", () => {
  const full = { sources: [], features: [], groups: [], workspace: null, partial: true,
    provisional: true, unavailable: { reason: "not-git" }, coverage: { pending: true, loaded: 0 } };
  assert.deepEqual(expandWorktreePayload(compactWorktreePayload(full)), full);
  assert.equal(expandWorktreePayload(full), full);
});

test("compact decoder rejects missing/duplicate identities and invalid version references", () => {
  for (const corrupt of [
    (p) => { p.worktreeFormat = "compact-v2"; },
    (p) => { p.sources.push(p.sources[0]); },
    (p) => { p.features.push(p.features[0]); },
    (p) => { p.features[0].versions[0].sourceKey = "unknown"; },
    (p) => { p.groups[0].items[1].versions[0].sourceKey = "unknown"; },
    (p) => { p.groups[0].items[0].key = "unknown"; },
    (p) => { p.groups[0].items[0].versionIndexes = [99]; },
    (p) => { p.groups[0].items[0].versionIndexes = [0.5]; },
    (p) => { p.groups[0].items[0].versionIndexes = [-1]; },
    (p) => { p.groups[0].items[0].versionIndexes = [1]; },
  ]) {
    const payload = compactWorktreePayload(fixture()); corrupt(payload);
    assert.throws(() => expandWorktreePayload(payload), { code: "invalid_worktree_payload" });
  }
});
