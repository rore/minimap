import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadWorkspace } from "../package/minimap/src/roadmap.js";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function gatedWorkspace(t, count = 33) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-read-batches-"));
  const features = path.join(root, "roadmap", "features");
  await fs.mkdir(features, { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"));
  const ids = Array.from({ length: count }, (_, index) => `item-${String(index).padStart(2, "0")}`);
  await fs.writeFile(path.join(root, "roadmap", "board.md"), `# Now\n${ids.map((id) => `- ${id}`).join("\n")}\n`);
  await fs.writeFile(path.join(root, "roadmap", "scope.md"), "scope\n");
  await Promise.all(ids.map((id) => fs.writeFile(path.join(features, `${id}.md`),
    `---\nid: ${id}\ntitle: Title ${id}\nstatus: queued\npriority: medium\ncommitment: committed\n---\n\n## Summary\nBody ${id}.\n`)));
  const files = (await fs.readdir(features)).filter((name) => name.endsWith(".md"));
  const gates = files.map(() => deferred());
  const finished = files.map(() => deferred());
  const batchStarted = deferred();
  const original = fs.readFile;
  let pending = 0;
  const started = [];
  fs.readFile = async (file, ...args) => {
    if (path.dirname(String(file)) !== features) return original(file, ...args);
    const index = files.indexOf(path.basename(String(file)));
    started.push(index);
    pending++;
    if (started.length === Math.min(32, count)) batchStarted.resolve();
    try {
      const failure = await gates[index].promise;
      if (failure) throw failure;
      return await original(file, ...args);
    } finally {
      pending--;
      finished[index].resolve();
    }
  };
  let work;
  t.after(async () => {
    for (const gate of gates) gate.resolve();
    await work?.catch(() => {});
    fs.readFile = original;
    assert.equal(path.dirname(root), os.tmpdir());
    assert.match(path.basename(root), /^minimap-read-batches-/);
    await fs.rm(root, { recursive: true, force: true });
  });
  return { root, files, gates, finished, batchStarted: batchStarted.promise, started,
    pending: () => pending,
    load(options) { work = loadWorkspace(root, options); return work; } };
}

test("workspace item reads drain the started batch and throw its first input-order failure", { timeout: 5000 }, async (t) => {
  const fixture = await gatedWorkspace(t);
  const first = new Error("first input failure"), later = new Error("later input failure");
  const work = fixture.load();
  let settled = false;
  void work.then(() => { settled = true; }, () => { settled = true; });
  await fixture.batchStarted;
  fixture.gates[1].resolve(later);
  await fixture.finished[1].promise;
  await new Promise(setImmediate);
  assert.equal(settled, false, "A faster later failure cannot abandon the other reads");
  assert.equal(fixture.pending(), 31);
  fixture.gates[0].resolve(first);
  for (const gate of fixture.gates.slice(2, 32)) gate.resolve();
  await assert.rejects(work, (error) => error === first);
  assert.equal(fixture.pending(), 0);
  assert.equal(fixture.started.length, 32, "Failure must not schedule the next batch");
});

test("workspace item cancellation drains the batch before throwing the supplied reason", { timeout: 5000 }, async (t) => {
  const fixture = await gatedWorkspace(t);
  const controller = new AbortController(), reason = new Error("cancel item reads");
  const work = fixture.load({ signal: controller.signal });
  let settled = false;
  void work.then(() => { settled = true; }, () => { settled = true; });
  await fixture.batchStarted;
  controller.abort(reason);
  fixture.gates[0].resolve();
  await fixture.finished[0].promise;
  await new Promise(setImmediate);
  assert.equal(settled, false, "Abort cannot return with the other started reads pending");
  for (const gate of fixture.gates.slice(1, 32)) gate.resolve();
  await assert.rejects(work, (error) => error === reason);
  assert.equal(fixture.pending(), 0);
  assert.equal(fixture.started.length, 32);
});

test("workspace item reads preserve file-to-item mapping when completion order differs", { timeout: 5000 }, async (t) => {
  const fixture = await gatedWorkspace(t, 6);
  const work = fixture.load();
  await fixture.batchStarted;
  for (let index = fixture.gates.length - 1; index >= 0; index--) {
    fixture.gates[index].resolve();
    await fixture.finished[index].promise;
  }
  const workspace = await work;
  assert.equal(fixture.pending(), 0);
  assert.equal(Object.keys(workspace.items).length, 6);
  for (const file of fixture.files) {
    const id = path.basename(file, ".md"), item = workspace.items[id];
    assert.equal(item.title, `Title ${id}`);
    assert.equal(path.basename(item.filePath), file);
  }
});
