import assert from "node:assert/strict";
import { execFile, execFileSync, spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { attachFileSession, addFileSessionSuggestion } from "../package/minimap/src/sessions.js";
import { loadWorktreeAggregate } from "../package/minimap/src/worktree-aggregate.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = path.join(projectRoot, "package", "minimap", "skills", "minimap-roadmap", "scripts");
const run = promisify(execFile);

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForFile(file) {
  for (let attempt = 0; attempt < 300; attempt++) {
    try { await fs.access(file); return; }
    catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  throw new Error(`Server did not reach paused read: ${file}`);
}

test("bound HTTP apply rejects a spec path redirected outside after validation", { timeout: 45000 }, async (t) => {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-bound-http-"));
  const root = path.join(owned, "repo");
  const docs = path.join(root, "docs");
  const outside = path.join(owned, "outside");
  const spec = path.join(docs, "note.md");
  const outsideSpec = path.join(outside, "note.md");
  const home = path.join(owned, "home");
  const arm = path.join(owned, "arm");
  const reached = path.join(owned, "reached");
  const release = path.join(owned, "release");
  const linkType = process.platform === "win32" ? "junction" : "dir";
  const env = {
    ...process.env,
    PORT: String(await freePort()),
    MINIMAP_HOME: home,
    MINIMAP_PALLIUM_ENDPOINT: "",
    MINIMAP_TEST_PAUSE_FILE: spec,
    MINIMAP_TEST_ARM: arm,
    MINIMAP_TEST_REACHED: reached,
    MINIMAP_TEST_RELEASE: release,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --import=${pathToFileURL(path.join(projectRoot, "fixtures", "pause-source-read.mjs")).href}`.trim(),
  };
  let child;
  t.after(async () => {
    await fs.writeFile(release, "go");
    await run(process.execPath, [path.join(scripts, "stop-server.mjs")], { env, windowsHide: true, timeout: 10000 });
    if (child && child.exitCode === null) await new Promise((resolve) => child.once("exit", resolve));
    assert.equal(path.dirname(path.resolve(owned)), path.resolve(os.tmpdir()));
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });

  await fs.mkdir(path.join(root, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"));
  await fs.mkdir(docs);
  await fs.mkdir(outside);
  const probe = path.join(owned, "probe");
  try { await fs.symlink(outside, probe, linkType); await fs.unlink(probe); }
  catch (error) {
    if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) return t.skip("directory links unavailable");
    throw error;
  }
  await fs.writeFile(path.join(root, "roadmap", "board.md"), "# Now\n");
  await fs.writeFile(path.join(root, "roadmap", "scope.md"), "original\n");
  await fs.writeFile(spec, "Replace this sentence.\n");
  await fs.writeFile(outsideSpec, "Replace this sentence.\n");
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.invalid");
  git(root, "add", ".");
  git(root, "commit", "-m", "base");
  await attachFileSession(spec, { minimapHome: home });
  const { suggestion } = await addFileSessionSuggestion(spec,
    { by: "tester", kind: "replace", quote: "Replace this sentence.", content: "unexpected outside edit" }, { minimapHome: home });
  const context = (await loadWorktreeAggregate(root)).sources[0];

  child = spawn(process.execPath, [path.join(scripts, "start-server.mjs")], {
    cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server did not start: ${output}`)), 15000);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.includes(`localhost:${env.PORT}`)) { clearTimeout(timeout); resolve(); }
    });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${output}`)); });
  });

  await fs.writeFile(arm, "go");
  const responsePromise = fetch(`http://127.0.0.1:${env.PORT}/api/source/spec-sessions/by-file/suggestions/${suggestion.id}/apply`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-minimap-repo": root, "x-minimap-source-context": JSON.stringify(context) },
    body: JSON.stringify({ file: spec, by: "tester" }),
  });
  await waitForFile(reached);
  await fs.rename(docs, path.join(root, "docs-original"));
  await fs.symlink(outside, docs, linkType);
  await fs.writeFile(release, "go");
  const response = await responsePromise;
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "source_path_escape");
  assert.equal(await fs.readFile(outsideSpec, "utf8"), "Replace this sentence.\n");
});
