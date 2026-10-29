import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createUserService, serviceDefinitions } from "../package/minimap/src/user-service.js";

const root = fileURLToPath(new URL("../package/minimap", import.meta.url));
const exec = promisify(execFile);
async function port() {
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const value = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return value;
}

test("isolated foreground lifecycle uses one stable runtime, preserves settings and rolls back", { timeout: 45000 }, async (t) => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-user-service-live-"));
  const selectedPort = await port();
  const env = { ...process.env, MINIMAP_HOME: home, PORT: String(selectedPort), UV_THREADPOOL_SIZE: "3",
    MINIMAP_PALLIUM_ENDPOINT: "", MINIMAP_PALLIUM_DASHBOARD_ENDPOINT: "" };
  delete env.NODE_OPTIONS;
  let definition = null, child = null, diagnostics = "", service;
  const native = {
    identity: async () => "isolated-test-user",
    query: async () => definition && { ...definition, running: Boolean(child && child.exitCode === null) },
    register: async (config) => { definition = { ...serviceDefinitions(config, service.paths), cwd: service.paths.root, userId: config.userId }; },
    enable: async () => {},
    start: async () => {
      child = spawn(process.execPath, [service.paths.runner, service.paths.config], { env, cwd: home, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      child.stdout.on("data", (data) => { diagnostics += data; });
      child.stderr.on("data", (data) => { diagnostics += data; });
    },
    remove: async () => { definition = null; },
  };
  service = createUserService({ env, home, source: root, native, timeout: 8000 });
  t.after(async () => {
    try { if (await service.config()) await service.action("uninstall"); }
    finally { if (!child || child.exitCode !== null) await fs.rm(home, { recursive: true, force: true }); }
  });
  await fs.writeFile(path.join(home, "sessions-do-not-delete.jsonl"), "existing data");
  await service.action("install");
  const initial = await service.config();
  const status = await service.action("status");
  assert.equal(status.code, 0, diagnostics);
  assert.equal(status.port, selectedPort);
  assert.equal(status.pid, child.pid);
  assert.match(status.source, /service[\\/]releases/);
  assert.equal(initial.settings.UV_THREADPOOL_SIZE, "3");
  for (const skill of ["minimap-roadmap", "minimap-spec-review"]) {
    // Exercise each real lifecycle entrypoint without invoking the native OS backend:
    // a conflicting port must be rejected by routing before any OS command runs.
    for (const entrypoint of ["start-server.mjs", "start-server.cjs"]) {
      const routed = await new Promise((resolve, reject) => {
        const process = spawn(initial.node, [path.join(root, "skills", skill, "scripts", entrypoint)], { env: { ...env, PORT: String(selectedPort + 1) }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "", stderr = "";
        process.stdout.on("data", (data) => { stdout += data; });
        process.stderr.on("data", (data) => { stderr += data; });
        process.once("error", reject);
        process.once("close", (code) => resolve({ code, stdout, stderr }));
      });
      assert.match(routed.stderr, /port is pinned/, JSON.stringify({ ...routed, entrypoint }));
      assert.notEqual(routed.code, 0);
    }
  }
  const oldPid = child.pid;
  await service.action("update");
  assert.notEqual(child.pid, oldPid, diagnostics);
  assert.equal((await service.config()).previous, initial.current);
  await service.action("rollback");
  assert.equal((await service.config()).current, initial.current);
  await service.action("stop");
  assert.equal((await service.action("status")).code, 3);
  await service.action("update");
  assert.equal((await service.action("status")).code, 3, "stopped update must not launch a server");
  await service.action("start");
  assert.equal((await service.action("status")).code, 0, diagnostics);
  await service.action("uninstall");
  assert.equal(await fs.readFile(path.join(home, "sessions-do-not-delete.jsonl"), "utf8"), "existing data");
});

test("Windows hidden wrapper waits for an isolated Unicode-path Node fixture and forwards failure", { skip: process.platform !== "win32", timeout: 15000 }, async (t) => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-vbs-日本語 & spaces-"));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  const runner = path.join(home, "fixture.cjs"), config = path.join(home, "config with space.json"), wrapper = path.join(home, "fixture.vbs");
  await fs.writeFile(runner, `require('node:fs').writeFileSync(process.argv[2], 'verified'); process.exitCode = 7;\n`);
  const generated = serviceDefinitions({ platform: "win32", token: "fixture", userId: "fixture", node: process.execPath, wscript: "C:\\Windows\\System32\\wscript.exe", enabled: true }, { root: home, runner, config, wrapper });
  await fs.writeFile(wrapper, Buffer.from("\ufeff" + generated.wrapper, "utf16le"));
  await assert.rejects(exec("cscript.exe", ["//nologo", wrapper], { windowsHide: true }), (error) => error.code === 7);
  assert.equal(await fs.readFile(config, "utf8"), "verified");
});
