import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { loadWorktreeAggregate } from "../package/minimap/src/worktree-aggregate.js";
import { selectWorktreeParticipantCandidates } from "../package/minimap/src/worktree-presence.js";

const dirs = [];
const git = (cwd, ...args) => execFileSync("git", args, { cwd, windowsHide: true, encoding: "utf8" }).trim();
const item = (id, status = "queued") => `---\nid: ${id}\ntitle: ${id}\nstatus: ${status}\npriority: medium\ncommitment: committed\n---\n\n## Summary\n${id}\n`;
async function write(root, file, text) {
  const target = path.join(root, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, text);
}
async function fixture(ancestorText = item("shared"), extra = 0) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-aggregate-")); dirs.push(dir);
  const main = path.join(dir, "main"), sibling = path.join(dir, "sibling");
  await fs.mkdir(main);
  git(main, "init", "-b", "main"); git(main, "config", "user.name", "Test"); git(main, "config", "user.email", "test@example.invalid");
  git(main, "config", "core.autocrlf", "false");
  await write(main, "roadmap/board.md", "# Now\n- shared\n");
  await write(main, "roadmap/scope.md", "scope\n");
  await write(main, "roadmap/features/shared.md", ancestorText);
  for (let i = 0; i < extra; i += 1) await write(main, `roadmap/features/extra-${i}.md`, item(`extra-${i}`));
  await write(main, "roadmap/ideas/.keep", "");
  git(main, "add", "."); git(main, "commit", "-m", "base");
  git(main, "worktree", "add", "-b", "feature/sibling", sibling);
  return { main, sibling };
}
afterEach(async () => { for (const dir of dirs.splice(0)) await fs.rm(dir, { recursive: true, force: true }); });

test("shared ancestor merges divergent revisions, retains exact source values, and orders opened cards first", async () => {
  const { main, sibling } = await fixture();
  await write(main, "roadmap/features/shared.md", item("shared", "in-progress"));
  await write(sibling, "roadmap/features/shared.md", item("shared", "blocked"));
  await write(sibling, "roadmap/board.md", "# Later\n- shared\n");
  git(main, "add", "roadmap/features/shared.md"); git(main, "commit", "-m", "main changes shared");
  git(sibling, "add", "roadmap/features/shared.md", "roadmap/board.md"); git(sibling, "commit", "-m", "sibling changes shared");
  await write(sibling, "roadmap/features/new.md", item("new")); // valid, untracked, unlisted
  const result = await loadWorktreeAggregate(main);
  assert.equal(result.partial, false);
  assert.equal(result.features.length, 2);
  const shared = result.features.find((feature) => feature.id === "shared");
  assert.deepEqual(shared.groups, [{ name: "Now", kind: "board" }, { name: "Later", kind: "board" }]);
  assert.deepEqual(shared.versions.map((version) => version.summary.status), ["in-progress", "blocked"]);
  assert.notEqual(shared.versions[0].summary.revision, shared.versions[1].summary.revision);
  assert.deepEqual(result.groups.map((group) => group.name), ["Now", "Later", "Not on a board"]);
  assert.equal(result.groups[2].items[0].id, "new");
  assert.equal(result.groups[0].items[0].key, result.groups[1].items[0].key);
});

test("opened-only aggregate is provisional, preserves source keys, and reads no sibling workspace", async () => {
  const { main, sibling } = await fixture();
  const full = await loadWorktreeAggregate(main);
  const originalReadFile = fs.readFile;
  let siblingRead = false;
  fs.readFile = async function (file, ...args) {
    if (String(file).toLowerCase().startsWith(sibling.toLowerCase())) siblingRead = true;
    return originalReadFile.call(this, file, ...args);
  };
  try {
    const provisional = await loadWorktreeAggregate(main, { openedOnly: true });
    assert.equal(provisional.provisional, true);
    assert.equal(provisional.partial, true);
    assert.equal(provisional.coverage.pending, true);
    assert.equal(provisional.sources.length, 1);
    assert.equal(siblingRead, false);
    assert.deepEqual(provisional.features.map(({ key, id, filePath }) => ({ key, id, filePath })),
      full.features.filter((feature) => feature.versions[0].sourceKey === full.sources[0].sourceKey)
        .map(({ key, id, filePath }) => ({ key, id, filePath })));
  } finally { fs.readFile = originalReadFile; }
});

