import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { promisify } from "node:util";
import { after, afterEach, test } from "node:test";

const originalExecFile = childProcess.execFile;
const originalSpawn = childProcess.spawn;
const commands = [];
let graphReply = null;
let graphFailure = false;
let abortGraph = null;
let deletionReply = null;
let deletionFailure = false;
function observedExecFile(file, args, options, callback) {
  if (file === "git") commands.push(args);
  if (file === "git" && args[0] === "rev-list" && abortGraph) {
    const { controller, reason } = abortGraph;
    abortGraph = null;
    controller.abort(reason);
  }
  if (file === "git" && args[0] === "rev-list" && graphFailure) {
    return originalExecFile(file, ["rev-list", "--invalid-option"], options, callback);
  }
  if (file === "git" && args[0] === "rev-list" && graphReply !== null) {
    return originalExecFile(file, args, options, (error, stdout, stderr) => callback(error,
      typeof graphReply === "function" ? graphReply(stdout, args) : graphReply, stderr));
  }
  if (file === "git" && args[0] === "log" && args.includes("--full-history") && args.includes("--diff-filter=D")) {
    if (deletionFailure) return originalExecFile(file, ["log", "--invalid-option"], options, callback);
    if (deletionReply !== null) return originalExecFile(file, args, options, (error, stdout, stderr) => callback(error, deletionReply, stderr));
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
const { loadWorktreeAggregate } = await import("../package/minimap/src/worktree-aggregate.js");

const owned = [];
const git = (cwd, ...args) => childProcess.execFileSync("git", args, { cwd, windowsHide: true, encoding: "utf8", stdio: "pipe" }).trim();
const item = (title = "Alpha") => `---\nid: alpha\ntitle: ${title}\nstatus: queued\npriority: medium\ncommitment: committed\n---\n\n## Summary\n${title} body.\n`;
async function write(root, file, text) {
  const target = path.join(root, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, text);
}
async function baseFixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-ancestry-proof-"));
  owned.push(dir);
  const root = path.join(dir, "main with spaces");
  await fs.mkdir(root);
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.invalid");
  git(root, "config", "core.autocrlf", "false");
  await write(root, "roadmap/board.md", "# Now\n- alpha\n");
  await write(root, "roadmap/scope.md", "Generic ancestry fixture.\n");
  await write(root, "roadmap/ideas/.keep", "");
  await write(root, "roadmap/features/alpha.md", item());
  git(root, "add", ".");
  git(root, "commit", "-m", "base");
  commands.length = 0;
  return { dir, root, base: git(root, "rev-parse", "HEAD") };
}
async function fixture() {
  const result = await baseFixture();
  result.roots = [result.root];
  for (let index = 1; index <= 2; index += 1) {
    const source = path.join(result.dir, `source-${index}`);
    git(result.root, "worktree", "add", "-b", `topic-${index}`, source);
    await write(source, `notes/branch-${index}.txt`, `${index}\n`);
    git(source, "add", ".");
    git(source, "commit", "-m", `branch ${index}`);
    await write(source, `notes/advance-${index}.txt`, `advance ${index}\n`);
    git(source, "add", ".");
    git(source, "commit", "-m", `advance ${index}`);
    result.roots.push(source);
  }
  commands.length = 0;
  return result;
}
function resetInstrumentation() {
  graphReply = null;
  graphFailure = false;
  abortGraph = null;
  deletionReply = null;
  deletionFailure = false;
  commands.length = 0;
}

afterEach(async () => {
  resetInstrumentation();
  for (const dir of owned.splice(0)) {
    assert.equal(path.dirname(dir), os.tmpdir());
    assert.match(path.basename(dir), /^minimap-ancestry-proof-/);
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
after(() => {
  childProcess.execFile = originalExecFile;
  childProcess.spawn = originalSpawn;
  syncBuiltinESMExports();
});

test("multiple best criss-cross bases use Git fallback and match forced-native results", async () => {
  const { root, dir, base } = await baseFixture();
  const tree = git(root, "rev-parse", `${base}^{tree}`);
  const left = git(root, "commit-tree", tree, "-p", base, "-m", "left side");
  const right = git(root, "commit-tree", tree, "-p", base, "-m", "right side");
  const firstMerge = git(root, "commit-tree", tree, "-p", left, "-p", right, "-m", "first merge");
  const secondMerge = git(root, "commit-tree", tree, "-p", right, "-p", left, "-m", "second merge");
  const first = path.join(dir, "criss-cross-first"), second = path.join(dir, "criss-cross-second");
  git(root, "worktree", "add", "--detach", first, firstMerge);
  git(root, "worktree", "add", "--detach", second, secondMerge);
  assert.equal(git(root, "merge-base", "--all", firstMerge, secondMerge).split("\n").length, 2);
  commands.length = 0;
  const optimized = await loadWorktreeAggregate(root);
  assert.equal(optimized.coverage.loaded, 3);
  assert.ok(commands.some((args) => args[0] === "merge-base" && args.includes(firstMerge) && args.includes(secondMerge)));
  graphFailure = true;
  commands.length = 0;
  const native = await loadWorktreeAggregate(root);
  assert.deepEqual(native, optimized);
});

for (const history of ["shallow", "replace"]) {
  test(`${history} history keeps optimized ancestry results equal to native Git`, async () => {
    const { root, roots } = await fixture();
    if (history === "shallow") {
      const boundary = git(roots[1], "rev-parse", "HEAD^");
      assert.ok(git(root, "rev-parse", `${boundary}^`));
      await fs.writeFile(path.join(root, ".git", "shallow"), `${boundary}\n`);
      assert.equal(git(root, "rev-parse", "--is-shallow-repository"), "true");
      assert.equal(git(root, "rev-list", "--parents", "-n", "1", boundary).split(/\s+/).length, 1);
    } else {
      const left = git(roots[1], "rev-parse", "HEAD");
      const right = git(roots[2], "rev-parse", "HEAD");
      git(root, "replace", "--graft", left, right);
    }
    commands.length = 0;
    const optimized = await loadWorktreeAggregate(root);
    assert.equal(optimized.coverage.loaded, 3);
    graphFailure = true;
    commands.length = 0;
    assert.deepEqual(await loadWorktreeAggregate(root), optimized);
    assert.ok(commands.some((args) => args[0] === "merge-base"));
  });
}

test("missing-parent and truncated ancestry graphs fall back to native merge-base", async () => {
  const { root, base, roots } = await fixture();
  const heads = roots.map((source) => git(source, "rev-parse", "HEAD"));
  const optimized = await loadWorktreeAggregate(root);
  for (const truncate of [false, true]) {
    graphReply = (stdout) => stdout.split("\n").filter((line) => truncate
      ? heads.includes(line.split(" ", 1)[0])
      : line.split(" ", 1)[0] !== base).join("\n");
    commands.length = 0;
    assert.deepEqual(await loadWorktreeAggregate(root), optimized);
    assert.ok(commands.some((args) => args[0] === "merge-base"));
  }
});

test("failed or malformed deletion transcripts fall back to exact pair reads", async () => {
  const { root, roots } = await fixture();
  const source = roots[1];
  git(source, "rm", "roadmap/features/alpha.md");
  git(source, "commit", "-m", "delete alpha");
  await write(source, "roadmap/features/alpha.md", item("Recreated Alpha"));
  git(source, "add", ".");
  git(source, "commit", "-m", "recreate alpha");
  const expected = await loadWorktreeAggregate(root);
  assert.equal(expected.features.filter((feature) => feature.id === "alpha").length, 2);
  for (const mode of ["failed", "malformed", "unknown commit"]) {
    deletionFailure = mode === "failed";
    deletionReply = mode === "malformed" ? "not-a-commit\n" : mode === "unknown commit" ? `${"0".repeat(40)}\n` : null;
    commands.length = 0;
    const actual = await loadWorktreeAggregate(root);
    assert.deepEqual(actual, expected);
    assert.ok(commands.some((args) => args[0] === "log" && args.includes("--diff-filter=D") && args.includes("--format=")));
  }
});

test("ancestry graph cancellation propagates its caller reason", async () => {
  const { root } = await fixture();
  const controller = new AbortController();
  const reason = new Error("cancel ancestry graph read");
  abortGraph = { controller, reason };
  await assert.rejects(loadWorktreeAggregate(root, { signal: controller.signal }), (error) => error === reason);
  assert.ok(commands.some((args) => args[0] === "rev-list" && args.includes("--parents")));
});
