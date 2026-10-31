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
import { readWorktreeIdentity } from "../package/minimap/src/worktree-sources.js";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = path.join(projectRoot, "package", "minimap", "skills", "minimap-roadmap", "scripts");
const gitFaultsUrl = new URL("../scripts/test-fixtures/git-read-faults.mjs", import.meta.url).href;

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

test("bound workspace validation shares its original read budget and cancels on disconnect", { timeout: 30_000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-bound-read-budget-"));
  const home = path.join(root, "home"), repo = path.join(root, "repo");
  await Promise.all([fs.mkdir(home), fs.mkdir(repo)]);
  await initializeWorkspace(repo);
  await git(repo, "init", "--initial-branch=main");
  await git(repo, "config", "user.email", "test@example.invalid");
  await git(repo, "config", "user.name", "Budget Test");
  await git(repo, "add", ".");
  await git(repo, "commit", "-m", "fixture");
  const source = { ...await readWorktreeIdentity(repo), roadmapBinding: { roadmapPath: "roadmap", resolvedPath: path.join(repo, "roadmap") } };
  const modeFile = path.join(root, "mode"), eventsFile = path.join(root, "events.jsonl");
  const preload = path.join(root, "bound-budget.mjs");
  await fs.writeFile(preload, [
    `import { installGitReadFaults } from ${JSON.stringify(gitFaultsUrl)};`,
    'import fs from "node:fs/promises";',
    'import fsSync from "node:fs";',
    'import { ServerResponse } from "node:http";',
    'import path from "node:path";',
    'const log = (event) => fs.appendFile(process.env.MINIMAP_TEST_EVENTS, JSON.stringify(event)+"\\n");',
    'let mode = "", initial = false;',
    'const timeout = AbortSignal.timeout.bind(AbortSignal);',
    'AbortSignal.timeout = (ms) => { if(ms===30_000) void log({type:"budget"}); return timeout(ms===30_000 ? 1500 : ms); };',
    'installGitReadFaults({matches:(command,args,options)=>command==="git" && path.resolve(options?.cwd||"").toLowerCase()===path.resolve(process.env.MINIMAP_TEST_REPO).toLowerCase() && args?.includes("--show-toplevel"),before:async ({options})=>{',
    '  const next=await fs.readFile(process.env.MINIMAP_TEST_MODE,"utf8"); if(next!==mode) {mode=next;initial=false;}',
    '  if(!initial) { initial=true; const signal=options?.signal; await log({type:"validation",mode,signaled:!!signal});',
    '   if(mode!=="reuse" && signal) await new Promise((resolve,reject)=>{',
    '    const abort=()=>{ void log({type:"aborted",mode,reason:signal.reason?.name}).then(()=>reject(signal.reason)); };',
    '    signal.addEventListener("abort",abort,{once:true}); if(signal.aborted) abort();',
    '   });',
    '  }',
    '}});',
    'const writeHead=ServerResponse.prototype.writeHead;',
    'ServerResponse.prototype.writeHead=function(...args){if(this.req?.url?.startsWith("/api/source/workspace")) {const mode=fsSync.readFileSync(process.env.MINIMAP_TEST_MODE,"utf8");fsSync.appendFileSync(process.env.MINIMAP_TEST_EVENTS,JSON.stringify({type:"response",mode,destroyed:this.destroyed})+"\\n");}return writeHead.apply(this,args);};',
  ].join("\n"));
  const port = await freePort();
  const env = { ...process.env, MINIMAP_HOME: home, PORT: String(port), MINIMAP_PALLIUM_ENDPOINT: "",
    MINIMAP_TEST_REPO: repo, MINIMAP_TEST_MODE: modeFile, MINIMAP_TEST_EVENTS: eventsFile,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${pathToFileURL(preload).href}`].filter(Boolean).join(" ") };
  let launcher;
  t.after(async () => {
    await execFileAsync(process.execPath, [path.join(scripts, "stop-server.mjs")], { env, windowsHide: true, timeout: 10_000 }).catch(() => {});
    if (launcher && launcher.exitCode === null) await new Promise((resolve) => launcher.once("exit", resolve));
    await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });
  launcher = spawn(process.execPath, [path.join(scripts, "start-server.cjs")], { cwd: projectRoot, env, windowsHide: true, stdio: "ignore" });
  let ready = false;
  for (let attempt = 0; attempt < 100 && !ready; attempt++) {
    if (launcher.exitCode !== null) throw new Error(`Packaged launcher exited ${launcher.exitCode}.`);
    try { ready = (await fetch(`http://127.0.0.1:${port}/health`)).ok; } catch {}
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(ready, true);
  const events = async () => (await fs.readFile(eventsFile, "utf8").catch(() => "")).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  for (const mode of ["timeout", "disconnect", "reuse"]) await t.test(mode, async () => {
    await fs.writeFile(modeFile, mode);
    const before = (await events()).filter((event) => event.type === "budget").length;
    const controller = new AbortController();
    const pending = fetch(`http://127.0.0.1:${port}/api/source/workspace`, {
      headers: { "X-Minimap-Repo": repo, "X-Minimap-Source-Context": JSON.stringify(source) }, signal: controller.signal,
    }).then((response) => ({ response }), (error) => ({ error }));
    for (let attempt = 0; attempt < 100 && !(await events()).some((event) => event.type === "validation" && event.mode === mode); attempt++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    if (mode === "disconnect") controller.abort();
    const outcome = await pending;
    if (mode === "disconnect") {
      assert.equal(outcome.error?.name, "AbortError");
      for (let attempt = 0; attempt < 100 && !(await events()).some((event) => event.type === "aborted" && event.mode === mode); attempt++)
        await new Promise((resolve) => setTimeout(resolve, 20));
      const recorded = await events();
      assert.equal(recorded.find((event) => event.type === "aborted" && event.mode === mode)?.reason, "AbortError");
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal((await events()).some((event) => event.type === "response" && event.mode === mode), false, "disconnected bound read must not write or fall through to static routing");
    } else {
      assert.equal(outcome.response?.status, mode === "timeout" ? 503 : 200, await outcome.response?.clone().text());
      if (mode === "timeout") assert.equal((await outcome.response.json()).error.code, "snapshot_unavailable");
    }
    const recorded = await events();
    assert.equal(recorded.find((event) => event.type === "validation" && event.mode === mode)?.signaled, true);
    assert.equal(recorded.filter((event) => event.type === "budget").length - before, 1, "validation and workspace handler must share one original request budget");
  });
});

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
    "AbortSignal.timeout = (milliseconds) => original([30_000, 60_000].includes(milliseconds) ? 2_000 : milliseconds);",
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
  launcher = spawn(process.execPath, [path.join(scripts, "start-server.cjs")], {
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
  for (const { route, message } of [
    { route: "/api/items/missing/participants" },
    { route: "/api/board/participant-counts" },
    { route: "/api/worktree-workspace?compact=1&participants=0", message: "Snapshot request exceeded its 60-second budget." },
  ]) {
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
    const body = await response.json();
    assert.equal(body.error.code, "snapshot_unavailable");
    if (message) assert.equal(body.error.message, message);
    assert.equal(await fs.readFile(env.MINIMAP_TEST_DELAY_MARKER, "utf8"), "started");
  }
});

for (const mode of ["this", "across"]) test(`${mode} snapshots reject a Git ref change at final identity validation`, { timeout: 30_000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-snapshot-ref-race-"));
  const home = path.join(root, "home"), repo = path.join(root, "repo");
  await Promise.all([fs.mkdir(home), fs.mkdir(repo)]);
  const port = await freePort();
  const preload = path.join(root, "move-ref-after-identity.mjs");
  await fs.writeFile(preload, [
    `import { installGitReadFaults } from ${JSON.stringify(gitFaultsUrl)};`,
    'import fs from "node:fs/promises";',
    'import path from "node:path";',
    "let moved = false, identityReads = 0;",
    "const boards = new Map(); const readFile = fs.readFile; let boardWrites=Promise.resolve();",
    "fs.readFile = async (file,...args) => { if(path.basename(String(file))==='board.md') { boards.set(String(file),(boards.get(String(file))||0)+1); const counts=JSON.stringify([...boards.values()]); boardWrites=boardWrites.then(()=>fs.writeFile(process.env.MINIMAP_TEST_BOARD_COUNTS,counts)); await boardWrites; } return readFile(file,...args); };",
    'installGitReadFaults({matches:(command,args,options)=>command==="git" && path.resolve(options?.cwd || "").toLowerCase()===path.resolve(process.env.MINIMAP_TEST_REPO).toLowerCase() && args?.includes("--show-toplevel") && args?.includes("--verify"),before:async ({run})=>{',
    '  if (!moved && ++identityReads === Number(process.env.MINIMAP_TEST_IDENTITY_READ)) {',
    "    moved = true;",
    '    await run("git", ["-C", process.env.MINIMAP_TEST_REPO, "update-ref", "refs/heads/main", process.env.MINIMAP_TEST_HEAD], { windowsHide: true });',
    '    await fs.writeFile(process.env.MINIMAP_TEST_PHASE, await readFile(process.env.MINIMAP_TEST_BOARD_COUNTS,"utf8"));',
    "  }",
    "}});",
    "",
  ].join("\n"));
  await initializeWorkspace(repo);
  await fs.writeFile(path.join(repo, "roadmap/features/.keep"), "");
  await fs.writeFile(path.join(repo, "roadmap/ideas/.keep"), "");
  await git(repo, "init", "--initial-branch=main");
  await git(repo, "config", "user.email", "test@example.invalid");
  await git(repo, "config", "user.name", "Snapshot Test");
  await git(repo, "add", ".");
  await git(repo, "commit", "-m", "fixture");
  const firstHead = (await execFileAsync("git", ["-C", repo, "rev-parse", "HEAD"], { windowsHide: true })).stdout.trim();
  await git(repo, "commit", "--allow-empty", "-m", "next");
  const nextHead = (await execFileAsync("git", ["-C", repo, "rev-parse", "HEAD"], { windowsHide: true })).stdout.trim();
  await git(repo, "update-ref", "refs/heads/main", firstHead);
  if (mode === "across") for (let index = 0; index < 3; index++)
    await git(repo, "worktree", "add", "--detach", path.join(root, `sibling-${index}`));

  const env = {
    ...process.env,
    MINIMAP_HOME: home,
    MINIMAP_PALLIUM_ENDPOINT: "",
    MINIMAP_TEST_REPO: repo,
    MINIMAP_TEST_HEAD: nextHead,
    MINIMAP_TEST_IDENTITY_READ: mode === "across" ? "3" : "2",
    MINIMAP_TEST_PHASE: path.join(root, "phase.json"),
    MINIMAP_TEST_BOARD_COUNTS: path.join(root, "board-counts.json"),
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
  launcher = spawn(process.execPath, [path.join(scripts, "start-server.cjs")], {
    cwd: projectRoot, env, windowsHide: true, stdio: "ignore",
  });
  let ready = false;
  for (let attempt = 0; attempt < 100 && !ready; attempt += 1) {
    if (launcher.exitCode !== null) throw new Error(`Packaged server launcher exited ${launcher.exitCode}.`);
    try { ready = (await fetch(`http://127.0.0.1:${port}/health`)).ok; } catch {}
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(ready, true, "packaged server did not become ready");
  const route = mode === "across" ? "/api/worktree-workspace?participants=0&compact=1" : "/api/workspace";
  const response = await fetch(`http://127.0.0.1:${port}${route}`, { headers: { "X-Minimap-Repo": repo } });
  assert.equal(response.status, 409, await response.clone().text());
  assert.equal((await response.json()).error.code, "snapshot_invalidated");
  const boards = JSON.parse(await fs.readFile(env.MINIMAP_TEST_PHASE, "utf8"));
  assert.equal(boards.length, mode === "across" ? 4 : 1);
  assert.ok(boards.every((count) => count === 2), "Every batch workspace was freshly revalidated before final identities");
});

test("fresh snapshots reject a Git ref change between initial and final identity reads", { timeout: 30_000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-snapshot-ref-race-"));
  const home = path.join(root, "home"), repo = path.join(root, "repo");
  await Promise.all([fs.mkdir(home), fs.mkdir(repo)]);
  const port = await freePort();
  const preload = path.join(root, "move-ref-after-identity.mjs");
  await fs.writeFile(preload, [
    `import { installGitReadFaults } from ${JSON.stringify(gitFaultsUrl)};`,
    'import path from "node:path";',
    "let moved = false;",
    'installGitReadFaults({matches:(command,args,options)=>command==="git" && path.resolve(options?.cwd || "").toLowerCase()===path.resolve(process.env.MINIMAP_TEST_REPO).toLowerCase() && args?.includes("--show-toplevel") && args?.includes("--verify") && args?.includes("HEAD"),after:async ({run})=>{',
    '  if (!moved) {',
    "    moved = true;",
    '    await run("git", ["-C", process.env.MINIMAP_TEST_REPO, "update-ref", "refs/heads/main", process.env.MINIMAP_TEST_HEAD], { windowsHide: true });',
    "  }",
    "}});",
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
  launcher = spawn(process.execPath, [path.join(scripts, "start-server.cjs")], {
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
