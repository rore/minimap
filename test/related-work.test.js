import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRelatedWorkScanner, readIndexedRecord } from "../package/minimap/src/related-work.js";

const fixture = JSON.parse(await fs.readFile(new URL("./work-record/fixtures/relationships.json", import.meta.url), "utf8"));
const ref = (local_ref) => ({ provider: "minimap", scope_ref: "roadmap:v1:git:github.com/rore/minimap#roadmap", local_ref });
const record = (title, sources, state = "Ready to implement") => fixture.record_template
  .replace("Fixture Work Record", title)
  .replace("**State:** Ready to implement", `**State:** ${state}`)
  .replace("__RELATIONSHIPS__", `**Relationships:**\n${JSON.stringify({ schema_version: 1, sources, pull_requests: ["https://github.com/rore/minimap/pull/123"] })}`);

test("related work scanner converges after add, edit, remap and delete", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-related-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "records");
  await fs.mkdir(directory);
  await fs.writeFile(path.join(root, "agent-workflow.yaml"), 'version: 1\nworkRecord: {backend: local, local: {taskPath: "records/{slug}.md"}}\n');
  const scan = createRelatedWorkScanner();
  assert.deepEqual((await scan(root)).records, []);
  const file = path.join(directory, "first.md");
  await fs.writeFile(file, record("First", [ref("item:v1:first")]));
  let result = await scan(root);
  assert.equal(result.status, "ok");
  assert.equal(result.records[0].title, "First");
  assert.equal(result.coverage.bodyReads, 1);
  assert.equal((await scan(root)).coverage.bodyReads, 0);
  assert.match(await readIndexedRecord(root, result.records[0], result.taskPath), /First/);
  await fs.writeFile(file, record("Renamed", [ref("item:v1:second")], "Blocked"));
  assert.equal(await readIndexedRecord(root, result.records[0], result.taskPath), null);
  result = await scan(root);
  assert.equal(result.coverage.bodyReads, 1);
  assert.equal(result.records[0].title, "Renamed");
  assert.equal(result.records[0].sources[0].local_ref, "item:v1:second");
  assert.equal(result.records[0].recordedState, "Blocked");
  await fs.writeFile(path.join(directory, "second.md"), record("Second", [ref("item:v1:second"), ref("item:v1:third")]));
  result = await scan(root);
  assert.equal(result.records.length, 2);
  await fs.unlink(file);
  result = await scan(root);
  assert.deepEqual(result.records.map((entry) => entry.id), ["agent-workflow:second"]);
});

test("invalid and oversized records report partial coverage without hiding valid records", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-related-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "records");
  await fs.mkdir(directory);
  await fs.writeFile(path.join(root, "agent-workflow.yaml"), 'version: 1\nworkRecord: {backend: local, local: {taskPath: "records/{slug}.md"}}\n');
  await fs.writeFile(path.join(directory, "good.md"), record("Good", [ref("item:v1:good")]));
  await fs.writeFile(path.join(directory, "bad.md"), "bad record");
  await fs.writeFile(path.join(directory, "huge.md"), "x".repeat(256 * 1024 + 1));
  const result = await createRelatedWorkScanner()(root);
  assert.equal(result.status, "partial");
  assert.equal(result.records.length, 1);
  assert.equal(result.coverage.invalid, 1);
  assert.equal(result.coverage.oversized, 1);
});

test("unverified sources make coverage partial without inferring a feature link", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-related-unverified-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "records");
  await fs.mkdir(directory);
  await fs.writeFile(path.join(root, "agent-workflow.yaml"), 'version: 1\nworkRecord: {backend: local, local: {taskPath: "records/{slug}.md"}}\n');
  await fs.writeFile(path.join(directory, "unknown.md"), record("Unknown", null));
  const scan = createRelatedWorkScanner();
  let result = await scan(root);
  assert.equal(result.status, "partial");
  assert.equal(result.coverage.unverified, 1);
  assert.equal(result.records.filter((entry) => entry.sources.length).length, 0);
  await fs.writeFile(path.join(directory, "linked.md"), record("Linked", [ref("item:v1:first")]));
  result = await scan(root);
  assert.equal(result.status, "partial");
  assert.equal(result.coverage.unverified, 1);
  assert.deepEqual(result.records.filter((entry) => entry.sources.length).map((entry) => entry.title), ["Linked"]);
});

test("legacy relationship-free records are partial, distinct from successful empty and unavailable scans", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-related-legacy-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const scan = createRelatedWorkScanner();
  const unavailable = await scan(root);
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.reason, "missing_workflow");
  const directory = path.join(root, "records");
  await fs.mkdir(directory);
  await fs.writeFile(path.join(root, "agent-workflow.yaml"), 'version: 1\nworkRecord: {backend: local, local: {taskPath: "records/{slug}.md"}}\n');
  const empty = await scan(root);
  assert.equal(empty.status, "ok");
  assert.deepEqual(empty.records, []);
  await fs.writeFile(path.join(directory, "legacy.md"), fixture.record_template
    .replace("Fixture Work Record", "Feature title cannot infer a link")
    .replace("__RELATIONSHIPS__", ""));
  const legacy = await scan(root);
  assert.equal(legacy.status, "partial");
  assert.equal(legacy.coverage.legacy, 1);
  assert.deepEqual(legacy.records, []);
});

test("configured slug directories are scanned without treating the directory as a record", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-related-directory-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, "records", "first", "record.md");
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(path.join(root, "agent-workflow.yaml"), 'version: 1\nworkRecord: {backend: local, local: {taskPath: "records/{slug}/record.md"}}\n');
  await fs.writeFile(file, record("Nested", [ref("item:v1:first")]));
  const result = await createRelatedWorkScanner()(root);
  assert.equal(result.status, "ok");
  assert.deepEqual(result.records.map(({ id, title }) => ({ id, title })), [{ id: "agent-workflow:first", title: "Nested" }]);
});

test("configured records at the checkout root are allowed when the decoder accepts the template", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-related-root-layout-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "agent-workflow.yaml"), 'version: 1\nworkRecord: {backend: local, local: {taskPath: "{slug}.md"}}\n');
  await fs.writeFile(path.join(root, "first.md"), record("Root", [ref("item:v1:first")]));
  const result = await createRelatedWorkScanner()(root);
  assert.equal(result.status, "ok");
  assert.equal(result.records[0].title, "Root");
});

test("directory enumeration keeps the first 1,000 filenames and reports overflow", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-related-overflow-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "records");
  await fs.mkdir(directory);
  await fs.writeFile(path.join(root, "agent-workflow.yaml"), 'version: 1\nworkRecord: {backend: local, local: {taskPath: "records/{slug}.md"}}\n');
  await fs.writeFile(path.join(directory, "a.md"), record("First lexical record", [ref("item:v1:first")]));
  for (let i = 0; i < 1001; i += 1) await fs.writeFile(path.join(directory, `z${String(i).padStart(4, "0")}.md`), "invalid");
  const result = await createRelatedWorkScanner()(root);
  assert.equal(result.coverage.found, 1002);
  assert.equal(result.coverage.overflow, 2);
  assert.equal(result.coverage.bodyReads, 1000);
  assert.equal(result.records[0].title, "First lexical record");
});
