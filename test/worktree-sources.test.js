import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { discoverWorktreeSources, readWorktreeIdentity } from "../package/minimap/src/worktree-sources.js";

const roots = [];
const git = (cwd, ...args) => execFileSync("git", args, { cwd, windowsHide: true, encoding: "utf8" }).trim();
async function repo() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-worktrees-")); roots.push(root);
  git(root, "init", "-b", "main"); git(root, "config", "user.name", "Test"); git(root, "config", "user.email", "test@example.invalid");
  await fs.writeFile(path.join(root, "file"), "initial\n"); git(root, "add", "file"); git(root, "commit", "-m", "initial");
  return root;
}
afterEach(async () => { for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true }); });

test("discovers registered linked worktrees in Git order and identifies branch or detached context", async () => {
  const root = await repo();
  const one = path.join(root, "..", "linked-one"); const two = path.join(root, "..", "linked-two"); roots.push(one, two);
  git(root, "worktree", "add", "-b", "feature/one", one);
  git(root, "worktree", "add", "--detach", two, "HEAD");
  const result = await discoverWorktreeSources(root);
  assert.deepEqual(result.sources.map((source) => source.repoRoot), [root.toLowerCase(), one.toLowerCase(), two.toLowerCase()]);
  assert.equal(result.sources[1].git.branchRef, "refs/heads/feature/one");
  assert.equal(result.sources[2].git.branchRef, null);
  const before = await readWorktreeIdentity(one);
  await fs.writeFile(path.join(one, "untracked"), "dirty");
  assert.deepEqual((await readWorktreeIdentity(one)).git, before.git);
  git(one, "checkout", "--detach", "HEAD");
  assert.notEqual((await readWorktreeIdentity(one)).git.branchRef, before.git.branchRef);
});

test("non-Git paths fall back cleanly and a separate clone is never a sibling", async () => {
  const root = await repo(); const outside = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-nongit-")); roots.push(outside);
  assert.deepEqual(await discoverWorktreeSources(outside), { sources: [], excluded: [], partial: false, unavailable: { reason: "not-git-or-unavailable" } });
  const clone = path.join(root, "..", "clone"); roots.push(clone); git(root, "clone", "--shared", root, clone);
  const result = await discoverWorktreeSources(root);
  assert.equal(result.sources.some((source) => source.repoRoot === clone.toLowerCase()), false);
});

test("removed worktree registrations are excluded and source discovery is capped", async () => {
  const root = await repo();
  for (let i = 0; i < 17; i += 1) {
    const target = path.join(root, "..", `linked-${i}`); roots.push(target);
    git(root, "worktree", "add", "--detach", target, "HEAD");
  }
  const result = await discoverWorktreeSources(root);
  assert.equal(result.sources.length, 16);
  assert.equal(result.partial, true);
  assert.ok(result.excluded.some((entry) => entry.reason === "source-limit"));
  const removed = path.join(root, "..", "linked-0");
  await fs.rm(removed, { recursive: true, force: true });
  const after = await discoverWorktreeSources(root);
  assert.ok(after.excluded.some((entry) => path.resolve(entry.repoRoot).toLowerCase() === path.resolve(removed).toLowerCase()
    && ["missing-or-unavailable", "prunable"].includes(entry.reason)));
});
