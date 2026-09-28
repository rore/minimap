import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const skill = fileURLToPath(new URL("../package/minimap/skills/minimap-spec-review/", import.meta.url));
const sourcePath = await fs.realpath(path.join(skill, "runtime", "server.js"));
const { version } = JSON.parse(await fs.readFile(path.join(skill, "runtime", "package.json"), "utf8"));
const runtime = { version, apiCompatibility: 1, sourcePath };
const participants = { mode: "disabled", links: "disabled", configId: "disabled" };

async function context() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-runtime-"));
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return { home, port };
}

function run(ctx, name, args = []) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, MINIMAP_HOME: ctx.home, PORT: String(ctx.port), MINIMAP_PALLIUM_ENDPOINT: "", MINIMAP_PALLIUM_DASHBOARD_ENDPOINT: "" };
    const child = spawn(process.execPath, [path.join(skill, "scripts", name), ...args], {
      cwd: ctx.home, env, stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function fixture(ctx, identity, register = true, { pid = process.pid, registryPid = 123456 } = {}) {
  let shutdowns = 0;
  const server = http.createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Connection", "close");
    if (request.url === "/health") {
      response.end(JSON.stringify({ ok: true, ...(pid === null ? {} : { pid }), participants, ...(identity === undefined ? {} : { runtime: identity }) }));
    } else if (request.url === "/api/shutdown") {
      shutdowns += 1;
      response.end(JSON.stringify({ ok: true }));
      server.close();
      server.closeIdleConnections();
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(ctx.port, "127.0.0.1", resolve));
  if (register) await fs.writeFile(path.join(ctx.home, "server.json"), JSON.stringify({
    pid: registryPid, port: ctx.port, version: "stale-registry-version", startedAt: "old", sourcePath: "stale-registry-path",
  }));
  return {
    get shutdowns() { return shutdowns; },
    async close() {
      if (!server.listening) return;
      server.closeIdleConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

const readRegistry = (ctx) => fs.readFile(path.join(ctx.home, "server.json"), "utf8");
const health = (ctx) => fetch(`http://127.0.0.1:${ctx.port}/health`).then((response) => response.json());

test("compatible runtime reuses different versions and reports live identity, not registry metadata", async () => {
  const ctx = await context();
  const identity = { ...runtime, version: "0.0.1", sourcePath: await fs.realpath(fileURLToPath(new URL("../package/minimap/server.js", import.meta.url))) };
  const server = await fixture(ctx, identity);
  try {
    const before = await readRegistry(ctx);
    const result = await run(ctx, "start-server.mjs");
    assert.equal(result.code, 0, result.stderr);
    assert.equal(server.shutdowns, 0);
    assert.equal(await readRegistry(ctx), before);
    const status = await run(ctx, "status.mjs");
    assert.equal(status.code, 0, status.stderr);
    assert.match(status.stdout, /version:\s*0\.0\.1/);
    assert.ok(status.stdout.includes(identity.sourcePath));
    assert.match(status.stdout, new RegExp(`pid:\\s*${process.pid}\\b`));
    assert.ok(!status.stdout.includes("stale-registry-version"));
    assert.ok(!status.stdout.includes("stale-registry-path"));
  } finally { await server.close(); }
});

test("unknown and incompatible runtimes cannot be reused or restarted implicitly", async (t) => {
  for (const [name, identity] of [
    ["legacy", undefined],
    ["incompatible API", { ...runtime, apiCompatibility: 2 }],
    ["missing version", { apiCompatibility: 1, sourcePath }],
    ["relative source", { ...runtime, sourcePath: "server.js" }],
  ]) {
    await t.test(name, async () => {
      const ctx = await context();
      const server = await fixture(ctx, identity);
      const preferencePath = path.join(ctx.home, "pallium-preference.json");
      const preference = JSON.stringify({ palliumEndpoint: "http://127.0.0.1:19836" });
      await fs.writeFile(preferencePath, preference);
      try {
        const before = await readRegistry(ctx);
        for (const script of ["start-server.mjs", "restart-server.mjs"]) {
          const result = await run(ctx, script);
          assert.equal(result.code, 1, `${name}: ${script}: ${result.stderr}`);
          assert.match(result.stderr, /runtime|compatib/i);
          assert.equal(server.shutdowns, 0);
          assert.equal(await readRegistry(ctx), before);
          assert.equal(await fs.readFile(preferencePath, "utf8"), preference);
          assert.equal((await health(ctx)).ok, true);
        }
      } finally { await server.close(); }
    });
  }
});

test("same version from a different source refuses default restart", async () => {
  const ctx = await context();
  const server = await fixture(ctx, { ...runtime, sourcePath: await fs.realpath(fileURLToPath(new URL("../package/minimap/server.js", import.meta.url))) }, true, { registryPid: process.pid });
  try {
    const before = await readRegistry(ctx);
    const result = await run(ctx, "restart-server.mjs");
    assert.equal(result.code, 1, result.stderr);
    assert.match(result.stderr, /--replace-runtime/);
    assert.equal(server.shutdowns, 0);
    assert.equal(await readRegistry(ctx), before);
  } finally { await server.close(); }
});

test("restart refuses stale or missing registered PID even for the same runtime", async (t) => {
  for (const [name, identity] of [["stale registry PID", {}], ["missing live PID", { pid: null, registryPid: null }]]) {
    await t.test(name, async () => {
      const ctx = await context();
      const server = await fixture(ctx, runtime, true, identity);
      try {
        const before = await readRegistry(ctx);
        const result = await run(ctx, "restart-server.mjs");
        assert.equal(result.code, 1, result.stderr);
        assert.match(result.stderr, /--replace-runtime/);
        assert.equal(server.shutdowns, 0);
        assert.equal(await readRegistry(ctx), before);
        assert.equal((await health(ctx)).ok, true);
      } finally { await server.close(); }
    });
  }
});

test("restart preflights unregistered requested targets before shutting down a registered runtime", async (t) => {
  for (const [name, identity] of [["unknown", undefined], ["same runtime", runtime]]) {
    await t.test(name, async () => {
      const registered = await context();
      const requested = { ...(await context()), home: registered.home };
      const owned = await fixture(registered, runtime, true, { registryPid: process.pid });
      const foreign = await fixture(requested, identity, false);
      try {
        const before = await readRegistry(registered);
        const result = await run(requested, "restart-server.mjs");
        assert.equal(result.code, 1, result.stderr);
        assert.match(result.stderr, /--replace-runtime/);
        assert.equal(owned.shutdowns, 0);
        assert.equal(foreign.shutdowns, 0);
        assert.equal(await readRegistry(registered), before);
        assert.equal((await health(registered)).ok, true);
        assert.equal((await health(requested)).ok, true);
      } finally {
        await owned.close();
        await foreign.close();
      }
    });
  }
});

test("same-runtime routine restart and concurrent restarts retain a healthy owned child", async () => {
  const ctx = await context();
  try {
    let result = await run(ctx, "restart-server.mjs");
    assert.equal(result.code, 0, result.stderr);
    const first = await health(ctx);
    assert.deepEqual(first.runtime, runtime);
    assert.equal(typeof first.pid, "number");
    result = await run(ctx, "restart-server.mjs");
    assert.equal(result.code, 0, result.stderr);
    assert.notEqual((await health(ctx)).pid, first.pid);
    const results = await Promise.all([run(ctx, "restart-server.mjs", ["--replace-runtime"]), run(ctx, "restart-server.mjs", ["--replace-runtime"])]);
    for (const replacement of results) assert.equal(replacement.code, 0, replacement.stderr);
    const live = await health(ctx);
    const registry = JSON.parse(await readRegistry(ctx));
    assert.equal(registry.pid, live.pid);
    assert.deepEqual(live.runtime, runtime);
    await assert.rejects(fs.access(path.join(ctx.home, "restart.lock")), { code: "ENOENT" });
  } finally { await run(ctx, "stop-server.mjs"); }
});

test("explicit replacement replaces older and legacy runtimes", async (t) => {
  for (const [name, identity] of [["older", { ...runtime, version: "0.0.1" }], ["legacy", undefined], ["incompatible", { ...runtime, apiCompatibility: 2 }]]) {
    await t.test(name, async () => {
      const ctx = await context();
      const server = await fixture(ctx, identity);
      try {
        const before = await readRegistry(ctx);
        const refused = await run(ctx, "restart-server.mjs");
        assert.equal(refused.code, 1, refused.stderr);
        assert.match(refused.stderr, /--replace-runtime/);
        assert.equal(server.shutdowns, 0);
        assert.equal(await readRegistry(ctx), before);
        const result = await run(ctx, "restart-server.mjs", ["--replace-runtime"]);
        assert.equal(result.code, 0, result.stderr);
        assert.equal(server.shutdowns, 1);
        const live = await health(ctx);
        assert.deepEqual(live.runtime, runtime);
        assert.equal(JSON.parse(await readRegistry(ctx)).pid, live.pid);
      } finally {
        await run(ctx, "stop-server.mjs");
        await server.close();
      }
    });
  }
});