test("opened-only aggregate fails safe when opened identity is unavailable", async () => {
  const result = await loadWorktreeAggregate(path.join(os.tmpdir(), "not-a-git-checkout"), { openedOnly: true });
  assert.equal(result.provisional, true);
  assert.equal(result.partial, true);
  assert.equal(result.coverage.pending, true);
  assert.deepEqual(result.sources, []);
  assert.equal(result.unavailable.reason, "not-git-or-unavailable");
});

test("same-group divergence exposes source-specific status conflict and missing refs", async () => {
  const { main, sibling } = await fixture();
  await write(sibling, "roadmap/features/shared.md", item("shared", "blocked"));
  await write(sibling, "roadmap/board.md", "# Now\n- shared\n- absent\n");
  const result = await loadWorktreeAggregate(main);
  assert.equal(result.groups[0].items[0].versions.length, 2);
  assert.deepEqual(result.groups[0].items[0].conflicts.filter((entry) => entry.field === "status")
    .map((entry) => entry.value), ["queued", "blocked"]);
  assert.equal(result.groups[0].items[1].missing, true);
  assert.deepEqual(result.coverage.missingBoardRefs.map((entry) => entry.itemId), ["absent"]);
});

test("independent same-id creation and delete/readd stay distinct", async () => {
  const { main, sibling } = await fixture();
  git(main, "rm", "roadmap/features/shared.md"); git(main, "commit", "-m", "delete shared");
  await write(main, "roadmap/features/shared.md", item("shared", "done"));
  await write(main, "roadmap/features/independent.md", item("independent"));
  await write(sibling, "roadmap/features/independent.md", item("independent"));
  const result = await loadWorktreeAggregate(main);
  assert.equal(result.features.filter((feature) => feature.id === "shared").length, 2);
  assert.equal(result.features.filter((feature) => feature.id === "independent").length, 2);
  assert.equal(result.groups.find((group) => group.name === "Now").items.length, 2);
});

test("squash-integrated feature keeps one identity across later source edits", async () => {
  const { main, sibling } = await fixture();
  await write(sibling, "roadmap/features/new.md", item("new").replaceAll("\n", "\r\n"));
  await write(sibling, "roadmap/board.md", "# Now\n- shared\n- new\n");
  git(sibling, "add", "roadmap/features/new.md", "roadmap/board.md");
  git(sibling, "commit", "-m", "introduce feature");
  await write(sibling, "roadmap/scope.md", "scope updated by feature\n");
  git(sibling, "add", "roadmap/scope.md"); git(sibling, "commit", "-m", "finish feature change");

  git(main, "merge", "--squash", "feature/sibling");
  git(main, "commit", "-m", "squash feature");
  await write(main, "roadmap/features/new.md", item("new"));
  git(main, "add", "roadmap/features/new.md"); git(main, "commit", "-m", "normalize integrated feature line endings");
  const normalized = await loadWorktreeAggregate(main);
  const normalizedFeature = normalized.features.find((feature) => feature.id === "new");
  assert.equal(normalizedFeature.versions.length, 2);
  assert.equal(normalizedFeature.conflicts.some((entry) => entry.field === "revision"), false);

  await write(main, "roadmap/features/new.md", item("new", "in-progress"));
  git(main, "add", "roadmap/features/new.md"); git(main, "commit", "-m", "edit integrated feature");
  await write(sibling, "roadmap/features/new.md", item("new", "blocked").replaceAll("\n", "\r\n"));
  git(sibling, "add", "roadmap/features/new.md"); git(sibling, "commit", "-m", "edit original feature");

  const result = await loadWorktreeAggregate(main);
  const matches = result.features.filter((feature) => feature.id === "new");
  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0].versions.map((version) => version.summary.status), ["in-progress", "blocked"]);
  assert.ok(matches[0].conflicts.some((entry) => entry.field === "status"));
  assert.ok(matches[0].conflicts.some((entry) => entry.field === "revision"));
  assert.deepEqual(selectWorktreeParticipantCandidates(result).features.filter(({ id }) => id === "new"),
    [{ key: matches[0].key, id: "new" }]);

  git(sibling, "rm", "roadmap/features/new.md"); git(sibling, "commit", "-m", "delete integrated feature");
  await write(sibling, "roadmap/features/new.md", item("new", "blocked").replaceAll("\n", "\r\n"));
  git(sibling, "add", "roadmap/features/new.md"); git(sibling, "commit", "-m", "recreate integrated feature");
  const recreated = await loadWorktreeAggregate(main);
  assert.equal(recreated.features.filter((feature) => feature.id === "new").length, 2);
  assert.deepEqual(selectWorktreeParticipantCandidates(recreated).features.filter(({ id }) => id === "new"), []);
  assert.ok(selectWorktreeParticipantCandidates(recreated).ambiguous.some((entry) => entry.reference === "new"));
});

