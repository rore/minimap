import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { resolveRoadmapItemReference } from "../package/minimap/src/pallium.js";

const run = promisify(execFile);
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = path.join(project, "package", "minimap", "skills", "minimap-roadmap", "scripts");
const fixture = JSON.parse(await fs.readFile(new URL("./work-record/fixtures/relationships.json", import.meta.url), "utf8"));

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("unchanged related-work generation keeps captured-generation Open valid after warm fresh scan", { timeout: 30_000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-related-generation-"));
  const repo = path.join(root, "repo"), home = path.join(root, "home"), tasks = path.join(repo, ".agent-workflow", "tasks");
  await fs.mkdir(tasks, { recursive: true });
  await fs.mkdir(home);
  await fs.mkdir(path.join(repo, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(repo, "roadmap", "ideas"), { recursive: true });
  await fs.writeFile(path.join(repo, "agent-workflow.yaml"), 'version: 1\nworkRecord: {backend: local, local: {taskPath: ".agent-workflow/tasks/{slug}.md"}}\n');
  await fs.writeFile(path.join(repo, "roadmap", "board.md"), "# Active\n- alpha\n");
  await fs.writeFile(path.join(repo, "roadmap", "scope.md"), "# Scope\n");
  await fs.writeFile(path.join(repo, "roadmap", "features", "alpha.md"),
    "---\nid: alpha\ntitle: Alpha\nstatus: in-progress\npriority: medium\ncommitment: committed\n---\n\n## Summary\n\nAlpha.\n");
  await run("git", ["init", "-b", "main"], { cwd: repo, windowsHide: true });
  await run("git", ["remote", "add", "origin", "https://github.com/rore/minimap.git"], { cwd: repo, windowsHide: true });
  await run("git", ["add", "."], { cwd: repo, windowsHide: true });
  await run("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture"], { cwd: repo, windowsHide: true });
  const reference = await resolveRoadmapItemReference(repo, "roadmap", "alpha");
  const relationships = { schema_version: 1, sources: [{ provider: "minimap", scope_ref: reference.scope_ref, local_ref: reference.local_ref }], pull_requests: [] };
  const recordPath = path.join(tasks, "delivery.md");
  const writeRecord = (outcome = "Expose related work.") => fs.writeFile(recordPath, fixture.record_template
    .replace("Fixture Work Record", "Unchanged task")
    .replace("**Outcome:** Expose related work.", `**Outcome:** ${outcome}`)
    .replace("__RELATIONSHIPS__", `**Relationships:**\n${JSON.stringify(relationships)}`));
  await writeRecord();

  const port = await freePort();
  const env = { ...process.env, MINIMAP_HOME: home, PORT: String(port), MINIMAP_PALLIUM_ENDPOINT: "" };
  const launcher = spawn(process.execPath, [path.join(scripts, "start-server.cjs")], { cwd: project, env, windowsHide: true, stdio: "ignore" });
  t.after(async () => {
    await run(process.execPath, [path.join(scripts, "stop-server.mjs")], { env, windowsHide: true, timeout: 10_000 }).catch(() => {});
    if (launcher.exitCode === null) await new Promise((resolve) => launcher.once("exit", resolve));
    await fs.rm(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    if (launcher.exitCode !== null) throw new Error(`Packaged server exited ${launcher.exitCode}`);
    try { ready = (await fetch(`${base}/health`)).ok; } catch {}
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(ready, true);
  const headers = { "X-Minimap-Repo": repo };
  const read = async (query) => {
    const response = await fetch(`${base}/api/items/alpha/related-work?${query}`, { headers });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    return body;
  };
  const cold = await read("fresh=1");
  assert.equal(cold.coverage.bodyReads, 1);
  assert.equal(cold.records[0].title, "Unchanged task");
  const openedGeneration = cold.generation;

  const warm = await read("fresh=1");
  assert.equal(warm.coverage.bodyReads, 0);
  assert.equal(warm.generation, openedGeneration, "identical indexed evidence should retain its generation");
  const opened = await fetch(`${base}/api/items/alpha/related-work?generation=${openedGeneration}&record=agent-workflow%3Adelivery`, { headers });
  const body = await opened.json();
  assert.equal(opened.status, 200, JSON.stringify(body));
  assert.match(body.content, /Unchanged task/);

  await fs.writeFile(path.join(tasks, "invalid.md"), "invalid record");
  const partial = await read("fresh=1");
  assert.equal(partial.status, "stale");
  assert.equal((await read("")).status, "stale", "cached reads preserve the failed-refresh notice");
  await fs.unlink(path.join(tasks, "invalid.md"));
  const repaired = await read("fresh=1");
  assert.equal(repaired.status, "ok");
  assert.equal(repaired.generation, openedGeneration, "unchanged repaired evidence reuses the retained generation");
  assert.equal((await read("")).status, "ok", "successful real validation clears the prior failure for cached reads");

  await writeRecord("Changed body with the same task title and state.");
  const changed = await read("fresh=1");
  assert.equal(changed.records[0].title, "Unchanged task");
  const changedOpen = await fetch(`${base}/api/items/alpha/related-work?generation=${openedGeneration}&record=agent-workflow%3Adelivery`, { headers });
  assert.equal(changedOpen.status, 409, "a body-only change invalidates captured evidence");

  const changedGeneration = changed.generation;
  await fs.unlink(recordPath);
  assert.equal((await read("fresh=1")).total, 0);
  const deletedOpen = await fetch(`${base}/api/items/alpha/related-work?generation=${changedGeneration}&record=agent-workflow%3Adelivery`, { headers });
  assert.equal(deletedOpen.status, 409, "a deleted record invalidates captured evidence");
});
