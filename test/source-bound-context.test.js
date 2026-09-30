import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readWorktreeIdentity } from "../package/minimap/src/worktree-sources.js";
import { verifySourceContext } from "../package/minimap/src/source-bound.js";

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
}

async function createRepo(root, content = "same content\n") {
  await fs.mkdir(root, { recursive: true });
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.invalid");
  await fs.writeFile(path.join(root, "file"), content);
  git(root, "add", "file");
  git(root, "commit", "-m", "initial");
}

async function assertChangedWithoutFileMutation(root, contents) {
  await assert.rejects(verifySourceContext(root, contents.identity), { code: "source_changed" });
  assert.equal(await fs.readFile(path.join(root, "file"), "utf8"), contents.file);
}

test("bound context rejects a detached HEAD moved to another commit", async (t) => {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-bound-detached-"));
  t.after(() => fs.rm(owned, { recursive: true, force: true }));
  const root = path.join(owned, "repo");
  await createRepo(root);
  git(root, "switch", "--detach", "HEAD");
  const contents = { identity: await readWorktreeIdentity(root), file: await fs.readFile(path.join(root, "file"), "utf8") };
  assert.equal(contents.identity.git.branchRef, null);
  await verifySourceContext(root, contents.identity);
  git(root, "commit", "--allow-empty", "-m", "detached commit");
  const moved = await readWorktreeIdentity(root);
  assert.equal(moved.git.branchRef, null);
  assert.notEqual(moved.git.headCommit, contents.identity.git.headCommit);
  await assertChangedWithoutFileMutation(root, contents);
});

test("bound context rejects checkout removal and recreation at the same path", async (t) => {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-bound-recreated-"));
  t.after(() => fs.rm(owned, { recursive: true, force: true }));
  const root = path.join(owned, "repo");
  await createRepo(root);
  const contents = { identity: await readWorktreeIdentity(root), file: await fs.readFile(path.join(root, "file"), "utf8") };
  await fs.rm(root, { recursive: true, force: true });
  await createRepo(root, contents.file);
  const replacement = await readWorktreeIdentity(root);
  assert.notDeepEqual(replacement.git.gitDirIdentity, contents.identity.git.gitDirIdentity);
  await assertChangedWithoutFileMutation(root, contents);
});

test("bound context rejects a branch rename", async (t) => {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-bound-rename-"));
  t.after(() => fs.rm(owned, { recursive: true, force: true }));
  const root = path.join(owned, "repo");
  await createRepo(root);
  const contents = { identity: await readWorktreeIdentity(root), file: await fs.readFile(path.join(root, "file"), "utf8") };
  git(root, "branch", "-m", "renamed");
  await assertChangedWithoutFileMutation(root, contents);
});
