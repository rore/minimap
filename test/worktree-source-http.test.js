import assert from "node:assert/strict";
import { execFile, execFileSync, spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { discoverWorktreeSources } from "../package/minimap/src/worktree-sources.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = path.join(projectRoot, "package", "minimap", "skills", "minimap-roadmap", "scripts");
const run = promisify(execFile);
const git = (root, ...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("worktree inventory is immediate and selected source loads are fresh and source-bound", { timeout: 45000 }, async (t) => {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-worktree-source-http-"));
  const root = path.join(owned, "repo");
  const linked = path.join(owned, "linked");
  const outside = path.join(owned, "outside");
  const escapeLink = path.join(linked, "roadmap-escape-link");
  const home = path.join(owned, "home");
  const env = { ...process.env, PORT: String(await freePort()), MINIMAP_HOME: home,
    MINIMAP_PALLIUM_ENDPOINT: "", MINIMAP_PALLIUM_DASHBOARD_ENDPOINT: "" };
  let child;
  t.after(async () => {
    await run(process.execPath, [path.join(scripts, "stop-server.mjs")], { env, windowsHide: true, timeout: 10000 });
    if (child && child.exitCode === null) await new Promise((resolve) => child.once("exit", resolve));
    assert.equal(path.dirname(path.resolve(owned)), path.resolve(os.tmpdir()));
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });

  await fs.mkdir(path.join(root, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"));
  await fs.writeFile(path.join(root, "roadmap.config.json"), '{"roadmapPath":"roadmap"}\n');
  await fs.writeFile(path.join(root, "roadmap", "board.md"), "# Now\n");
  await fs.writeFile(path.join(root, "roadmap", "scope.md"), "scope\n");
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.invalid");
  git(root, "add", ".");
  git(root, "commit", "-m", "base");
  git(root, "worktree", "add", "-b", "feature/linked", linked);
  await fs.writeFile(path.join(linked, "roadmap.config.json"), "not json\n");

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

  const baseUrl = `http://127.0.0.1:${env.PORT}`;
  const headers = { "x-minimap-repo": root };
  const inventoryResponse = await fetch(`${baseUrl}/api/worktree-sources`, { headers });
  assert.equal(inventoryResponse.status, 200);
  const inventory = await inventoryResponse.json();
  assert.deepEqual(inventory, await discoverWorktreeSources(root));
  const badSource = inventory.sources.find((source) => source.repoRoot === (process.platform === "win32" ? linked.toLowerCase() : linked));
  assert.ok(badSource, "malformed roadmap checkout remains available in inventory");

  const load = (source) => fetch(`${baseUrl}/api/worktree-source-workspace`, {
    headers: { ...headers, "x-minimap-repo": source.repoRoot, "x-minimap-source-context": JSON.stringify(source) },
  });
  const primary = inventory.sources[0];
  const loadedResponse = await load(primary);
  const loaded = await loadedResponse.json();
  assert.equal(loadedResponse.status, 200);
  assert.equal(loaded.source.sourceKey, primary.sourceKey);
  assert.deepEqual(loaded.source.roadmapBinding, { roadmapPath: "roadmap", resolvedPath: path.join(primary.repoRoot, "roadmap") });
  assert.deepEqual(loaded.workspace.specSessionsByItemId, {});

  const invalidRoadmapResponse = await load(badSource);
  assert.equal(invalidRoadmapResponse.status, 422);
  assert.equal((await invalidRoadmapResponse.json()).error.code, "config_error");

  const missingContext = await fetch(`${baseUrl}/api/worktree-source-workspace`, { headers });
  assert.equal(missingContext.status, 400);
  const malformedContext = await fetch(`${baseUrl}/api/worktree-source-workspace`, {
    headers: { ...headers, "x-minimap-source-context": "{" },
  });
  assert.equal(malformedContext.status, 400);
  const stale = { ...primary, git: { ...primary.git, branchRef: "refs/heads/stale" } };
  const staleResponse = await load(stale);
  assert.equal(staleResponse.status, 409);
  assert.equal((await staleResponse.json()).error.code, "source_changed");

  const malformedBinding = { ...primary, roadmapBinding: { roadmapPath: "roadmap", resolvedPath: "relative/path" } };
  const malformedBindingResponse = await load(malformedBinding);
  assert.equal(malformedBindingResponse.status, 400);
  assert.equal((await malformedBindingResponse.json()).error.code, "bad_request");

  await fs.mkdir(outside);
  let linkAvailable = true;
  try {
    await fs.symlink(outside, escapeLink, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (!["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) throw error;
    linkAvailable = false;
    t.diagnostic("Skipping roadmap symlink-escape assertion: directory links are unavailable.");
  }
  if (linkAvailable) {
    await fs.writeFile(path.join(linked, "roadmap.config.json"), '{"roadmapPath":"roadmap-escape-link"}\n');
    const escapingRoadmap = await load(badSource);
    assert.equal(escapingRoadmap.status, 403);
    assert.equal((await escapingRoadmap.json()).error.code, "source_path_escape");
  }
});