test("squash-integrated executable regular Markdown file shares identity", async () => {
  const { main, sibling } = await fixture();
  await write(sibling, "roadmap/features/executable.md", item("executable"));
  await write(sibling, "roadmap/scope.md", "executable feature context\n");
  git(sibling, "add", "roadmap/features/executable.md", "roadmap/scope.md");
  git(sibling, "update-index", "--chmod=+x", "roadmap/features/executable.md");
  git(sibling, "commit", "-m", "introduce executable regular feature");
  git(main, "merge", "--squash", "feature/sibling");
  git(main, "commit", "-m", "integrate executable regular feature");
  assert.match(git(main, "ls-tree", "HEAD", "roadmap/features/executable.md"), /^100755 blob/);
  const result = await loadWorktreeAggregate(main);
  const features = result.features.filter(({ id }) => id === "executable");
  assert.equal(result.partial, false);
  assert.equal(features.length, 1);
  assert.equal(features[0].versions.length, 2);
});

test("identical item blobs with different complete changes stay separate", async () => {
  const { main, sibling } = await fixture();
  for (const [root, marker] of [[main, "main"], [sibling, "sibling"]]) {
    await write(root, "roadmap/features/collision.md", item("collision"));
    await write(root, `notes/${marker}.txt`, `${marker}\n`);
    await write(root, "roadmap/board.md", `# Now\n- shared\n- collision\n`);
    git(root, "add", "roadmap/features/collision.md", `notes/${marker}.txt`, "roadmap/board.md");
    git(root, "commit", `-m`, `create collision with ${marker} change`);
  }

  const result = await loadWorktreeAggregate(main);
  const collisions = result.features.filter((feature) => feature.id === "collision");
  assert.equal(collisions.length, 2);
  assert.deepEqual(selectWorktreeParticipantCandidates(result).features.filter(({ id }) => id === "collision"), []);
  assert.equal(selectWorktreeParticipantCandidates(result).ambiguous.some((entry) => entry.reference === "collision"), true);
});

test("identical complete committed transitions are accepted as equivalent", async () => {
  const { main, sibling } = await fixture();
  for (const [root, name] of [[main, "main"], [sibling, "sibling"]]) {
    await write(root, "roadmap/features/reproduced.md", item("reproduced"));
    await write(root, "notes/shared-transition.txt", "same complete ancillary change\n");
    await write(root, "roadmap/board.md", "# Now\n- shared\n- reproduced\n");
    git(root, "add", "roadmap/features/reproduced.md", "notes/shared-transition.txt", "roadmap/board.md");
    git(root, "commit", "-m", `reproduce complete transition from ${name}`);
  }

  const mainHead = git(main, "rev-parse", "HEAD"), siblingHead = git(sibling, "rev-parse", "HEAD");
  assert.notEqual(mainHead, siblingHead);
  const base = git(main, "merge-base", mainHead, siblingHead);
  assert.equal(git(main, "ls-tree", "--name-only", base, "roadmap/features/reproduced.md"), "");
  const result = await loadWorktreeAggregate(main);
  const matches = result.features.filter((feature) => feature.id === "reproduced");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].versions.length, 2);
  assert.deepEqual(selectWorktreeParticipantCandidates(result).features.filter(({ id }) => id === "reproduced"),
    [{ key: matches[0].key, id: "reproduced" }]);
});

