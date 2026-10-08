import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { promisify } from "node:util";
import { after, test } from "node:test";

// Observe real Git commands only in this test process, before module imports.
const originalExecFile = childProcess.execFile;
const commands = [];
function observedExecFile(file, args, options, callback) {
  if (file === "git") commands.push(args);
  return originalExecFile(file, args, options, callback);
}
observedExecFile[promisify.custom] = (...args) => new Promise((resolve, reject) => {
  observedExecFile(...args, (error, stdout, stderr) => {
    if (error) { error.stdout = stdout; error.stderr = stderr; reject(error); }
    else resolve({ stdout, stderr });
  });
});
childProcess.execFile = observedExecFile;
syncBuiltinESMExports();
const { loadWorktreeAggregate } = await import("../package/minimap/src/worktree-aggregate.js");
after(() => { childProcess.execFile = originalExecFile; syncBuiltinESMExports(); });

const git = (cwd, ...args) => childProcess.execFileSync("git", args, {
  cwd, windowsHide: true, encoding: "utf8", stdio: "pipe",
});
test("over-cap ancestor evidence is read once per tree per aggregate and stays uncertain", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-worktree-evidence-"));
  try {
    const root = path.join(dir, "main");
    await fs.mkdir(path.join(root, "roadmap/features"), { recursive: true });
    await fs.mkdir(path.join(root, "roadmap/ideas"));
    git(root, "init", "-b", "main");
    git(root, "config", "user.name", "Test");
    git(root, "config", "user.email", "test@example.invalid");
    git(root, "config", "core.autocrlf", "false");
    const ids = Array.from({ length: 501 }, (_, i) => `item-${String(i).padStart(4, "0")}`);
    await fs.writeFile(path.join(root, "roadmap/board.md"), `# Now\n${ids.map((id) => `- ${id}`).join("\n")}\n`);
    await fs.writeFile(path.join(root, "roadmap/scope.md"), "Generic fixture.\n");
    await fs.writeFile(path.join(root, "roadmap/ideas/.keep"), "");
    for (const id of ids) await fs.writeFile(path.join(root, `roadmap/features/${id}.md`),
      `---\nid: ${id}\ntitle: ${id}\nstatus: queued\npriority: medium\ncommitment: committed\n---\n\n## Summary\nGeneric item.\n`);
    git(root, "add", "."); git(root, "commit", "-m", "fixture");
    for (let i = 1; i < 3; i += 1) git(root, "worktree", "add", "-b", `feature/source-${i}`, path.join(dir, `source-${i}`));
    // Two requests prove the memo is local; all three source pairs share one tree.
    for (let request = 0; request < 2; request += 1) {
      commands.length = 0;
      const result = await loadWorktreeAggregate(root);
      assert.equal(result.coverage.loaded, 3);
      assert.equal(result.partial, true);
      assert.equal(result.features.length, 1503);
      assert.ok(result.features.every((feature) => feature.versions.length === 1));
      assert.equal(result.coverage.identityUncertain.length, 3);
      assert.ok(result.coverage.identityUncertain.every((entry) => entry.reason === "ancestor-item-limit"));
      assert.equal(commands.filter((args) => args[0] === "ls-tree").length, 1);
      assert.equal(commands.filter((args) => args[0] === "log").length, 0);
    }
  } finally {
    assert.equal(path.dirname(dir), os.tmpdir());
    assert.match(path.basename(dir), /^minimap-worktree-evidence-/);
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
