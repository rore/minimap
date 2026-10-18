import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { promisify } from "node:util";
import { after, afterEach, test } from "node:test";

// Instrument only this test process, before the modules capture their Git helpers.
const originalExecFile = childProcess.execFile;
const originalSpawn = childProcess.spawn;
const commands = [];
let batchReply = null;
let graphReply = null;
let failGraph = false;
function observedExecFile(file, args, options, callback) {
  if (file === "git") commands.push(args);
  if (file === "git" && args[0] === "rev-list" && failGraph) {
    return originalExecFile(file, ["rev-list", "--invalid-option"], options, callback);
  }
  if (file === "git" && args[0] === "rev-list" && graphReply !== null) {
    return originalExecFile(file, args, options, (error, stdout, stderr) => callback(error, graphReply, stderr));
  }
  if (file === "git" && args.includes("--path-format=absolute") && batchReply) {
    return originalExecFile(file, args.filter((arg) => arg !== "--path-format=absolute"), options,
      (error, stdout, stderr) => callback(error, batchReply(stdout), stderr));
  }
  return originalExecFile(file, args, options, callback);
}
observedExecFile[promisify.custom] = (...args) => new Promise((resolve, reject) => {
  observedExecFile(...args, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr }));
});
childProcess.execFile = observedExecFile;
childProcess.spawn = (file, args, options) => {
  if (file === "git") commands.push(args);
  return originalSpawn(file, args, options);
};
syncBuiltinESMExports();
const { readWorktreeIdentity } = await import("../package/minimap/src/worktree-sources.js");
const { loadWorktreeAggregate } = await import("../package/minimap/src/worktree-aggregate.js");

const owned = [];
const canonical = (value) => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
const git = (cwd, ...args) => childProcess.execFileSync("git", args, { cwd, windowsHide: true, encoding: "utf8", stdio: "pipe" }).trim();
const item = (id) => `---\nid: ${id}\ntitle: ${id}\nstatus: queued\npriority: medium\ncommitment: committed\n---\n\n## Summary\n${id} body.\n`;
async function write(root, file, text) {
  const target = path.join(root, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, text);
}
async function fixture(count = 2, sourceCount = 1) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-git-reads-"));
  owned.push(dir);
  const root = path.join(dir, "main with spaces");
  await fs.mkdir(root);
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.invalid");
  git(root, "config", "core.autocrlf", "false");
  const ids = count === 2 ? ["alpha", "beta"] : Array.from({ length: count }, (_, i) => `item-${String(i).padStart(4, "0")}`);
  await write(root, "roadmap/board.md", `# Now\n${ids.map((id) => `- ${id}`).join("\n")}\n`);
  await write(root, "roadmap/scope.md", "Generic fixture.\n");
  await write(root, "roadmap/ideas/.keep", "");
  for (const id of ids) await write(root, `roadmap/features/${id}.md`, item(id));
  git(root, "add", ".");
  git(root, "commit", "-m", "fixture");
  const roots = [root];
  for (let i = 1; i < sourceCount; i += 1) {
    const sibling = path.join(dir, `source-${i}`);
    git(root, "worktree", "add", "-b", `feature/source-${i}`, sibling);
    roots.push(sibling);
  }
  commands.length = 0;
  return { root, roots, ids, dir };
}