test("identity evidence beyond the first 64 commits fails closed", async () => {
  const { main, sibling } = await fixture();
  await write(sibling, "roadmap/features/new.md", item("new"));
  git(sibling, "add", "roadmap/features/new.md"); git(sibling, "commit", "-m", "introduce feature");
  for (let index = 0; index < 63; index += 1) git(sibling, "commit", "--allow-empty", "-m", `history ${index}`);
  git(main, "merge", "--squash", "feature/sibling");
  git(main, "commit", "-m", "squash long feature history");

  const atLimit = await loadWorktreeAggregate(main);
  assert.equal(atLimit.partial, false);
  assert.equal(atLimit.features.filter((feature) => feature.id === "new").length, 1);
  assert.equal(atLimit.features.find((feature) => feature.id === "shared").versions.length, 2);

  git(sibling, "commit", "--allow-empty", "-m", "history past cap");
  const result = await loadWorktreeAggregate(main);
  assert.equal(result.partial, true);
  assert.equal(result.features.filter((feature) => feature.id === "new").length, 2);
  assert.equal(result.features.find((feature) => feature.id === "shared").versions.length, 2);
  assert.ok(result.coverage.identityUncertain.some((entry) => entry.reason === "squash-evidence-limit"));
});

test("missing merge-base history fails closed", async () => {
  const { main, sibling } = await fixture();
  git(sibling, "checkout", "--orphan", "unrelated");
  git(sibling, "rm", "-r", "--cached", ".");
  await write(sibling, "roadmap/board.md", "# Now\n- shared\n");
  await write(sibling, "roadmap/scope.md", "unrelated scope\n");
  await write(sibling, "roadmap/features/shared.md", item("shared"));
  await write(sibling, "roadmap/ideas/.keep", "");
  git(sibling, "add", "."); git(sibling, "commit", "-m", "unrelated root");

  const result = await loadWorktreeAggregate(main);
  assert.equal(result.partial, true);
  assert.equal(result.features.filter((feature) => feature.id === "shared").length, 2);
  assert.ok(result.coverage.identityUncertain.length > 0);
});

test("raw change-record budget preserves separate identities", async () => {
  const { main, sibling } = await fixture();
  await write(sibling, "roadmap/features/new.md", item("new"));
  await write(sibling, "roadmap/board.md", "# Now\n- shared\n- new\n");
  await fs.mkdir(path.join(sibling, "notes"), { recursive: true });
  await Promise.all(Array.from({ length: 4095 }, (_, index) => fs.writeFile(
    path.join(sibling, "notes", `change-${index}.txt`), "changed\n")));
  git(sibling, "add", "roadmap/features/new.md", "roadmap/board.md", "notes");
  git(sibling, "commit", "-m", "add feature and many ancillary changes");
  git(main, "merge", "--squash", "feature/sibling"); git(main, "commit", "-m", "squash large transition");

  const result = await loadWorktreeAggregate(main);
  assert.equal(result.partial, true);
  assert.equal(result.features.filter((feature) => feature.id === "new").length, 2);
  assert.equal(result.features.find((feature) => feature.id === "shared").versions.length, 2);
  assert.ok(result.coverage.identityUncertain.some((entry) => entry.reason === "squash-evidence-limit"));
});

