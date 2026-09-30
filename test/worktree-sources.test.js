import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { discoverWorktreeSources, readWorktreeIdentity } from "../package/minimap/src/worktree-sources.js";

const containers = [];
const git = (cwd, ...args) => execFileSync("git", args, { cwd, windowsHide: true, encoding: "utf8" }).trim();
async function repo() {
  const container = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-worktrees-")); containers.push(container);
  const root = path.join(container, "repo"); await fs.mkdir(root);
  git(root, "init", "-b", "main"); git(root, "config", "user.name", "Test"); git(root, "config", "user.email", "test@example.invalid");
  await fs.writeFile(path.join(root, "file"), "initial\n"); git(root, "add", "file"); git(root, "commit", "-m", "initial");
  return root;
}
afterEach(async () => { for (const container of containers.splice(0)) await fs.rm(container, { recursive: true, force: true }); });

test("discovers registered linked worktrees in Git order and identifies branch or detached context", async () => {
  const root = await repo();
  const one = path.join(path.dirname(root), "linked-one"); const two = path.join(path.dirname(root), "linked-two");
  git(root, "worktree", "add", "-b", "feature/one", one);
  git(root, "worktree", "add", "--detach", two, "HEAD");
  const result = await discoverWorktreeSources(root);
  const canonical = (value) => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
  assert.deepEqual(result.sources.map((source) => source.repoRoot), [root, one, two].map(canonical));
  assert.equal(result.sources[1].git.branchRef, "refs/heads/feature/one");
  assert.equal(result.sources[2].git.branchRef, null);
  const before = await readWorktreeIdentity(one);
  await fs.writeFile(path.join(one, "untracked"), "dirty");
  assert.deepEqual((await readWorktreeIdentity(one)).git, before.git);
  git(one, "checkout", "--detach", "HEAD");
  assert.notEqual((await readWorktreeIdentity(one)).git.branchRef, before.git.branchRef);
  await fs.rm(two, { recursive: true, force: true });
  const afterRemoval = await discoverWorktreeSources(root);
  assert.equal(afterRemoval.partial, true);
  assert.ok(afterRemoval.excluded.some((entry) => canonical(entry.repoRoot) === canonical(two)
    && ["missing-or-unavailable", "prunable"].includes(entry.reason)));
});

test("non-Git paths fall back cleanly and a separate clone is never a sibling", async () => {
  const root = await repo(); const container = path.dirname(root);
  const outside = path.join(container, "nongit"); await fs.mkdir(outside);
  assert.deepEqual(await discoverWorktreeSources(outside), { sources: [], excluded: [], partial: false, unavailable: { reason: "not-git-or-unavailable" } });
  const clone = path.join(container, "clone"); git(root, "clone", "--shared", root, clone);
  const result = await discoverWorktreeSources(root);
  assert.equal(result.sources.some((source) => source.repoRoot === (process.platform === "win32" ? clone.toLowerCase() : clone)), false);
});

test("source discovery is capped", async () => {
  const root = await repo();
  for (let i = 0; i < 17; i += 1) {
    const target = path.join(path.dirname(root), `linked-${i}`);
    git(root, "worktree", "add", "--detach", target, "HEAD");
  }
  const result = await discoverWorktreeSources(root);
  assert.equal(result.sources.length, 16);
  assert.equal(result.partial, true);
  assert.ok(result.excluded.some((entry) => entry.reason === "source-limit"));
});
