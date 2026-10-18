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

const canonical = (value) => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
async function activity(root, timestamp, suffix = "") {
  const dir = git(root, "rev-parse", "--absolute-git-dir");
  const log = path.join(dir, "logs", "HEAD");
  const hash = git(root, "rev-parse", "HEAD");
  await fs.writeFile(log, `${hash} ${hash} Test <test@example.invalid> ${timestamp} +0000\ttest\n${suffix}`);
  return log;
}

test("discovers recent linked worktrees and identifies branch or detached context", async () => {
  const root = await repo();
  const one = path.join(path.dirname(root), "linked-one"); const two = path.join(path.dirname(root), "linked-two");
  git(root, "worktree", "add", "-b", "feature/one", one);
  git(root, "worktree", "add", "--detach", two, "HEAD");
  await activity(one, 200); await activity(two, 100);
  const result = await discoverWorktreeSources(root);
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

test("source discovery admits 25 recent valid sources without stale entries consuming slots", { timeout: 60_000 }, async () => {
  const root = await repo();
  for (let i = 0; i < 28; i += 1) {
    const target = path.join(path.dirname(root), `linked-${i}`);
    git(root, "worktree", "add", "--detach", target, "HEAD");
    await activity(target, 100 + i);
  }
  await fs.rm(path.join(path.dirname(root), "linked-27"), { recursive: true, force: true });
  // A registered directory with invalid Git context ranks first but must be backfilled.
  await fs.writeFile(path.join(git(path.join(path.dirname(root), "linked-26"), "rev-parse", "--absolute-git-dir"), "HEAD"), "invalid\n");
  const originalStat = fs.stat, originalOpen = fs.open, originalRead = fs.readFile;
  let active = 0, peak = 0, identityHeads = 0, activeHeads = 0, peakHeads = 0;
  let releaseHeads;
  const fourHeads = new Promise((resolve) => { releaseHeads = resolve; });
  const reads = [];
  fs.stat = async (...args) => {
    if (!String(args[0]).includes("linked-") || String(args[0]).endsWith(".git")) return originalStat(...args);
    active++; peak = Math.max(peak, active);
    try { await new Promise((resolve) => setTimeout(resolve, 2)); return await originalStat(...args); }
    finally { active--; }
  };
  fs.open = async (...args) => {
    const handle = await originalOpen(...args);
    const read = handle.read.bind(handle);
    handle.read = (...readArgs) => { reads.push({ file: String(args[0]), bytes: readArgs[2] }); return read(...readArgs); };
    return handle;
  };
  fs.readFile = async (...args) => {
    if (path.basename(String(args[0])) !== "HEAD") return originalRead(...args);
    identityHeads++; activeHeads++; peakHeads = Math.max(peakHeads, activeHeads);
    const number = identityHeads;
    try {
      if (number === 8) releaseHeads();
      if (number >= 5 && number <= 8) await fourHeads;
      await new Promise((resolve) => setTimeout(resolve, identityHeads % 4 === 0 ? 5 : 30));
      return await originalRead(...args);
    } finally { activeHeads--; }
  };
  let result;
  try { result = await discoverWorktreeSources(root); }
  finally { fs.stat = originalStat; fs.open = originalOpen; fs.readFile = originalRead; }
  assert.ok(peak > 1 && peak <= 8, `metadata concurrency: ${peak}`);
  assert.equal(identityHeads, 25, "Admitted identities read HEAD; capped candidates do not");
  assert.equal(peakHeads, 4, "Identity admission overlaps only four checks and retains rank order");
  assert.ok(reads.length > 25);
  assert.ok(reads.every(({ file, bytes }) => bytes <= (file.endsWith(".git") ? 4096 : 8192)));
  assert.equal(result.sources.length, 25);
  assert.deepEqual(result.sources.slice(1).map((source) => path.basename(source.repoRoot)),
    Array.from({ length: 24 }, (_, i) => `linked-${25 - i}`));
  assert.equal(result.partial, true);
  assert.ok(result.excluded.some((entry) => entry.reason === "source-limit"));
  const controller = new AbortController();
  let started = 0, pending = 0;
  let releaseCancelled;
  const cancelledBatch = new Promise((resolve) => { releaseCancelled = resolve; });
  fs.readFile = async (...args) => {
    if (path.basename(String(args[0])) !== "HEAD") return originalRead(...args);
    pending++;
    try {
      started++;
      if (started === 8) { controller.abort(new Error("cancel identity batch")); releaseCancelled(); }
      if (started >= 5) await cancelledBatch;
      await new Promise((resolve) => setTimeout(resolve, 40));
      return await originalRead(...args);
    } finally { pending--; }
  };
  try { await assert.rejects(discoverWorktreeSources(root, { signal: controller.signal }), /cancel identity batch/); }
  finally { fs.readFile = originalRead; }
  assert.equal(started, 8, "Opened identity, three valid siblings, then cancelled four; no further batch");
  assert.equal(pending, 0, "Started identity reads drain before rejection");
  for (let i = 0; i < 27; i += 1) {
    await fs.rm(path.join(path.dirname(root), `linked-${i}`), { recursive: true, force: true });
  }
  const stale = await discoverWorktreeSources(root);
  assert.equal(stale.sources.length, 1);
  assert.equal(stale.excluded.filter((entry) => ["missing-or-unavailable", "prunable"].includes(entry.reason)).length, 28);
  assert.equal(stale.excluded.filter((entry) => entry.reason === "source-limit").length, 0);
});

test("reflog tails rank complete local events, unknowns and ties deterministically", async () => {
  const root = await repo();
  await activity(root, 100);
  const names = ["tie-b", "missing", "newest", "malformed", "tie-a", "oversized", "partial"];
  const roots = Object.fromEntries(names.map((name) => [name, path.join(path.dirname(root), name)]));
  for (const target of Object.values(roots)) git(root, "worktree", "add", "--detach", target, "HEAD");
  await activity(roots["tie-a"], 200); await activity(roots["tie-b"], 200);
  const newestLog = await activity(roots.newest, 300);
  await fs.utimes(newestLog, new Date(0), new Date(0));
  await activity(roots.partial, 250, "unfinished event without newline");
  await fs.rm(await activity(roots.missing, 999));
  await activity(roots.malformed, "not-a-timestamp");
  await activity(roots.oversized, 999, `${"x".repeat(9000)}\n`);
  const result = await discoverWorktreeSources(roots.missing);
  assert.deepEqual(result.sources.map((source) => path.basename(source.repoRoot)),
    ["missing", "newest", "partial", "tie-a", "tie-b", path.basename(root), "malformed", "oversized"]);
  const identity = await readWorktreeIdentity(roots["tie-a"]);
  await fs.writeFile(path.join(roots["tie-a"], "file"), "uncommitted edit");
  await fs.writeFile(path.join(roots["tie-a"], "untracked"), "untracked edit");
  assert.deepEqual(await readWorktreeIdentity(roots["tie-a"]), identity);
  assert.deepEqual((await discoverWorktreeSources(roots.missing)).sources, result.sources);
  const originalOpen = fs.open;
  fs.open = async (...args) => {
    const handle = await originalOpen(...args);
    if (canonical(args[0]) === canonical(newestLog)) {
      const read = handle.read.bind(handle);
      handle.read = async (...readArgs) => {
        const result = await read(...readArgs);
        return { ...result, bytesRead: result.bytesRead - 1 };
      };
    }
    return handle;
  };
  try {
    assert.deepEqual((await discoverWorktreeSources(roots.missing)).sources.map((source) => path.basename(source.repoRoot)),
      ["missing", "partial", "tie-a", "tie-b", path.basename(root), "malformed", "newest", "oversized"]);
  } finally { fs.open = originalOpen; }
});

test("discovery honors an already cancelled signal", async () => {
  const root = await repo();
  const controller = new AbortController(); controller.abort(new Error("cancel discovery"));
  await assert.rejects(discoverWorktreeSources(root, { signal: controller.signal }), /cancel discovery/);
});

test("activity metadata confines real admin and log paths and drains cancellation", async () => {
  const root = await repo();
  const sibling = path.join(path.dirname(root), "linked");
  git(root, "worktree", "add", "--detach", sibling, "HEAD");
  await activity(root, 100); await activity(sibling, 200);
  const admin = git(sibling, "rev-parse", "--absolute-git-dir");
  const originalRealpath = fs.realpath, originalOpen = fs.open;
  let escaped = "admin", logReads = 0;
  fs.realpath = async (...args) => {
    const value = await originalRealpath(...args);
    if (canonical(args[0]) === canonical(escaped === "admin" ? admin : path.join(admin, "logs", "HEAD")))
      return path.join(path.dirname(root), "outside-admin");
    return value;
  };
  fs.open = (...args) => {
    if (path.basename(String(args[0])) === "HEAD") logReads++;
    return originalOpen(...args);
  };
  try {
    for (escaped of ["admin", "log"]) {
      logReads = 0;
      const fromMain = await discoverWorktreeSources(root);
      assert.equal(fromMain.sources.length, 2, "Unknown activity preserves authoritative identity admission");
      assert.equal(logReads, 0, "Outside-admin metadata is never opened");
    }
  } finally { fs.realpath = originalRealpath; fs.open = originalOpen; }
  const controller = new AbortController();
  let afterAbort = 0;
  fs.realpath = async (...args) => {
    if (controller.signal.aborted) afterAbort++;
    const value = await originalRealpath(...args);
    if (path.basename(String(args[0])) === "HEAD") controller.abort(new Error("cancel metadata"));
    return value;
  };
  try { await assert.rejects(discoverWorktreeSources(root, { signal: controller.signal }), /cancel metadata/); }
  finally { fs.realpath = originalRealpath; }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(afterAbort, 0);
});
