import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../package/minimap/skills/", import.meta.url));
const skills = ["minimap-roadmap", "minimap-spec-review"];

async function temporary(t) {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-bootstrap-"));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  return home;
}

function environment(home, pool) {
  const env = { ...process.env, MINIMAP_HOME: home,
    MINIMAP_PALLIUM_ENDPOINT: "", MINIMAP_PALLIUM_DASHBOARD_ENDPOINT: "" };
  delete env.NODE_OPTIONS;
  delete env.UV_THREADPOOL_SIZE;
  if (pool !== undefined) env.UV_THREADPOOL_SIZE = pool;
  return env;
}

function run(args, env, ipc = false) {
  const child = spawn(process.execPath, args, { env, cwd: env.MINIMAP_HOME,
    windowsHide: true, stdio: ["ignore", "pipe", "pipe", ...(ipc ? ["ipc"] : [])] });
  let stdout = "", stderr = "", message;
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("message", (value) => { message = value; });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr, message, pid: child.pid }));
  });
}

test("both CJS bootstraps set only absent defaults before importing, retaining PID, IPC and arguments", { timeout: 20000 }, async (t) => {
  const home = await temporary(t);
  const launcher = path.join(home, "start-server.cjs");
  await fs.writeFile(path.join(home, "start-server.mjs"), `
    const result = { pid: process.pid, pool: process.env.UV_THREADPOOL_SIZE, args: process.argv.slice(2) };
    process.stdout.write(JSON.stringify(result));
    if (process.send) process.send(result, () => process.disconnect());
  `);
  for (const skill of skills) {
    await fs.copyFile(path.join(root, skill, "scripts/start-server.cjs"), launcher);
    for (const pool of [undefined, "3", ""]) {
      const env = environment(home, pool);
      const result = await run([launcher, "--sentinel", "two words"], env, true);
      assert.equal(result.code, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), { pid: result.pid, pool: pool ?? "8", args: ["--sentinel", "two words"] });
      assert.deepEqual(result.message, JSON.parse(result.stdout));
      assert.equal(env.UV_THREADPOOL_SIZE, pool, "child default must not mutate the caller's environment");
    }
  }
});

test("bootstrap preserves the imported launcher's nonzero exit", { timeout: 10000 }, async (t) => {
  const home = await temporary(t);
  await fs.copyFile(path.join(root, skills[0], "scripts/start-server.cjs"), path.join(home, "start-server.cjs"));
  await fs.writeFile(path.join(home, "start-server.mjs"), "process.exitCode = 7;\n");
  assert.equal((await run([path.join(home, "start-server.cjs")], environment(home))).code, 7);
});

test("bootstrap import failures remain fatal under permissive rejection policies", { timeout: 10000 }, async (t) => {
  const home = await temporary(t);
  const launcher = path.join(home, "start-server.cjs");
  await fs.writeFile(path.join(home, "start-server.mjs"), 'throw new Error("launcher failure sentinel");\n');
  for (const skill of skills) {
    await fs.copyFile(path.join(root, skill, "scripts/start-server.cjs"), launcher);
    for (const policy of ["warn", "none"]) {
      const result = await run([`--unhandled-rejections=${policy}`, launcher], environment(home));
      assert.equal(result.code, 1, result.stderr);
      assert.match(result.stderr, /launcher failure sentinel/);
    }
  }
});

test("both restart scripts default only the new child environment and retain their launch contract", { timeout: 20000 }, async (t) => {
  const home = await temporary(t);
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const preload = path.join(home, "observe-spawn.cjs");
  // Stop at the real restart script's spawn boundary; no server is created.
  await fs.writeFile(preload, `
    const childProcess = require("node:child_process");
    childProcess.spawn = (file, args, options) => {
      process.stdout.write(JSON.stringify({ file, args, pool: options.env.UV_THREADPOOL_SIZE,
        parentPool: process.env.UV_THREADPOOL_SIZE ?? null,
        detached: options.detached, stdio: options.stdio, windowsHide: options.windowsHide }));
      process.exit(0);
    };
    require("node:module").syncBuiltinESMExports();
  `);
  for (const skill of skills) {
    for (const pool of [undefined, "3", ""]) {
      const env = { ...environment(home, pool), PORT: String(port) };
      const result = await run(["--require", preload, path.join(root, skill, "scripts/restart-server.mjs")], env);
      assert.equal(result.code, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), { file: process.execPath,
        args: [path.join(root, skill, "runtime/server.js")], pool: pool ?? "8", parentPool: pool ?? null,
        detached: true, stdio: ["ignore", "ignore", "ignore", "ipc"], windowsHide: true });
      await assert.rejects(fs.access(path.join(home, "restart.lock")), { code: "ENOENT" });
    }
  }
});
