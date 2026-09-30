import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readWorktreeIdentity } from "../package/minimap/src/worktree-sources.js";
import { requirePathInSource, requireRoadmapInSource, verifySourceContext } from "../package/minimap/src/source-bound.js";
import { loadWorkspace, saveScopeText } from "../package/minimap/src/roadmap.js";
import { withSourceWriteGuard } from "../package/minimap/src/source-write-guard.js";
import { attachFileSession } from "../package/minimap/src/sessions.js";

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

test("source guard at the write boundary rejects a branch switch after reading scope", async (t) => {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-bound-write-"));
  t.after(() => fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }));
  const root = path.join(owned, "repo");
  const scopePath = path.join(root, "roadmap", "scope.md");
  await fs.mkdir(path.join(root, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"));
  await fs.writeFile(path.join(root, "roadmap", "board.md"), "# Now\n");
  await fs.writeFile(scopePath, "original\n");
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.invalid");
  git(root, "add", ".");
  git(root, "commit", "-m", "base");
  const identity = await readWorktreeIdentity(root);
  const revision = (await loadWorkspace(root)).scopeRevision;
  const originalReadFile = fs.readFile;
  let switched = false;
  fs.readFile = async function (file, ...args) {
    const content = await originalReadFile.call(this, file, ...args);
    if (!switched && String(file).toLowerCase() === scopePath.toLowerCase()) {
      switched = true;
      git(root, "switch", "-c", "other");
    }
    return content;
  };
  try {
    await assert.rejects(withSourceWriteGuard(() => verifySourceContext(root, identity),
      () => saveScopeText(root, "EDIT FROM MAIN", revision)), { code: "source_changed" });
    assert.equal(switched, true);
    assert.equal(await originalReadFile(scopePath, "utf8"), "original\n");
  } finally {
    fs.readFile = originalReadFile;
  }
});

test("source guard rejects a spec attach when the checkout switches during target read", async (t) => {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-bound-spec-write-"));
  t.after(() => fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }));
  const root = path.join(owned, "repo");
  const file = path.join(root, "spec.md");
  const minimapHome = path.join(owned, "home");
  await fs.mkdir(root);
  await fs.writeFile(file, "original spec\n");
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.invalid");
  git(root, "add", ".");
  git(root, "commit", "-m", "base");
  const identity = await readWorktreeIdentity(root);
  const originalReadFile = fs.readFile;
  let switched = false;
  fs.readFile = async function (target, ...args) {
    const content = await originalReadFile.call(this, target, ...args);
    if (!switched && String(target).toLowerCase() === file.toLowerCase()) {
      switched = true;
      git(root, "switch", "-c", "other");
    }
    return content;
  };
  try {
    await assert.rejects(withSourceWriteGuard(() => verifySourceContext(root, identity),
      () => attachFileSession(file, { cwd: root, minimapHome })), { code: "source_changed" });
    assert.equal(switched, true);
    assert.equal(await originalReadFile(file, "utf8"), "original spec\n");
    await assert.rejects(fs.access(path.join(minimapHome, "session-index.json")), { code: "ENOENT" });
  } finally {
    fs.readFile = originalReadFile;
  }
});
