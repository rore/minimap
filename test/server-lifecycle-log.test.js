import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createLifecycleLog, lifecycleError, lifecycleLogPath, LIFECYCLE_LOG_LIMIT } from "../package/minimap/src/server-lifecycle-log.js";

const repo = fileURLToPath(new URL("../", import.meta.url));
const runtimeRoot = path.join(repo, "package/minimap");
const scripts = (skill) => path.join(runtimeRoot, "skills", skill, "scripts");
const roadmap = "minimap-roadmap";
const spec = "minimap-spec-review";
async function temp(t) {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-lifecycle-"));
  t.after(async () => {
    try {
      const entry = JSON.parse(await fs.readFile(path.join(home, "server.json"), "utf8"));
      await run(home, entry.port, roadmap, "stop-server.mjs");
    } catch {}
    await fs.rm(home, { recursive: true, force: true });
  });
  return home;
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
function launch(home, port, skill, command, preload) {
  const env = { ...process.env, MINIMAP_HOME: home, PORT: String(port), MINIMAP_PALLIUM_ENDPOINT: "", MINIMAP_PALLIUM_DASHBOARD_ENDPOINT: "" };
  delete env.NODE_OPTIONS;
  const args = [...(preload ? ["--import", `data:text/javascript,${encodeURIComponent(preload)}`] : []), path.join(scripts(skill), command)];
  const child = spawn(process.execPath, args, { cwd: home, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const done = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
  return { child, done };
}
async function run(home, port, skill, command) {
  return launch(home, port, skill, command).done;
}
async function records(home) {
  return (await fs.readFile(lifecycleLogPath(home), "utf8")).trim().split("\n").map(JSON.parse);
}
async function waitStarted(home) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try { const events = await records(home); if (events.some((e) => e.event === "started")) return events; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("isolated packaged server did not start");
}

test("bounded retention, sanitized errors, and harmless logger I/O failure", async (t) => {
  const home = await temp(t);
  const write = createLifecycleLog({ home, sourcePath: path.join(runtimeRoot, "server.js"), version: "test" });
  for (let i = 0; i < 1800; i++) write("startup", { port: i });
  for (const file of [lifecycleLogPath(home), `${lifecycleLogPath(home)}.1`]) assert.ok((await fs.stat(file)).size <= LIFECYCLE_LOG_LIMIT);
  assert.equal((await fs.readdir(home)).length, 2);
  const secret = "PRIVATE_SENTINEL";
  const error = new TypeError(`${secret}\n    at ${secret} (not-a-file.js:2:3)`);
  error.code = secret;
  error.stack += `\n    at ${secret} (${path.join(runtimeRoot, "server.js")}:42:3)\n    at ${secret} (${path.join(home, "private.js")}:1:2)`;
  const safe = lifecycleError(error, runtimeRoot);
  assert.deepEqual(safe, { class: "TypeError", locations: ["server.js:42:3"] });
  write("fatal", { error: safe });
  assert.ok(!(await fs.readFile(lifecycleLogPath(home), "utf8")).includes(secret));
  assert.deepEqual(lifecycleError({ get stack() { throw new Error(secret); } }, runtimeRoot), { class: "Error", locations: [] });
  let nameReads = 0, codeReads = 0;
  assert.deepEqual(lifecycleError({
    get name() { return nameReads++ ? secret : "TypeError"; },
    get code() { return codeReads++ ? secret : "EACCES"; },
  }, runtimeRoot), { class: "TypeError", code: "EACCES", locations: [] });
  assert.equal(nameReads, 1);
  assert.equal(codeReads, 1);
  const blocker = path.join(home, "blocked");
  await fs.writeFile(blocker, "not a directory");
  assert.doesNotThrow(() => createLifecycleLog({ home: blocker, sourcePath: "test" })("exit", { code: 1 }));
});

test("packaged foreground and detached restart share logging; both statuses retain evidence", { timeout: 25000 }, async (t) => {
  const home = await temp(t), port = await freePort();
  const foreground = launch(home, port, roadmap, "start-server.mjs");
  await waitStarted(home);
  assert.equal((await run(home, port, roadmap, "status.mjs")).code, 0);
  const restarted = await run(home, port, roadmap, "restart-server.mjs");
  assert.equal(restarted.code, 0, restarted.stderr);
  assert.equal((await foreground.done).code, 0);
  assert.equal((await run(home, port, spec, "stop-server.mjs")).code, 0);
  const events = await records(home);
  assert.ok(events.some((e) => e.event === "started" && e.launchMode === "foreground-start" && e.version !== "unknown" && e.port === port));
  assert.ok(events.some((e) => e.event === "started" && e.launchMode === "ipc-detached-restart"));
  assert.equal(events.filter((e) => e.event === "shutdown" && e.reason === "SHUTDOWN_API").length, 2);
  assert.equal(events.filter((e) => e.event === "exit" && e.code === 0).length, 2);
  for (const skill of [roadmap, spec]) {
    const status = await run(home, port, skill, "status.mjs");
    assert.equal(status.code, 3);
    assert.match(status.stdout, /lifecycle log:/);
    assert.match(status.stdout, /historical PIDs; not proof/);
    assert.match(status.stdout, /"event":"exit"/);
  }
});

test("fatal throw and unhandled rejection preserve nonzero default exit and stale evidence", { timeout: 25000 }, async (t) => {
  for (const failure of ["throw error", "Promise.reject(error)"]) {
    const home = await temp(t), port = await freePort();
    const preload = `import fs from 'node:fs'; import path from 'node:path'; const timer=setInterval(()=>{ if (fs.existsSync(path.join(process.env.MINIMAP_HOME,'server.json'))) { clearInterval(timer); const error=new TypeError('PRIVATE_SENTINEL\\nsecret continuation'); error.code='ERR_INVALID_ARG_TYPE'; error.stack+='\\n    at PRIVATE_SENTINEL ('+${JSON.stringify(path.join(runtimeRoot, "skills/minimap-roadmap/runtime/server.js"))}+':42:3)'; ${failure}; } },20); timer.unref();`;
    const result = await launch(home, port, roadmap, "start-server.mjs", preload).done;
    assert.equal(result.code, 1, result.stderr);
    const raw = await fs.readFile(lifecycleLogPath(home), "utf8");
    assert.ok(!raw.includes("PRIVATE_SENTINEL"));
    const events = await records(home);
    assert.ok(events.some((e) => e.event === "fatal" && e.error.code === "ERR_INVALID_ARG_TYPE" && e.error.locations.includes("server.js:42:3")));
    assert.ok(events.some((e) => e.event === "exit" && e.code === 1));
    const status = await run(home, port, spec, "status.mjs");
    assert.equal(status.code, 1);
    assert.match(status.stdout, /"event":"fatal"/);
    assert.equal((await run(home, port, roadmap, "stop-server.mjs")).code, 0);
  }
});

test("status marks missing exit unknown without inventing an abrupt-death cause", async (t) => {
  const home = await temp(t), port = await freePort();
  createLifecycleLog({ home, sourcePath: "isolated fixture" })("startup", { port });
  for (const skill of [roadmap, spec]) {
    const status = await run(home, port, skill, "status.mjs");
    assert.equal(status.code, 3);
    assert.match(status.stdout, /Final exit: unknown.*hard kill\/job teardown cannot be logged/);
  }
});

test("logger I/O failure cannot prevent packaged startup or graceful shutdown", { timeout: 15000 }, async (t) => {
  const home = await temp(t), port = await freePort();
  await fs.mkdir(lifecycleLogPath(home));
  const foreground = launch(home, port, roadmap, "start-server.mjs");
  const deadline = Date.now() + 8000;
  while (true) {
    try { await fs.stat(path.join(home, "server.json")); break; } catch {}
    assert.ok(Date.now() < deadline, "startup must not depend on successful logging");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal((await run(home, port, spec, "status.mjs")).code, 0);
  assert.equal((await run(home, port, roadmap, "stop-server.mjs")).code, 0);
  assert.equal((await foreground.done).code, 0);
});

test("controlled startup and registry-cleanup failures leave sanitized evidence", { timeout: 15000 }, async (t) => {
  const failedHome = await temp(t);
  const failed = await run(failedHome, "invalid", roadmap, "start-server.mjs");
  assert.equal(failed.code, 1);
  assert.ok((await records(failedHome)).some((e) => e.event === "startup-failed" && e.error.class === "RangeError"));
  const home = await temp(t), port = await freePort();
  const preload = `import fs from 'node:fs/promises'; const unlink=fs.unlink; fs.unlink=async function(file,...args){if(String(file).endsWith('server.json')){ const error=new Error('PRIVATE_SENTINEL');error.code='EACCES';throw error; } return unlink.call(this,file,...args);};`;
  const foreground = launch(home, port, roadmap, "start-server.mjs", preload);
  await waitStarted(home);
  assert.equal((await run(home, port, roadmap, "stop-server.mjs")).code, 0);
  assert.equal((await foreground.done).code, 0);
  const events = await records(home);
  assert.ok(events.some((e) => e.event === "registry-cleanup-failed" && e.error.code === "EACCES"));
  assert.ok(!(await fs.readFile(lifecycleLogPath(home), "utf8")).includes("PRIVATE_SENTINEL"));
  assert.equal((await run(home, port, spec, "status.mjs")).code, 1);
  assert.equal((await run(home, port, roadmap, "stop-server.mjs")).code, 0);
});