afterEach(async () => {
  batchReply = null;
  graphReply = null;
  failGraph = false;
  commands.length = 0;
  for (const dir of owned.splice(0)) {
    assert.equal(path.dirname(dir), os.tmpdir());
    assert.match(path.basename(dir), /^minimap-git-reads-/);
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
after(() => {
  childProcess.execFile = originalExecFile;
  childProcess.spawn = originalSpawn;
  syncBuiltinESMExports();
});

test("ordinary identity reads use one Git process and retain live branch/detached identity", async () => {
  const { root, roots } = await fixture(2, 2);
  const identity = await readWorktreeIdentity(root);
  assert.equal(commands.length, 1);
  assert.equal(identity.repoRoot, canonical(root));
  assert.equal(identity.git.gitDir, canonical(path.join(root, ".git")));
  assert.equal(identity.git.commonDir, identity.git.gitDir);
  assert.equal(identity.git.branchRef, "refs/heads/main");
  assert.equal(identity.git.headCommit, git(root, "rev-parse", "HEAD"));
  assert.match(identity.sourceKey, /^[0-9a-f]{64}$/);
  await write(root, "untracked", "dirty\n");
  commands.length = 0;
  assert.deepEqual((await readWorktreeIdentity(root)).git, identity.git);
  assert.equal(commands.length, 1);
  commands.length = 0;
  assert.deepEqual(await readWorktreeIdentity(path.join(root, "roadmap", "features")), identity);
  assert.equal(commands.length, 1);
  git(root, "add", "untracked");
  git(root, "commit", "-m", "change fixture");
  commands.length = 0;
  const updated = await readWorktreeIdentity(root);
  assert.equal(commands.length, 1);
  assert.equal(updated.sourceKey, identity.sourceKey);
  assert.notEqual(updated.git.headCommit, identity.git.headCommit);
  assert.equal(updated.git.headCommit, git(root, "rev-parse", "HEAD"));
  git(roots[1], "checkout", "--detach", "HEAD");
  commands.length = 0;
  const detached = await readWorktreeIdentity(roots[1]);
  assert.equal(commands.length, 1);
  assert.equal(detached.git.branchRef, null);
  assert.equal(detached.git.commonDir, identity.git.commonDir);
  assert.notEqual(detached.sourceKey, identity.sourceKey);
});

for (const framing of ["unsupported option", "ambiguous lines"]) {
  test(`identity retains bounded compatibility for ${framing}`, async () => {
    const { root } = await fixture();
    const expected = await readWorktreeIdentity(root);
    commands.length = 0;
    batchReply = (stdout) => framing === "unsupported option" ? `--path-format=absolute\n${stdout}` : `\n${stdout}`;
    assert.deepEqual(await readWorktreeIdentity(root), expected);
    assert.ok(commands.length <= 5);
    assert.ok(commands.filter((args) => args.includes("--path-format=absolute")).length <= 1);
  });
}

test("non-Git and unborn identities stay unavailable without retrying failed Git reads", async () => {
  const { dir } = await fixture();
  const outside = path.join(dir, "outside");
  await fs.mkdir(outside);
  commands.length = 0;
  assert.equal(await readWorktreeIdentity(outside), null);
  assert.equal(commands.length, 1);
  commands.length = 0;
  git(outside, "init", "-b", "main");
  assert.equal(await readWorktreeIdentity(outside), null);
  assert.equal(commands.length, 1);
});

test("four-source aggregation reduces Git work while repeated reads retain source coverage", async () => {
  const { root, ids } = await fixture(100, 4);
  for (let read = 0; read < 2; read += 1) {
    commands.length = 0;
    const result = await loadWorktreeAggregate(root);
    assert.equal(result.partial, false, JSON.stringify({ unavailable: result.unavailable, coverage: result.coverage }));
    assert.equal(result.coverage.loaded, 4);
    assert.equal(result.features.length, 100);
    assert.deepEqual(result.groups[0].items.map((entry) => entry.id), ids);
    assert.ok(result.features.every((feature) => feature.versions.length === 4));
    assert.equal(commands.filter((args) => args[0] === "rev-parse").length, 8);
    assert.equal(commands.filter((args) => args[0] === "merge-base").length, 0);
    assert.equal(commands.length, 12);
  }
});

test("complete ancestry graph replaces pair Git reads and preserves native fallback results", async () => {
  const { root, roots } = await fixture(2, 4);
  for (const [index, source] of roots.entries()) {
    await write(source, `notes/branch-${index}.txt`, String(index));
    git(source, "add", "."); git(source, "commit", "-m", `branch ${index}`);
  }
  commands.length = 0;
  const optimized = await loadWorktreeAggregate(root);
  assert.equal(optimized.partial, false);
  assert.equal(optimized.coverage.loaded, 4);
  assert.equal(optimized.features[0].versions.length, 4);
  assert.equal(commands.filter((args) => args[0] === "rev-list" && args.includes("--parents")).length, 1);
  assert.equal(commands.filter((args) => args[0] === "merge-base").length, 0);
  assert.equal(commands.filter((args) => args[0] === "log" && args.includes("--diff-filter=D")).length, 1);

  failGraph = true;
  commands.length = 0;
  const native = await loadWorktreeAggregate(root);
  assert.deepEqual(native, optimized);
  assert.equal(commands.filter((args) => args[0] === "merge-base").length, 6);
  assert.ok(commands.filter((args) => args[0] === "log" && args.includes("--diff-filter=D")).length > 1);
});

test("malformed and capped ancestry graphs fall back to native pair reads", async () => {
  const { root, roots } = await fixture(2, 2);
  for (const [index, source] of roots.entries()) {
    await write(source, `notes/branch-${index}.txt`, String(index));
    git(source, "add", "."); git(source, "commit", "-m", `branch ${index}`);
  }
  const native = await loadWorktreeAggregate(root);
  const cases = ["invalid graph", Array.from({ length: 8192 }, (_, index) => `${index.toString(16).padStart(40, "0")}`).join("\n")];
  for (const response of cases) {
    graphReply = response;
    commands.length = 0;
    const result = await loadWorktreeAggregate(root);
    assert.deepEqual(result, native);
    assert.equal(commands.filter((args) => args[0] === "merge-base").length, 1);
  }
  graphReply = null;
  failGraph = true;
  commands.length = 0;
  assert.deepEqual(await loadWorktreeAggregate(root), native);
  assert.equal(commands.filter((args) => args[0] === "merge-base").length, 1);
});

test("deletions before pair bases prove empty ranges without changing the exact fallback", async () => {
  const { root, dir } = await fixture(2);
  await fs.rename(path.join(root, "roadmap"), path.join(root, "planning"));
  await write(root, "roadmap.config.json", JSON.stringify({ roadmapPath: "planning" }));
  await write(root, "planning/ideas/retired.md", "retired\n");
  git(root, "add", "."); git(root, "commit", "-m", "add retired idea");
  git(root, "rm", "planning/ideas/retired.md"); git(root, "commit", "-m", "delete retired idea");
  const roots = [root];
  for (let index = 1; index < 4; index += 1) {
    const source = path.join(dir, `after-delete-${index}`);
    git(root, "worktree", "add", "-b", `after-delete-${index}`, source);
    await write(source, `notes/branch-${index}.txt`, String(index));
    git(source, "add", "."); git(source, "commit", "-m", `branch ${index}`);
    roots.push(source);
  }
  await write(root, "notes/branch-0.txt", "0");
  git(root, "add", "."); git(root, "commit", "-m", "branch 0");
  commands.length = 0;
  const result = await loadWorktreeAggregate(root);
  assert.equal(result.partial, false);
  assert.equal(result.features[0].versions.length, 4);
  const deletionReads = commands.filter((args) => args[0] === "log" && args.includes("--diff-filter=D"));
  assert.equal(deletionReads.length, 1, JSON.stringify(deletionReads));
  assert.ok(deletionReads[0].includes("--full-history"));
});

test("custom roadmap deletion after the base keeps the exact pair query", async () => {
  const { root, dir } = await fixture(2);
  await fs.rename(path.join(root, "roadmap"), path.join(root, "planning"));
  await write(root, "roadmap.config.json", JSON.stringify({ roadmapPath: "planning" }));
  git(root, "add", "."); git(root, "commit", "-m", "configure planning root");
  const sibling = path.join(dir, "planning-sibling");
  git(root, "worktree", "add", "-b", "planning-sibling", sibling);
  git(root, "rm", "planning/features/alpha.md"); git(root, "commit", "-m", "delete alpha");
  await write(root, "planning/features/alpha.md", item("alpha"));
  git(root, "add", "."); git(root, "commit", "-m", "recreate alpha");
  await write(sibling, "notes/sibling.txt", "sibling\n");
  git(sibling, "add", "."); git(sibling, "commit", "-m", "advance sibling");
  commands.length = 0;
  const result = await loadWorktreeAggregate(root);
  assert.equal(result.partial, false);
  assert.equal(result.features.filter((feature) => feature.id === "alpha").length, 2);
  const deletionReads = commands.filter((args) => args[0] === "log" && args.includes("--diff-filter=D"));
  assert.equal(deletionReads.length, 2, JSON.stringify(commands));
  assert.ok(deletionReads.some((args) => args.includes("--full-history") && args.includes("planning/features")));
  assert.ok(deletionReads.some((args) => !args.includes("--full-history") && args.includes("planning/features")));
});

test("indexed assembly preserves first appearances, duplicate membership and independent same-ID items", async () => {
  const { root, roots } = await fixture(2, 3);
  await write(root, "roadmap/board.md", "# Now\n- beta\n- alpha\n- alpha\n- missing\n# Later\n- alpha\n");
  for (const sibling of roots.slice(1)) {
    await write(sibling, "roadmap/board.md", "# Now\n- alpha\n- collision\n# Later\n- beta\n");
    await write(sibling, "roadmap/features/collision.md", item("collision"));
  }
  const result = await loadWorktreeAggregate(root);
  assert.equal(result.partial, false);
  assert.equal(result.features.length, 4);
  assert.deepEqual(result.groups.map((group) => group.name), ["Now", "Later"]);
  assert.deepEqual(result.groups[0].items.map((entry) => entry.id), ["beta", "alpha", "missing", "collision", "collision"]);
  assert.deepEqual(result.groups[1].items.map((entry) => entry.id), ["alpha", "beta"]);
  assert.equal(result.groups[0].items.find((entry) => entry.id === "alpha").versions.length, 4);
  assert.equal(result.groups[1].items.find((entry) => entry.id === "alpha").versions.length, 1);
  const collisions = result.features.filter((feature) => feature.id === "collision");
  assert.equal(new Set(collisions.map((feature) => feature.key)).size, 2);
  assert.ok(collisions.every((feature) => feature.versions.length === 1));
  assert.equal(result.coverage.missingBoardRefs.length, 1);
});
