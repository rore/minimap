import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
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

test("participant routes return 503 when the snapshot read deadline expires", { timeout: 30_000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-snapshot-deadline-"));
  const home = path.join(root, "home"), repo = path.join(root, "repo");
  await Promise.all([fs.mkdir(home), fs.mkdir(repo)]);
  const port = await freePort();
  const preload = path.join(root, "short-read-budget.mjs");
  await fs.writeFile(preload, [
    'import fs from "node:fs/promises";',
    'import path from "node:path";',
    "const original = AbortSignal.timeout.bind(AbortSignal);",
    "AbortSignal.timeout = (milliseconds) => original(milliseconds === 30_000 ? 2_000 : milliseconds);",
    "const readFile = fs.readFile.bind(fs);",
    "const writeFile = fs.writeFile.bind(fs);",
    "const delayedSignals = new WeakSet();",
    "fs.readFile = async (file, options, ...rest) => {",
    "  const signal = options && typeof options === 'object' ? options.signal : null;",
    "  if (path.basename(String(file)) === 'board.md' && signal && !delayedSignals.has(signal)) {",
    "    delayedSignals.add(signal);",
    "    await writeFile(process.env.MINIMAP_TEST_DELAY_MARKER, 'started');",
    "    await new Promise((resolve, reject) => {",
    "      const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason || new DOMException('aborted', 'AbortError')); };",
    "      signal.addEventListener('abort', abort, { once: true });",
    "      if (signal.aborted) abort();",
    "    });",
    "  }",
    "  return readFile(file, options, ...rest);",
    "};",
    "",
  ].join("\n"));
  const env = {
    ...process.env,
    MINIMAP_HOME: home,
    MINIMAP_TEST_DELAY_MARKER: path.join(root, "delayed-read-started"),
    PORT: String(port),
    MINIMAP_PALLIUM_ENDPOINT: "http://127.0.0.1:9",
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${pathToFileURL(preload).href}`].filter(Boolean).join(" "),
  };
  let launcher;
  t.after(async () => {
    await execFileAsync(process.execPath, [path.join(scripts, "stop-server.mjs")], {
      env, windowsHide: true, timeout: 10_000,
    }).catch(() => {});
    if (launcher && launcher.exitCode === null) await new Promise((resolve) => launcher.once("exit", resolve));
    await fs.rm(root, { recursive: true, force: true });
  });

  await initializeWorkspace(repo);
  await git(repo, "init", "--initial-branch=main");
  await git(repo, "config", "user.email", "test@example.invalid");
  await git(repo, "config", "user.name", "Snapshot Test");
  await git(repo, "add", ".");
  await git(repo, "commit", "-m", "fixture");
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

  const headers = { "X-Minimap-Repo": repo };
  for (const route of ["/api/items/missing/participants", "/api/board/participant-counts"]) {
    await fs.rm(env.MINIMAP_TEST_DELAY_MARKER, { force: true });
    const responsePromise = fetch(`http://127.0.0.1:${port}${route}`, { headers });
    let delayedReadStarted = false;
    for (let attempt = 0; attempt < 150 && !delayedReadStarted; attempt += 1) {
      delayedReadStarted = await fs.readFile(env.MINIMAP_TEST_DELAY_MARKER, "utf8").then(() => true, () => false);
      if (!delayedReadStarted) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(delayedReadStarted, true, `${route} did not reach the delayed board read before its deadline`);
    const response = await responsePromise;
    assert.equal(response.status, 503, `${route}: ${await response.clone().text()}`);
    assert.equal((await response.json()).error.code, "snapshot_unavailable");
    assert.equal(await fs.readFile(env.MINIMAP_TEST_DELAY_MARKER, "utf8"), "started");
  }
});

test("fresh snapshots reject a Git ref change between initial and final identity reads", { timeout: 30_000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-snapshot-ref-race-"));
  const home = path.join(root, "home"), repo = path.join(root, "repo");
  await Promise.all([fs.mkdir(home), fs.mkdir(repo)]);
  const port = await freePort();
  const preload = path.join(root, "move-ref-after-identity.mjs");
  await fs.writeFile(preload, [
    'import childProcess from "node:child_process";',
    'import { promisify } from "node:util";',
    'import { syncBuiltinESMExports } from "node:module";',
    "const original = childProcess.execFile;",
    "const run = promisify(original);",
    "let moved = false;",
    "function wrapped(...args) { return original.apply(this, args); }",
    "Object.defineProperty(wrapped, promisify.custom, { value: async (...args) => {",
    "  const result = await run(...args);",
    '  if (!moved && args[0] === "git" && args[1]?.includes("--show-toplevel") && args[1]?.includes("--verify") && args[1]?.includes("HEAD")) {',
    "    moved = true;",
    '    await run("git", ["-C", process.env.MINIMAP_TEST_REPO, "update-ref", "refs/heads/main", process.env.MINIMAP_TEST_HEAD], { windowsHide: true });',
    "  }",
    "  return result;",
    "} });",
    "childProcess.execFile = wrapped;",
    "syncBuiltinESMExports();",
    "",
  ].join("\n"));
  await initializeWorkspace(repo);
  await git(repo, "init", "--initial-branch=main");
  await git(repo, "config", "user.email", "test@example.invalid");
  await git(repo, "config", "user.name", "Snapshot Test");
  await git(repo, "add", ".");
  await git(repo, "commit", "-m", "fixture");
  const firstHead = (await execFileAsync("git", ["-C", repo, "rev-parse", "HEAD"], { windowsHide: true })).stdout.trim();
  await git(repo, "commit", "--allow-empty", "-m", "next");
  const nextHead = (await execFileAsync("git", ["-C", repo, "rev-parse", "HEAD"], { windowsHide: true })).stdout.trim();
  await git(repo, "update-ref", "refs/heads/main", firstHead);

  const env = {
    ...process.env,
    MINIMAP_HOME: home,
    MINIMAP_PALLIUM_ENDPOINT: "",
    MINIMAP_TEST_REPO: repo,
    MINIMAP_TEST_HEAD: nextHead,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${pathToFileURL(preload).href}`].filter(Boolean).join(" "),
    PORT: String(port),
  };
  let launcher;
  t.after(async () => {
    await execFileAsync(process.execPath, [path.join(scripts, "stop-server.mjs")], {
      env, windowsHide: true, timeout: 10_000,
    }).catch(() => {});
    if (launcher && launcher.exitCode === null) await new Promise((resolve) => launcher.once("exit", resolve));
    await fs.rm(root, { recursive: true, force: true });
  });
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
  const response = await fetch(`http://127.0.0.1:${port}/api/workspace`, { headers: { "X-Minimap-Repo": repo } });
  assert.equal(response.status, 409, await response.clone().text());
  assert.equal((await response.json()).error.code, "snapshot_invalidated");
});