test("global history-load budget fails closed across branch pairs", async () => {
  const { main } = await fixture();
  const bases = [];
  for (let index = 0; index < 9; index += 1) {
    await write(main, `history/step-${index}.txt`, `${index}\n`);
    git(main, "add", `history/step-${index}.txt`); git(main, "commit", "-m", `base step ${index}`);
    bases.push(git(main, "rev-parse", "HEAD"));
  }
  for (let index = 0; index < bases.length; index += 1) {
    const linked = path.join(path.dirname(main), `history-${index}`);
    git(main, "worktree", "add", "--detach", linked, bases[index]);
    await write(linked, "roadmap/features/repeated.md", item("repeated"));
    await write(linked, "roadmap/board.md", "# Now\n- shared\n- repeated\n");
    await write(linked, `notes/branch-${index}.txt`, `${index}\n`);
    git(linked, "add", "roadmap/features/repeated.md", "roadmap/board.md", `notes/branch-${index}.txt`);
    git(linked, "commit", "-m", `introduce independent repeated feature ${index}`);
  }

  const result = await loadWorktreeAggregate(main);
  assert.equal(result.partial, true);
  assert.ok(result.features.filter((feature) => feature.id === "repeated").length > 1);
  assert.equal(result.features.find((feature) => feature.id === "shared").versions.length, result.coverage.loaded);
  assert.ok(result.coverage.identityUncertain.some((entry) => entry.reason === "squash-evidence-limit"));
});

test("source-specific display config stays compatible and its supported lens values are unioned", async () => {
  const { main, sibling } = await fixture();
  await write(main, "roadmap.config.json", JSON.stringify({ roadmapPath: "roadmap", defaultLens: "board",
    lenses: { fields: { status: { order: ["queued", "in-progress"] } } } }));
  await write(sibling, "roadmap.config.json", JSON.stringify({ roadmapPath: "./roadmap", defaultLens: "status",
    lenses: { fields: { status: { order: ["blocked", "done"] } } } }));
  await write(main, "roadmap/features/main-only.md", item("main-only", "in-progress"));
  await write(sibling, "roadmap/features/sibling-only.md", item("sibling-only", "blocked"));
  const result = await loadWorktreeAggregate(main);
  assert.equal(result.partial, false);
  assert.equal(result.coverage.loaded, 2);
  assert.deepEqual(result.workspace.availableLenses.find((entry) => entry.key === "status").values,
    ["queued", "in-progress", "blocked", "done"]);
  assert.equal(result.sources[1].availableLenses.find((entry) => entry.key === "status").values[0], "blocked");
  assert.deepEqual(new Set(result.workspace.availableFilters.find((entry) => entry.key === "status").values),
    new Set(["queued", "in-progress", "blocked"]));
  assert.equal(result.features[0].versions.length, 2);
});

test("sibling setup failure is partial and leaves opened roadmap usable", async () => {
  const { main, sibling } = await fixture();
  await fs.rm(path.join(sibling, "roadmap/board.md"));
  const result = await loadWorktreeAggregate(main);
  assert.equal(result.partial, true);
  assert.equal(result.coverage.loaded, 1);
  assert.equal(result.excluded.at(-1).reason, "workspace-load-failed");
  assert.equal(result.features.length, 1);
});

test("format-only config differences combine and board heading cannot absorb unlisted items", async () => {
  const { main, sibling } = await fixture();
  await write(main, "roadmap.config.json", '{"roadmapPath":"roadmap","filters":{"fields":["team"]}}');
  await write(sibling, "roadmap.config.json", '{\n  "filters": { "fields": ["team"] },\n  "roadmapPath": "./roadmap"\n}');
  await write(main, "roadmap/board.md", "# Not on a board\n- shared\n");
  await write(main, "roadmap/features/loose.md", item("loose"));
  const result = await loadWorktreeAggregate(main);
  assert.equal(result.coverage.loaded, 2);
  assert.deepEqual(result.groups.filter((group) => group.name === "Not on a board").map((group) => group.kind), ["board", "unlisted"]);
  assert.equal(result.groups.find((group) => group.kind === "unlisted").items[0].id, "loose");
});

