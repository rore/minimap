import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readWorktreeIdentity } from "../package/minimap/src/worktree-sources.js";
import { requirePathInSource, requireRoadmapInSource, verifySourceContext } from "../package/minimap/src/source-bound.js";

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
}

test("bound context survives named-branch commits but rejects checkout replacement or branch switches", async (t) => {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-bound-"));
  t.after(() => fs.rm(owned, { recursive: true, force: true }));
  const root = path.join(owned, "repo");
  await fs.mkdir(root);
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.invalid");
  await fs.writeFile(path.join(root, "file"), "first\n");
  git(root, "add", "file");
  git(root, "commit", "-m", "first");
  const identity = await readWorktreeIdentity(root);
  await verifySourceContext(root, identity);
  await fs.writeFile(path.join(root, "file"), "second\n");
  git(root, "commit", "-am", "second");
  await verifySourceContext(root, identity);
  git(root, "switch", "-c", "other");
  await assert.rejects(verifySourceContext(root, identity), { code: "source_changed" });
});

test("bound paths reject symlink escapes, including config before it is read", async (t) => {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-bound-path-"));
  t.after(() => fs.rm(owned, { recursive: true, force: true }));
  const root = path.join(owned, "repo");
  const outside = path.join(owned, "outside.md");
  await fs.mkdir(root);
  await fs.writeFile(outside, "outside\n");
  await assert.rejects(requirePathInSource(root, outside), { code: "source_path_escape" });
  const symlink = path.join(root, "roadmap.config.json");
  await fs.symlink(outside, symlink, "file");
  await assert.rejects(requireRoadmapInSource(root), { code: "source_path_escape" });
});
