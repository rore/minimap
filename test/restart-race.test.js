import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("restart cleans up its own child when another server replaces the registry", async () => {
  const installRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-restart-race-"));
  const skillRoot = path.join(installRoot, "minimap-roadmap");
  await fs.cp(path.join(projectRoot, "package", "minimap", "skills", "minimap-roadmap"), skillRoot, { recursive: true });

  const serverPath = path.join(skillRoot, "runtime", "server.js");
  const serverSource = await fs.readFile(serverPath, "utf8");
  const tick = String.fromCharCode(96);
  const startupLog = "    process.stdout.write(" + tick + "Minimap running at http://localhost:" + "$" + "{boundPort}" + "$" + "{fallbackNote}\\n" + tick + ");";
  assert.ok(serverSource.includes(startupLog));
  await fs.writeFile(serverPath, serverSource
    .replace("configId: palliumConfigId(palliumConfig)", 'configId: "forced-mismatch"')
    .replace(startupLog, '    await writeServerRegistry({ pid: 99991, port: 4456, version: "racer" });\n' + startupLog), "utf8");

  const restartPath = path.join(skillRoot, "scripts", "restart-server.mjs");
  const restartSource = await fs.readFile(restartPath, "utf8");
  await fs.writeFile(restartPath, restartSource
    .replace("const SWEEP_PORTS_FROM = 4312;", "const SWEEP_PORTS_FROM = 4457;")
    .replace("const SWEEP_PORTS_TO = 4320;", "const SWEEP_PORTS_TO = 4457;"), "utf8");

  const fake = http.createServer((_request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ ok: true, participants: { mode: "disabled", links: "disabled", configId: "racer" } }));
  });
  await new Promise((resolve) => fake.listen(4456, "127.0.0.1", resolve));
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));

  try {
    const result = await new Promise((resolve) => {
      const proc = spawn(process.execPath, [restartPath], {
        cwd: projectRoot,
        env: { ...process.env, PORT: "4455", MINIMAP_HOME: home },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stderr = "";
      proc.stderr.on("data", (chunk) => { stderr += String(chunk); });
      proc.on("exit", (code) => resolve({ code, stderr }));
    });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /did not report the requested Participants configuration/);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const alive = await fetch("http://127.0.0.1:4455/health").then(() => true).catch(() => false);
      if (!alive) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await assert.rejects(() => fetch("http://127.0.0.1:4455/health"), "the detached child must be stopped");
    assert.equal(JSON.parse(await fs.readFile(path.join(home, "server.json"), "utf8")).pid, 99991);
    await assert.rejects(() => fs.access(path.join(home, "restart.lock")), { code: "ENOENT" });
  } finally {
    await fetch("http://127.0.0.1:4455/api/shutdown", { method: "POST" }).catch(() => {});
    await new Promise((resolve) => fake.close(resolve));
    await fs.rm(installRoot, { recursive: true, force: true });
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("concurrent restarts with different configurations leave one registered server", { timeout: 30_000 }, async () => {
  const installRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-parallel-restart-"));
  const skillRoot = path.join(installRoot, "minimap-spec-review");
  await fs.cp(path.join(projectRoot, "package", "minimap", "skills", "minimap-spec-review"), skillRoot, { recursive: true });
  const restartPath = path.join(skillRoot, "scripts", "restart-server.mjs");
  const restartSource = await fs.readFile(restartPath, "utf8");
  await fs.writeFile(restartPath, restartSource
    .replace("const SWEEP_PORTS_FROM = 4312;", "const SWEEP_PORTS_FROM = 47300;")
    .replace("const SWEEP_PORTS_TO = 4320;", "const SWEEP_PORTS_TO = 47300;"), "utf8");

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const port = 47000 + attempt * 25;
      const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
      if (attempt === 0) await fs.writeFile(path.join(home, "restart.lock"), JSON.stringify({ pid: 99999999, token: "crashed" }), "utf8");
      const run = (endpoint) => new Promise((resolve) => {
        const proc = spawn(process.execPath, [restartPath], {
          cwd: projectRoot,
          env: { ...process.env, PORT: String(port), MINIMAP_HOME: home, MINIMAP_PALLIUM_ENDPOINT: endpoint },
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stderr = "";
        proc.stderr.on("data", (chunk) => { stderr += String(chunk); });
        proc.on("exit", (code) => resolve({ code, stderr }));
      });
      const health = (candidate) => fetch("http://127.0.0.1:" + candidate + "/health")
        .then((response) => response.json()).catch(() => null);

      try {
        const results = await Promise.all([
          run("http://127.0.0.1:19836"),
          run("http://127.0.0.1:19837"),
        ]);
        const live = [];
        for (let candidate = port; candidate < port + 20; candidate += 1) {
          if ((await health(candidate))?.ok) live.push(candidate);
        }
        const registry = JSON.parse(await fs.readFile(path.join(home, "server.json"), "utf8"));
        assert.deepEqual(live, [registry.port], JSON.stringify({ attempt, results, live, registry }));
        await assert.rejects(() => fs.access(path.join(home, "restart.lock")), { code: "ENOENT" });
      } finally {
        for (let candidate = port; candidate < port + 20; candidate += 1) {
          if ((await health(candidate))?.ok) {
            await fetch("http://127.0.0.1:" + candidate + "/api/shutdown", { method: "POST" }).catch(() => {});
          }
        }
        await fs.rm(home, { recursive: true, force: true });
      }
    }
  } finally {
    await fs.rm(installRoot, { recursive: true, force: true });
  }
});