test("same path with changed ancestor id cannot merge", async () => {
  const { main, sibling } = await fixture();
  await write(main, "roadmap/features/shared.md", item("renamed"));
  await write(main, "roadmap/board.md", "# Now\n- renamed\n");
  await write(sibling, "roadmap/features/shared.md", item("renamed"));
  await write(sibling, "roadmap/board.md", "# Now\n- renamed\n");
  const result = await loadWorktreeAggregate(main);
  assert.equal(result.features.filter((feature) => feature.id === "renamed").length, 2);
});

test("quoted ancestor frontmatter id is parsed by the roadmap parser", async () => {
  const { main } = await fixture(item("shared").replace("id: shared", "id: 'shared'"));
  const result = await loadWorktreeAggregate(main);
  assert.equal(result.features.filter((feature) => feature.id === "shared").length, 1);
  assert.equal(result.features[0].versions.length, 2);
});

test("different roadmap roots remain separate namespaces", async () => {
  const { main, sibling } = await fixture();
  await write(sibling, "roadmap.config.json", JSON.stringify({ roadmapPath: "planning" }));
  await fs.rename(path.join(sibling, "roadmap"), path.join(sibling, "planning"));
  const result = await loadWorktreeAggregate(main);
  assert.equal(result.coverage.loaded, 1);
  assert.equal(result.excluded.at(-1).reason, "incompatible-roadmap-config");
});

test("ancestor cap is inclusive at 500 and reports uncertain identity at 501", async () => {
  const { main, sibling } = await fixture(item("shared"), 499);
  const atLimit = await loadWorktreeAggregate(main);
  assert.equal(atLimit.partial, false);
  assert.equal(atLimit.features.filter((feature) => feature.id === "shared").length, 1);
  await write(main, "roadmap/features/extra-499.md", item("extra-499"));
  git(main, "add", "roadmap/features/extra-499.md"); git(main, "commit", "-m", "reach 501 items");
  git(sibling, "merge", "--ff-only", "main");
  const overLimit = await loadWorktreeAggregate(main);
  assert.equal(overLimit.partial, true);
  assert.equal(overLimit.coverage.identityUncertain[0].reason, "ancestor-item-limit");
  assert.equal(overLimit.features.filter((feature) => feature.id === "shared").length, 2);
});

test("line-ending-only copies keep raw revisions but have no display conflict", async () => {
  const { main, sibling } = await fixture();
  await write(sibling, "roadmap/features/shared.md", item("shared").replaceAll("\n", "\r\n"));
  const result = await loadWorktreeAggregate(main);
  const shared = result.features.find((feature) => feature.id === "shared");
  assert.notEqual(shared.versions[0].summary.revision, shared.versions[1].summary.revision);
  assert.deepEqual(shared.conflicts, []);
  assert.deepEqual(result.groups[0].items[0].conflicts, []);
});

test("84 items keep source contexts small instead of repeating workspace per version", async () => {
  const { main } = await fixture(item("shared"), 83);
  const result = await loadWorktreeAggregate(main);
  const context = result.features[0].versions[0].sourceContext;
  assert.deepEqual(Object.keys(context), ["sourceKey", "repoRoot", "label", "git", "roadmapBinding"]);
  assert.ok(JSON.stringify(result).length < 1_000_000);
});

test("a checkout moving during the scan cannot publish mixed branch and file evidence", async () => {
  const { main, sibling } = await fixture();
  const originalReadFile = fs.readFile;
  let moved = false;
  fs.readFile = async function (file, ...args) {
    if (!moved && String(file).toLowerCase() === path.join(sibling, "roadmap", "board.md").toLowerCase()) {
      moved = true;
      git(sibling, "switch", "-c", "moved-during-scan");
    }
    return originalReadFile.call(this, file, ...args);
  };
  try {
    const result = await loadWorktreeAggregate(main);
    assert.equal(moved, true);
    assert.equal(result.partial, true);
    assert.equal(result.unavailable.reason, "source-changed-during-read");
    assert.equal(result.workspace, null);
    assert.deepEqual(result.features, []);
    assert.deepEqual(result.groups, []);
  } finally {
    fs.readFile = originalReadFile;
  }
});
