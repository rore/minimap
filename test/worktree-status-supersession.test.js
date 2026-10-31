import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { promisify } from "node:util";
import { after, afterEach, test } from "node:test";
import { projectWorktreeGroups, recordedStatusSummary } from "../package/minimap/ui/worktrees.js";
import { selectWorktreeParticipantCandidates } from "../package/minimap/src/worktree-presence.js";
import { compactWorktreePayload, expandWorktreePayload } from "../package/minimap/ui/worktree-payload.js";

const originalExec = childProcess.execFile;
const originalSpawn = childProcess.spawn;
const commands = [];
let failHistory = false;
let transformHistory = null, onIndex = null, onHistory = null, failGraph = false;
function observed(file, args, options, callback) {
  if (file === "git") commands.push(args);
  if (file === "git" && args[0] === "ls-files") onIndex?.(options.cwd);
  if (file === "git" && args[0] === "rev-list" && failGraph) return originalExec(file, ["rev-list", "--invalid-option"], options, callback);
  if (file === "git" && failHistory && args.includes("--diff-merges=separate")) {
    return originalExec(file, ["log", "--invalid-option"], options, callback);
  }
  if (file === "git" && args.includes("--diff-merges=separate")) {
    onHistory?.();
    if (transformHistory) return originalExec(file, args, options, (error, stdout, stderr) => callback(error, transformHistory(stdout), stderr));
  }
  return originalExec(file, args, options, callback);
}
observed[promisify.custom] = (...args) => new Promise((resolve, reject) => {
  observed(...args, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr }));
});
childProcess.execFile = observed;
childProcess.spawn = (file, args, options) => { if (file === "git") commands.push(args); return originalSpawn(file, args, options); };
syncBuiltinESMExports();
const { loadWorktreeAggregate } = await import("../package/minimap/src/worktree-aggregate.js");
const owned = [];
const git = (cwd, ...args) => childProcess.execFileSync("git", args, { cwd, windowsHide: true, encoding: "utf8", stdio: "pipe" }).trim();
const item = (id, status, title = `Historical ${id}`, lane = "Alpha") => `---\nid: ${id}\ntitle: ${title}\nstatus: ${status}\npriority: high\ncommitment: committed\nlane: ${lane}\n---\n\n## Summary\n${title} description.\n`;
async function write(root, file, text) {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), text);
}
const commit = (root, message) => { git(root, "add", "."); git(root, "commit", "-m", message); return git(root, "rev-parse", "HEAD"); };
async function fixture(count = 2) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-status-proof-")); owned.push(dir);
  const main = path.join(dir, "main"), old = path.join(dir, "old");
  await fs.mkdir(main);
  git(main, "init", "-b", "main"); git(main, "config", "user.name", "Test");
  git(main, "config", "user.email", "test@example.invalid"); git(main, "config", "core.autocrlf", "false");
  const ids = Array.from({ length: count }, (_, index) => index ? `item-${index}` : "alpha");
  await write(main, "roadmap/board.md", `# Now\n${ids.map((id) => `- ${id}`).join("\n")}\n`);
  await write(main, "roadmap/scope.md", "Generic fixture.\n"); await write(main, "roadmap/ideas/.keep", "");
  await write(main, "roadmap.config.json", JSON.stringify({ roadmapPath: "roadmap", lenses: { fields: { lane: {} } } }));
  for (const id of ids) await write(main, `roadmap/features/${id}.md`, item(id, "active"));
  const base = commit(main, "base active features");
  git(main, "worktree", "add", "-b", "topic/old", old);
  await write(old, "notes/old.txt", "Unrelated branch work.\n"); commit(old, "unrelated branch change");
  await write(main, "roadmap/features/alpha.md", item("alpha", "done", "Current alpha", "Beta"));
  const done = commit(main, "complete alpha");
  await write(main, "notes/main.txt", "Unrelated main work.\n"); commit(main, "unrelated main change");
  commands.length = 0;
  return { dir, main, old, base, done, ids };
}
const alpha = (aggregate) => aggregate.features.find((feature) => feature.id === "alpha");
const cards = (aggregate, options) => projectWorktreeGroups(aggregate, options).flatMap((group) => group.items);
afterEach(async () => {
  failHistory = false;
  transformHistory = null; onIndex = null; onHistory = null; failGraph = false;
  for (const dir of owned.splice(0)) {
    assert.equal(path.dirname(dir), os.tmpdir()); assert.match(path.basename(dir), /^minimap-status-proof-/);
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
after(() => { childProcess.execFile = originalExec; childProcess.spawn = originalSpawn; syncBuiltinESMExports(); });

test("ancestor feature status resolves despite divergent HEADs without replacing historical content", async () => {
  const { main, old } = await fixture();
  assert.throws(() => git(main, "merge-base", "--is-ancestor", git(old, "rev-parse", "HEAD"), git(main, "rev-parse", "HEAD")));
  const file = path.join(old, "roadmap/features/alpha.md"), before = await fs.readFile(file);
  const aggregate = await loadWorktreeAggregate(old);
  const feature = alpha(aggregate);
  assert.ok(feature, JSON.stringify({ unavailable: aggregate.unavailable, excluded: aggregate.excluded, coverage: aggregate.coverage }));
  assert.equal(feature.versions.length, 2);
  assert.deepEqual(feature.versions[0].statusSupersededBy, [feature.versions[1].sourceKey]);
  const card = cards(aggregate).find((entry) => entry.featureKey === feature.key);
  assert.equal(recordedStatusSummary(card).label, "Done");
  assert.equal(card.title, "Historical alpha");
  assert.equal(card.sourceVersion.sourceKey, feature.versions[0].sourceKey);
  assert.equal(card.matchingVersions.length, 2);
  assert.deepEqual(await fs.readFile(file), before);
  assert.deepEqual(selectWorktreeParticipantCandidates(aggregate).features.map((entry) => entry.id), ["item-1"]);
  assert.deepEqual(expandWorktreePayload(JSON.parse(JSON.stringify(compactWorktreePayload(aggregate)))), JSON.parse(JSON.stringify(aggregate)));
});

test("status filters/lens/order agree while historical search, metadata and placement survive", async () => {
  const { old } = await fixture();
  const aggregate = await loadWorktreeAggregate(old);
  const feature = alpha(aggregate);
  const options = { searchQuery: "historical alpha", activeFilters: { lane: ["Alpha"] } };
  const card = cards(aggregate, options)[0];
  assert.equal(card.title, "Historical alpha"); assert.equal(recordedStatusSummary(card).label, "Done");
  assert.equal(cards(aggregate, { ...options, activeFilters: { lane: ["Alpha"], status: ["active"] } }).length, 0);
  assert.equal(cards(aggregate, { ...options, activeFilters: { lane: ["Alpha"], status: ["done"] } })[0].title, "Historical alpha");
  const status = projectWorktreeGroups(aggregate, { ...options, lens: "status" });
  assert.equal(status[0].name, "done");
  const lane = projectWorktreeGroups(aggregate, { lens: "lane" });
  assert.equal(lane[0].name, "Alpha");
  assert.deepEqual(lane[0].items.map((entry) => entry.featureKey), [aggregate.features.find((entry) => entry.id === "item-1").key, feature.key]);
  assert.equal(cards(aggregate, { ...options, inPlay: true }).length, 0);
  assert.equal(cards(aggregate, { ...options, inPlay: true, participantCounts: new Map([[feature.key, { participantCount: 1 }]]) }).length, 1);
});

test("a later active reopening supersedes older Done without status precedence", async () => {
  const { main, old } = await fixture();
  const doneCheckout = path.join(path.dirname(main), "done");
  git(main, "worktree", "add", "-b", "topic/done", doneCheckout);
  await write(main, "roadmap/features/alpha.md", item("alpha", "active", "Reopened alpha")); commit(main, "reopen alpha");
  const aggregate = await loadWorktreeAggregate(old);
  const feature = alpha(aggregate);
  assert.equal(feature.versions.length, 3);
  assert.equal(feature.versions.filter((version) => !version.statusSupersededBy?.length).length, 1);
  assert.equal(recordedStatusSummary(cards(aggregate).find((card) => card.featureKey === feature.key)).label, "Active");
  assert.equal(cards(aggregate, { searchQuery: "alpha", activeFilters: { status: ["done"] } }).length, 0);
});

for (const dirty of ["unstaged", "staged", "staged-reverted", "untracked", "skip-worktree", "assume-unchanged"]) {
  test(`${dirty} feature state is never discarded as historical status`, async () => {
    const { old } = await fixture();
    const file = "roadmap/features/alpha.md";
    await write(old, file, item("alpha", "blocked"));
    if (["staged", "staged-reverted"].includes(dirty)) git(old, "add", file);
    if (dirty === "staged-reverted") await write(old, file, item("alpha", "active"));
    if (dirty === "untracked") git(old, "rm", "--cached", file);
    if (["skip-worktree", "assume-unchanged"].includes(dirty)) git(old, "update-index", `--${dirty}`, file);
    const aggregate = await loadWorktreeAggregate(old);
    assert.equal(alpha(aggregate).versions[0].statusSupersededBy, undefined);
    assert.notEqual(recordedStatusSummary(cards(aggregate).find((card) => card.featureKey === alpha(aggregate).key)).label, "Done");
  });
}

test("concurrent feature edits retain both current statuses", async () => {
  const { old } = await fixture();
  await write(old, "roadmap/features/alpha.md", item("alpha", "blocked")); commit(old, "concurrent block");
  const aggregate = await loadWorktreeAggregate(old);
  assert.ok(alpha(aggregate).versions.every((version) => !version.statusSupersededBy));
  assert.equal(recordedStatusSummary(cards(aggregate).find((card) => card.featureKey === alpha(aggregate).key)).label, "Blocked");
});

test("unavailable status history retains legacy competing evidence", async () => {
  const { old } = await fixture(); failHistory = true;
  const aggregate = await loadWorktreeAggregate(old);
  assert.ok(alpha(aggregate).versions.every((version) => !version.statusSupersededBy));
  assert.equal(recordedStatusSummary(cards(aggregate).find((card) => card.featureKey === alpha(aggregate).key)).label, "Active");
});

for (const invalid of ["malformed", "truncated", "missing graph", "shallow"]) {
  test(`${invalid} proof cannot hide old status evidence`, async () => {
    const { main, old, done } = await fixture();
    if (invalid === "malformed") transformHistory = () => "not a history transcript";
    if (invalid === "truncated") transformHistory = (text) => text.slice(0, Math.floor(text.length / 2));
    if (invalid === "missing graph") failGraph = true;
    if (invalid === "shallow") await fs.writeFile(path.join(main, ".git/shallow"), `${done}\n`);
    const aggregate = await loadWorktreeAggregate(old);
    assert.ok(aggregate.features.filter((feature) => feature.id === "alpha").flatMap((feature) => feature.versions).every((version) => !version.statusSupersededBy));
    assert.ok(cards(aggregate).some((card) => recordedStatusSummary(card).label === "Active"));
  });
}

for (const race of ["file", "index"]) {
  test(`${race} changing during proof retains the loaded historical evidence`, async () => {
    const { old } = await fixture();
    const file = path.join(old, "roadmap/features/alpha.md");
    if (race === "file") onHistory = () => fsSync.writeFileSync(file, item("alpha", "blocked"));
    else {
      let reads = 0;
      onIndex = (root) => {
        if (path.resolve(root).toLowerCase() !== path.resolve(old).toLowerCase() || ++reads !== 2) return;
        fsSync.writeFileSync(file, item("alpha", "blocked")); git(old, "add", "roadmap/features/alpha.md");
        fsSync.writeFileSync(file, item("alpha", "active"));
      };
    }
    const aggregate = await loadWorktreeAggregate(old);
    assert.equal(alpha(aggregate).versions[0].statusSupersededBy, undefined);
  });
}

test("merge preserving a parent's blob and later merge resolution use real ancestry", async () => {
  const { main, old, base } = await fixture();
  const baseCheckout = path.join(path.dirname(main), "base");
  git(main, "worktree", "add", "-b", "topic/base", baseCheckout, base);
  git(old, "merge", "--no-ff", "main", "-m", "retain completed parent feature");
  let aggregate = await loadWorktreeAggregate(baseCheckout);
  assert.equal(recordedStatusSummary(cards(aggregate).find((card) => card.featureKey === alpha(aggregate).key)).label, "Done");
  assert.ok(alpha(aggregate).versions[0].statusSupersededBy?.length);
  await write(old, "roadmap/features/alpha.md", item("alpha", "blocked")); commit(old, "concurrent old branch status");
  await write(main, "roadmap/features/alpha.md", item("alpha", "active", "Reopened main")); commit(main, "reopen main");
  assert.throws(() => git(old, "merge", "--no-ff", "main", "-m", "merge competing statuses"));
  await write(old, "roadmap/features/alpha.md", item("alpha", "done", "Resolved completion")); commit(old, "resolve feature merge");
  aggregate = await loadWorktreeAggregate(baseCheckout);
  assert.equal(recordedStatusSummary(cards(aggregate).find((card) => card.featureKey === alpha(aggregate).key)).label, "Done");
  assert.equal(alpha(aggregate).versions.filter((version) => !version.statusSupersededBy).length, 1);
});

test("incomparable equal blobs do not establish precedence between their edits", async () => {
  const { main, old } = await fixture();
  await write(old, "roadmap/features/alpha.md", item("alpha", "done", "Current alpha", "Beta")); commit(old, "independent equal completion");
  const aggregate = await loadWorktreeAggregate(main);
  assert.ok(alpha(aggregate).versions.every((version) => !version.statusSupersededBy));
  assert.equal(recordedStatusSummary(cards(aggregate).find((card) => card.featureKey === alpha(aggregate).key)).label, "Done");
});

test("status-based In play cannot borrow filtered-out current Active; historical matching stays per version", () => {
  const version = (sourceKey, status, lane, title) => ({ sourceKey, itemId: "alpha", groupKind: "board", group: "Now",
    summary: { id: "alpha", status, title, searchText: title, metadata: { status, lane } } });
  const versions = [version("old", "queued", "Alpha", "old title"), version("done", "done", "Beta", "new title"), version("active", "active", "Gamma", "competing title")];
  versions[0].statusSupersededBy = ["done"];
  const feature = { key: "feature", id: "alpha", versions };
  const aggregate = { workspace: {}, features: [feature], groups: [{ name: "Now", kind: "board", items: [feature] }] };
  const options = { inPlay: true, searchQuery: "old", activeFilters: { status: ["done"], lane: ["Alpha"] } };
  assert.deepEqual(cards(aggregate, options), []);
  const [card] = cards(aggregate, { ...options, participantCounts: new Map([[feature.key, { participantCount: 1 }]]) });
  assert.equal(card.title, "old title"); assert.equal(recordedStatusSummary(card).label, "Done");
  assert.equal(cards(aggregate, { searchQuery: "new", activeFilters: { lane: ["Alpha"] } }).length, 0);
  assert.equal(cards(aggregate, { inPlay: true, searchQuery: "old" })[0].title, "old title");
});

test("superseded Active does not consume unfinished participant budget ahead of actual work", () => {
  const features = Array.from({ length: 200 }, (_, index) => ({ key: `done-${index}`, id: `done-${index}`, versions: [
    { summary: { status: "active" }, statusSupersededBy: ["new"] }, { summary: { status: "done" } },
  ] }));
  features.push({ key: "work", id: "work", versions: [{ summary: { status: "queued" } }] });
  assert.deepEqual(selectWorktreeParticipantCandidates({ features }).features, [{ key: "work", id: "work" }]);
  assert.equal(selectWorktreeParticipantCandidates({ features }, { includeCompleted: true }).features[0].key, "work");
});

test("many differing feature histories add batched reads, not per-card Git commands", async () => {
  const { main, old, ids } = await fixture(80);
  for (const id of ids) await write(main, `roadmap/features/${id}.md`, item(id, "active")); commit(main, "baseline equal saved statuses");
  for (let index = 0; index < 2; index += 1) git(old, "worktree", "add", "-b", `topic/extra-${index}`, path.join(path.dirname(main), `extra-${index}`), "topic/old");
  commands.length = 0; await loadWorktreeAggregate(old); const baselineCommands = commands.length;
  for (const id of ids) await write(main, `roadmap/features/${id}.md`, item(id, "done")); commit(main, "complete many features");
  commands.length = 0;
  const aggregate = await loadWorktreeAggregate(old);
  assert.equal(aggregate.coverage.loaded, 4);
  assert.equal(aggregate.features.length, 80);
  assert.ok(aggregate.features.every((feature) => feature.versions.filter((version) => version.statusSupersededBy?.length).length === 3));
  assert.equal(commands.filter((args) => args.includes("--diff-merges=separate")).length, 1);
  assert.equal(commands.filter((args) => args[0] === "ls-files").length, 8);
  assert.equal(commands.length - baselineCommands, 10, "One history, one blob batch, and two index reads per source");
});

test("status history cancellation propagates promptly and releases the shared scheduler", async () => {
  const { old } = await fixture();
  const controller = new AbortController(), reason = new Error("cancel status proof");
  let cancelledAt;
  onHistory = () => { cancelledAt = performance.now(); controller.abort(reason); };
  await assert.rejects(loadWorktreeAggregate(old, { signal: controller.signal }), (error) => error === reason);
  assert.ok(cancelledAt && performance.now() - cancelledAt < 5000, "Cancellation latency excludes the earlier successful scan work");
  onHistory = null;
  assert.equal(recordedStatusSummary(cards(await loadWorktreeAggregate(old))[0]).label, "Done");
});

test("capped raw history never removes saved status evidence", async () => {
  const { old } = await fixture();
  transformHistory = (raw) => {
    const tokens = raw.split("\0"), header = tokens.find((token) => /commit [0-9a-f]+/.test(token));
    const index = tokens.findIndex((token) => /^\n?:[0-7]{6} /.test(token));
    return `\0${header}\0${tokens[index]}\0${tokens[index + 1]}\0`.repeat(8193);
  };
  const aggregate = await loadWorktreeAggregate(old);
  assert.ok(alpha(aggregate).versions.every((version) => !version.statusSupersededBy));
});

test("an index edit after content verification cannot discard the historical status", async () => {
  const { old } = await fixture();
  const file = path.join(old, "roadmap/features/alpha.md"), originalRead = fs.readFile;
  let proving = false, changed = false;
  onHistory = () => { proving = true; };
  fs.readFile = async (location, ...args) => {
    const content = await originalRead(location, ...args);
    if (proving && !changed && path.resolve(String(location)).toLowerCase() === path.resolve(file).toLowerCase()) {
      changed = true;
      fsSync.writeFileSync(file, item("alpha", "blocked")); git(old, "add", "roadmap/features/alpha.md");
      fsSync.writeFileSync(file, item("alpha", "active"));
    }
    return content;
  };
  try {
    const aggregate = await loadWorktreeAggregate(old);
    assert.equal(changed, true);
    assert.equal(alpha(aggregate).versions[0].statusSupersededBy, undefined);
  } finally { fs.readFile = originalRead; }
});

test("BOM/EOL display equivalence permits proof but an unstaged executable-mode edit does not", async () => {
  const { old } = await fixture();
  const file = path.join(old, "roadmap/features/alpha.md");
  await fs.writeFile(file, `\uFEFF${item("alpha", "active").replaceAll("\n", "\r\n")}`);
  let aggregate = await loadWorktreeAggregate(old);
  assert.ok(alpha(aggregate).versions[0].statusSupersededBy?.length);
  assert.equal(recordedStatusSummary(cards(aggregate)[0]).label, "Done");
  if (process.platform !== "win32") {
    await fs.chmod(file, 0o755);
    aggregate = await loadWorktreeAggregate(old);
    assert.equal(alpha(aggregate).versions[0].statusSupersededBy, undefined);
  }
});
