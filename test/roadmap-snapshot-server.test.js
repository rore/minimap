import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { initializeWorkspace } from "../package/minimap/src/roadmap.js";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = path.join(projectRoot, "package", "minimap", "skills", "minimap-roadmap", "scripts");

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function git(repo, ...args) {
  await execFileAsync("git", ["-C", repo, ...args], { windowsHide: true });
}

test("snapshot endpoints scope observations and invalidate after a roadmap write", { timeout: 30_000 }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-snapshot-server-"));
  const home = path.join(root, "home"), repo = path.join(root, "repo"), other = path.join(root, "other");
  const nonGit = path.join(root, "non-git");
  await Promise.all([fs.mkdir(home), fs.mkdir(repo), fs.mkdir(other), fs.mkdir(nonGit)]);
  const port = await freePort();
  const env = { ...process.env, MINIMAP_HOME: home, PORT: String(port), MINIMAP_PALLIUM_ENDPOINT: "" };
  let launcher;
  const stop = async () => {
    await execFileAsync(process.execPath, [path.join(scripts, "stop-server.mjs")], { env, windowsHide: true, timeout: 10_000 }).catch(() => {});
    if (launcher && launcher.exitCode === null) await new Promise((resolve) => launcher.once("exit", resolve));
  };
  try {
    await initializeWorkspace(repo);
    await initializeWorkspace(nonGit);
    await git(repo, "init", "--initial-branch=main");
    await git(repo, "config", "user.email", "test@example.invalid");
    await git(repo, "config", "user.name", "Snapshot Test");
    await git(repo, "add", ".");
    await git(repo, "commit", "-m", "fixture");
    await git(repo, "remote", "add", "origin", "https://github.com/example/snapshot-fixture.git");
    await git(other, "init", "--initial-branch=main");
    await git(other, "config", "user.email", "test@example.invalid");
    await git(other, "config", "user.name", "Snapshot Test");
    await fs.writeFile(path.join(other, "marker"), "fixture\n");
    await git(other, "add", ".");
    await git(other, "commit", "-m", "fixture");
    launcher = spawn(process.execPath, [path.join(scripts, "start-server.mjs")], {
      cwd: projectRoot, env, windowsHide: true, stdio: "ignore",
    });
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ready; attempt += 1) {
      if (launcher.exitCode !== null) throw new Error(`Packaged server launcher exited ${launcher.exitCode}.`);
      try { ready = (await fetch(`http://127.0.0.1:${port}/health`)).ok; } catch {}
      if (!ready) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(ready, true, "packaged server did not become ready");

    const endpoint = `http://127.0.0.1:${port}`;
    const headers = { "X-Minimap-Repo": repo };
    const freshResponse = await fetch(`${endpoint}/api/workspace`, { headers });
    assert.equal(freshResponse.status, 200, await freshResponse.clone().text());
    const fresh = await freshResponse.json();
    assert.equal(fresh.snapshot.stale, false);
    assert.ok(fresh.snapshot.id);

    const nonGitResponse = await fetch(`${endpoint}/api/workspace`, { headers: { "X-Minimap-Repo": nonGit } });
    assert.equal(nonGitResponse.status, 200, await nonGitResponse.clone().text());

    const cachedResponse = await fetch(`${endpoint}/api/workspace?cached=1`, { headers });
    const cached = await cachedResponse.json();
    assert.equal(cachedResponse.status, 200);
    assert.equal(cached.snapshot.id, fresh.snapshot.id);

    const wrongScope = await fetch(`${endpoint}/api/board/observations?snapshot=${encodeURIComponent(fresh.snapshot.id)}`, {
      headers: { "X-Minimap-Repo": other },
    });
    assert.equal(wrongScope.status, 409);
    assert.equal((await wrongScope.json()).error.code, "snapshot_expired");

    const observationResponse = await fetch(`${endpoint}/api/board/observations?snapshot=${encodeURIComponent(fresh.snapshot.id)}`, { headers });
    assert.equal(observationResponse.status, 200, await observationResponse.clone().text());
    assert.equal((await observationResponse.json()).status, "disabled");

    const write = await fetch(`${endpoint}/api/board`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ groups: fresh.boardGroups, expectedRevision: fresh.boardRevision }),
    });
    assert.equal(write.status, 200);
    const expired = await fetch(`${endpoint}/api/board/observations?snapshot=${encodeURIComponent(fresh.snapshot.id)}`, { headers });
    assert.equal(expired.status, 409);
    assert.equal((await expired.json()).error.code, "snapshot_expired");
  } finally {
    await stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});
