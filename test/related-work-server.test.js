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

test("live related-work route converges on external edits and binds cursors to generations", { timeout: 30_000 }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-related-http-"));
  const repo = path.join(root, "repo"), home = path.join(root, "home"), tasks = path.join(repo, ".agent-workflow", "tasks");
  await fs.mkdir(tasks, { recursive: true });
  await fs.mkdir(home);
  await fs.mkdir(path.join(repo, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(repo, "roadmap", "ideas"), { recursive: true });
  await fs.writeFile(path.join(repo, "agent-workflow.yaml"), 'version: 1\nworkRecord: {backend: local, local: {taskPath: ".agent-workflow/tasks/{slug}.md"}}\n');
  await fs.writeFile(path.join(repo, "roadmap", "board.md"), "# Active\n- first\n- second\n");
  await fs.writeFile(path.join(repo, "roadmap", "scope.md"), "# Scope\n");
  for (const id of ["first", "second"]) await fs.writeFile(path.join(repo, "roadmap", "features", `${id}.md`),
    `---\nid: ${id}\ntitle: ${id}\nstatus: in-progress\npriority: medium\ncommitment: committed\n---\n\n## Summary\n\n${id}\n`);
  await run("git", ["init", "-b", "main"], { cwd: repo, windowsHide: true });
  await run("git", ["remote", "add", "origin", "https://github.com/rore/minimap.git"], { cwd: repo, windowsHide: true });
  await run("git", ["add", "."], { cwd: repo, windowsHide: true });
  await run("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture"], { cwd: repo, windowsHide: true });
  const [first, second] = await Promise.all(["first", "second"].map((id) => resolveRoadmapItemReference(repo, "roadmap", id)));
  await fs.mkdir(path.join(repo, "nested", "roadmap"), { recursive: true });
  const nestedFirst = await resolveRoadmapItemReference(repo, "nested/roadmap", "first");
  const relationship = (reference) => ({ provider: "minimap", scope_ref: reference.scope_ref, local_ref: reference.local_ref });
  const write = (slug, title, state, sources, prs) => fs.writeFile(path.join(tasks, `${slug}.md`), fixture.record_template
    .replace("Fixture Work Record", title).replace("**State:** Ready to implement", `**State:** ${state}`)
    .replace("__RELATIONSHIPS__", `**Relationships:**\n${JSON.stringify({ schema_version: 1, sources, pull_requests: prs })}`));
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
  const read = async (id, query = "fresh=1") => {
    const response = await fetch(`${base}/api/items/${id}/related-work?${query}`, { headers });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    return body;
  };
  assert.equal((await read("first")).total, 0);
  await write("unknown", "Unverified source", "Blocked", null, []);
  const unverified = await read("first");
  assert.notEqual(unverified.status, "ok", "Unverified source references cannot confirm zero related records");
  assert.equal(unverified.coverage.unverified, 1);
  assert.equal(unverified.total, 0);
  await fs.unlink(path.join(tasks, "unknown.md"));
  await write("one", "First record", "Ready to implement", [relationship(first)], ["https://github.com/rore/minimap/pull/1"]);
  let view = await read("first");
  assert.equal(view.total, 1);
  assert.equal(view.records[0].title, "First record");
  await write("nested-only", "Different roadmap root", "Blocked", [relationship(nestedFirst)], []);
  assert.equal((await read("first")).total, 1, "Same item ID in a nested roadmap must not link to this root");
  await fs.unlink(path.join(tasks, "nested-only.md"));
  const oldGeneration = view.generation;
  await write("one", "Changed record", "Blocked", [relationship(first)], ["https://github.com/rore/minimap/pull/2"]);
  view = await read("first");
  assert.equal(view.records[0].recordedState, "Blocked");
  assert.deepEqual(view.records[0].pullRequests, ["https://github.com/rore/minimap/pull/2"]);
  const expired = await fetch(`${base}/api/items/first/related-work?generation=${oldGeneration}`, { headers });
  assert.equal(expired.status, 409);
  await write("two", "Shared", "Ready for review", [relationship(first), relationship(second)], []);
  assert.equal((await read("first")).total, 2);
  assert.equal((await read("second")).total, 1);
  await fs.rename(path.join(tasks, "one.md"), path.join(tasks, "moved.md"));
  view = await read("first");
  assert.ok(view.records.some((entry) => entry.id === "agent-workflow:moved"));
  assert.ok(!view.records.some((entry) => entry.id === "agent-workflow:one"));
  await write("moved", "Remapped", "Blocked", [relationship(second)], []);
  assert.equal((await read("first")).total, 1);
  assert.equal((await read("second")).total, 2);
  await fs.unlink(path.join(tasks, "two.md"));
  assert.equal((await read("first")).total, 0);
  view = await read("second");
  assert.equal(view.total, 1);
  const record = await fetch(`${base}/api/items/second/related-work?generation=${view.generation}&record=agent-workflow%3Amoved`, { headers });
  assert.equal(record.status, 200);
  assert.match((await record.json()).content, /Remapped/);
  await fs.unlink(path.join(tasks, "moved.md"));
  const deletedOpen = await fetch(`${base}/api/items/second/related-work?generation=${view.generation}&record=agent-workflow%3Amoved`, { headers });
  assert.equal(deletedOpen.status, 409, "A deleted indexed record requires refresh");
  await write("moved", "Remapped", "Blocked", [relationship(second)], []);
  await fs.writeFile(path.join(tasks, "invalid.md"), "invalid record");
  const stale = await read("second");
  assert.equal(stale.status, "stale");
  assert.equal(stale.total, 1);
  assert.equal(stale.coverage.invalid, 1);
  assert.ok(stale.staleSince);
  assert.equal((await read("second", "")).status, "stale", "A cached read must preserve the failed-refresh notice");
  await fs.unlink(path.join(tasks, "invalid.md"));
  assert.equal((await read("second")).status, "ok");
  const beforeCommit = (await read("second")).generation;
  await run("git", ["add", "."], { cwd: repo, windowsHide: true });
  await run("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "record"], { cwd: repo, windowsHide: true });
  const oldSource = await fetch(`${base}/api/items/second/related-work?generation=${beforeCommit}`, { headers });
  assert.equal(oldSource.status, 409);
  assert.equal((await read("second")).total, 1);
  const beforeConfig = (await read("second")).generation;
  const alternate = path.join(repo, "records");
  await fs.mkdir(alternate);
  await fs.writeFile(path.join(alternate, "alternate.md"), fixture.record_template.replace("Fixture Work Record", "Alternate configured path")
    .replace("__RELATIONSHIPS__", `**Relationships:**\n${JSON.stringify({ schema_version: 1, sources: [relationship(second)], pull_requests: [] })}`));
  await fs.writeFile(path.join(repo, "agent-workflow.yaml"), 'version: 1\nworkRecord: {backend: local, local: {taskPath: "records/{slug}.md"}}\n');
  const previousConfig = await fetch(`${base}/api/items/second/related-work?generation=${beforeConfig}`, { headers });
  assert.equal(previousConfig.status, 409);
  assert.equal((await read("second")).records[0].title, "Alternate configured path");
});
