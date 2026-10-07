import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = path.join(projectRoot, "package", "minimap", "skills", "minimap-roadmap", "scripts");
const git = (cwd, ...args) => execFileSync("git", args, { cwd, windowsHide: true, encoding: "utf8" }).trim();
const item = (id) => `---\nid: ${id}\ntitle: ${id}\nstatus: queued\npriority: medium\ncommitment: committed\n---\n\n## Summary\n${id}\n`;

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function write(root, file, text) {
  const target = path.join(root, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, text);
}

test("worktree participant counts include an accepted squash once and omit ambiguous collisions", { timeout: 45000 }, async (t) => {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-worktree-squash-http-"));
  const root = path.join(owned, "repo"), sibling = path.join(owned, "sibling"), home = path.join(owned, "home");
  const env = { ...process.env, PORT: String(await freePort()), MINIMAP_HOME: home,
    MINIMAP_PALLIUM_ENDPOINT: "", MINIMAP_PALLIUM_DASHBOARD_ENDPOINT: "" };
  let child;
  let provider;
  t.after(async () => {
    try {
      if (child) {
        execFileSync(process.execPath, [path.join(scripts, "stop-server.mjs")], { env, windowsHide: true, timeout: 10000 });
        if (child.exitCode === null) {
          let timer;
          const exited = await Promise.race([
            new Promise((resolve) => child.once("exit", () => resolve(true))),
            new Promise((resolve) => { timer = setTimeout(() => resolve(false), 10000); timer.unref(); }),
          ]);
          clearTimeout(timer);
          assert.equal(exited, true, "packaged stop script did not exit the test server");
        }
      }
    } finally {
      if (provider?.listening) {
        provider.closeAllConnections?.();
        await new Promise((resolve) => provider.close(resolve));
      }
      if (!child || child.exitCode !== null) await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  });

  await fs.mkdir(path.join(root, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"));
  await write(root, "roadmap/board.md", "# Now\n");
  await write(root, "roadmap/scope.md", "Scope.\n");
  await write(root, "roadmap/ideas/.keep", "");
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Test"); git(root, "config", "user.email", "test@example.invalid");
  git(root, "config", "core.autocrlf", "false");
  git(root, "remote", "add", "origin", "https://github.com/example/worktree-squash.git");
  git(root, "add", "."); git(root, "commit", "-m", "base");
  git(root, "worktree", "add", "-b", "feature/sibling", sibling);

  await write(sibling, "roadmap/features/accepted.md", item("accepted"));
  await write(sibling, "roadmap/board.md", "# Now\n- accepted\n");
  await write(sibling, "notes/feature.txt", "same squash transition\n");
  git(sibling, "add", "roadmap/features/accepted.md", "roadmap/board.md", "notes/feature.txt");
  git(sibling, "commit", "-m", "add accepted feature");
  await write(sibling, "roadmap/scope.md", "Scope updated with feature.\n");
  git(sibling, "add", "roadmap/scope.md"); git(sibling, "commit", "-m", "finish feature transition");
  git(root, "merge", "--squash", "feature/sibling"); git(root, "commit", "-m", "squash accepted feature");

  for (const [repo, name] of [[root, "main"], [sibling, "sibling"]]) {
    await write(repo, "roadmap/features/collision.md", item("collision"));
    await write(repo, `notes/${name}.txt`, `${name} independent change\n`);
    await write(repo, "roadmap/board.md", "# Now\n- accepted\n- collision\n");
    git(repo, "add", "roadmap/features/collision.md", `notes/${name}.txt`, "roadmap/board.md");
    git(repo, "commit", "-m", `add independent collision ${name}`);
  }

  const requests = [];
  provider = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    requests.push({ url: request.url, payload });
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
      contract: "relay-work-ref-counts/v1", as_of: "2026-10-07T00:00:00Z", recent_seconds: 86400,
      counts: payload.references.map((reference) => ({ ...reference, participant_count: 2,
        recent_participant_count: 1, dormant_participant_count: 1 })),
    }));
  });
  await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
  env.MINIMAP_PALLIUM_ENDPOINT = `http://127.0.0.1:${provider.address().port}`;

  child = spawn(process.execPath, [path.join(scripts, "start-server.mjs")], {
    cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server did not start: ${output}`)), 15000);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.includes(`localhost:${env.PORT}`)) { clearTimeout(timeout); resolve(); }
    });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${output}`)); });
  });

  const response = await fetch(`http://127.0.0.1:${env.PORT}/api/worktree-workspace`, {
    headers: { "x-minimap-repo": root },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.features.filter((feature) => feature.id === "accepted").length, 1);
  assert.equal(body.features.find((feature) => feature.id === "accepted").versions.length, 2);
  assert.equal(body.features.filter((feature) => feature.id === "collision").length, 2);
  assert.equal(body.participantCounts.status, "ok");
  assert.equal(body.participantCounts.counts.length, 1);
  assert.deepEqual(body.participantCounts.counts[0], {
    featureKey: body.features.find((feature) => feature.id === "accepted").key,
    participantCount: 2, recentParticipantCount: 1, dormantParticipantCount: 1,
  });
  assert.equal(body.participantCounts.partial, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/relay/work-refs/participant-counts");
  assert.deepEqual(requests[0].payload.references.map((reference) => reference.local_ref), ["item:v1:accepted"]);
});
