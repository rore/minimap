import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { loadWorktreeAggregate } from "../package/minimap/src/worktree-aggregate.js";

const dirs = [];
const git = (cwd, ...args) => execFileSync("git", args, { cwd, windowsHide: true, encoding: "utf8" }).trim();
const item = (id, status = "queued") => `---\nid: ${id}\ntitle: ${id}\nstatus: ${status}\npriority: medium\ncommitment: committed\n---\n\n## Summary\n${id}\n`;
async function write(root, file, text) {
  const target = path.join(root, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, text);
}
async function fixture(ancestorText = item("shared")) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-aggregate-")); dirs.push(dir);
  const main = path.join(dir, "main"), sibling = path.join(dir, "sibling");
  await fs.mkdir(main);
  git(main, "init", "-b", "main"); git(main, "config", "user.name", "Test"); git(main, "config", "user.email", "test@example.invalid");
  await write(main, "roadmap/board.md", "# Now\n- shared\n");
  await write(main, "roadmap/scope.md", "scope\n");
  await write(main, "roadmap/features/shared.md", ancestorText);
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
