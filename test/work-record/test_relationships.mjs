import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const moduleUrl = process.argv[2] ? pathToFileURL(process.argv[2]) : new URL("../../core/work_record/relationships.mjs", import.meta.url);
const { decodeConfig, decodeRecord } = await import(moduleUrl);
const fixtures = JSON.parse(await readFile(new URL("./fixtures/relationships.json", import.meta.url), "utf8"));
const bytes = (value) => new TextEncoder().encode(value);
const recordFor = (raw) => fixtures.record_template.replace("__RELATIONSHIPS__", raw === null ? "" : `**Relationships:**\n${raw}`);
const stripHints = (raw) => {
  let value = raw.trim();
  while (value.startsWith("<!--")) value = value.slice(value.indexOf("-->") + 3).trim();
  while (value.endsWith("-->")) value = value.slice(0, value.lastIndexOf("<!--")).trim();
  return value;
};
const recordOptions = { task_path: ".agent-workflow/tasks/{slug}.md", record_path: ".agent-workflow/tasks/fixture.md" };

for (const item of fixtures.cases) {
  const result = decodeRecord(bytes(recordFor(item.raw)), recordOptions);
  assert.equal(result.status, item.status, item.name);
  if (item.reason) assert.equal(result.reason, item.reason, item.name);
  if (item.status === "unsupported") assert.deepEqual(Object.keys(result).sort(), ["reason", "status"], item.name);
  if (["declared", "legacy"].includes(item.status)) {
    assert.equal(result.work_record_ref, "agent-workflow:fixture", item.name);
    assert.equal(result.title, "Fixture Work Record", item.name);
    assert.equal(result.recorded_state, "Ready to implement", item.name);
    assert.deepEqual(result.relationships, item.raw === null ? null : JSON.parse(stripHints(item.raw)), item.name);
  }
}

const expandedRecord = `# Expanded Record\n\n<!-- agent-workflow:start -->\n**Outcome:** Outcome\n**Target:** Target\n**Scope:** Scope\n**Constraints:** Constraints\n**Completion criteria:** Criteria\n**Risk:** Elevated\n**Complexity:** Moderate\n**Reason:** Required reason\n**Discovery:** Discovery\n**Material assumptions:** Assumptions\n**Plan:** Plan\n**Verification plan:** Verification\n**Plan review:** Review\n**Approvals:**\n**Exceptions:** —\n**State:** Blocked\n<!-- agent-workflow:end -->\n`;
const expandedResult = decodeRecord(bytes(expandedRecord), recordOptions);
assert.equal(expandedResult.status, "legacy");
assert.equal(expandedResult.title, "Expanded Record");
assert.equal(expandedResult.recorded_state, "Blocked");
assert.equal(expandedResult.relationships, null);
assert.equal(decodeRecord(bytes(expandedRecord.replace("**Exceptions:** —\n", "")), recordOptions).status, "legacy");
assert.deepEqual(decodeRecord(bytes(expandedRecord.replace("**Reason:** Required reason", "**Reason:**")), recordOptions), { status: "invalid", reason: "invalid_record" });
const fencedHeading = recordFor(null).replace("# Fixture Work Record", "```md\n# Not a heading\n```\n\n# Actual title ###");
assert.equal(decodeRecord(bytes(fencedHeading), recordOptions).title, "Actual title");
assert.equal(decodeRecord(bytes(recordFor(null).replace("# Fixture Work Record", "```md\n# Not a heading\n```")), recordOptions).title, "Expose related work.");

for (const item of fixtures.config_cases) {
  const result = decodeConfig(bytes(item.text));
  assert.equal(result.status, item.status, item.name);
  if (item.reason) assert.equal(result.reason, item.reason, item.name);
  if (item.status === "ok") {
    assert.equal(result.task_path, item.task_path, item.name);
    if (item.record_path) assert.equal(decodeRecord(bytes(recordFor(null)), { task_path: result.task_path, record_path: item.record_path }).status, "legacy", item.name);
  }
}

for (const vector of fixtures.invalid_utf8_hex) {
  const malformed = Uint8Array.from(vector.match(/../g), (pair) => Number.parseInt(pair, 16));
  assert.deepEqual(decodeConfig(malformed), { status: "invalid", reason: "invalid_utf8" }, `config UTF-8 ${vector}`);
  assert.deepEqual(decodeRecord(malformed, recordOptions), { status: "invalid", reason: "invalid_utf8" }, `record UTF-8 ${vector}`);
}
assert.deepEqual(decodeConfig(bytes(" ".repeat(65537))), { status: "invalid", reason: "config_too_large" });
const baseConfig = 'version: 1\nworkRecord: {backend: local, local: {taskPath: "records/{slug}.md"}}\n';
const exactConfigText = `${baseConfig}#${"x".repeat(65536 - baseConfig.length - 2)}\n`;
assert.equal(bytes(exactConfigText).byteLength, 65536);
assert.equal(decodeConfig(bytes(exactConfigText)).status, "ok");
assert.deepEqual(decodeConfig(bytes(`version: 1\nworkRecord: {backend: local, local: {taskPath: "${"x".repeat(65536)}"}}`)), { status: "invalid", reason: "config_too_large" });
assert.deepEqual(decodeRecord(Uint8Array.from([0xff]), recordOptions), { status: "invalid", reason: "invalid_utf8" });
assert.deepEqual(decodeRecord(bytes(recordFor("{}")), { ...recordOptions, record_path: "../fixture.md" }), { status: "invalid", reason: "invalid_record_path" });
assert.deepEqual(decodeRecord(bytes(recordFor("{}")), { ...recordOptions, task_path: "C:/tasks/{slug}.md" }), { status: "invalid", reason: "invalid_task_path" });
assert.equal(decodeRecord(bytes(recordFor(null).replace(/\n/g, "\r\n")), recordOptions).status, "legacy");
assert.equal(decodeRecord(bytes(recordFor(null)), { ...recordOptions, record_path: ".agent-workflow/tasks/\uFEFF.md" }).work_record_ref, "agent-workflow:\uFEFF");
assert.deepEqual(decodeRecord(bytes(recordFor(null)), { ...recordOptions, record_path: ".agent-workflow/tasks/\u00a0.md" }), { status: "invalid", reason: "invalid_slug" });
const sourcePort = `{"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"scope","local_ref":"item","url":"https://example.com:8443/item"}],"pull_requests":[]}`;
assert.equal(decodeRecord(bytes(recordFor(sourcePort)), recordOptions).status, "declared");
const sourceMissingAuthority = `{"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"scope","local_ref":"item","url":"https:example.com/item"}],"pull_requests":[]}`;
assert.deepEqual(decodeRecord(bytes(recordFor(sourceMissingAuthority)), recordOptions), { status: "invalid", reason: "invalid_relationships" });
const prMissingAuthority = `{"schema_version":1,"sources":[],"pull_requests":["https:github.com/rore/repo/pull/1"]}`;
assert.deepEqual(decodeRecord(bytes(recordFor(prMissingAuthority)), recordOptions), { status: "invalid", reason: "invalid_relationships" });
const unsupportedThenUnsafePr = `{"schema_version":1,"sources":[],"pull_requests":["https://gitlab.com/r/r/-/merge_requests/1","javascript:bad"]}`;
assert.deepEqual(decodeRecord(bytes(recordFor(unsupportedThenUnsafePr)), recordOptions), { status: "invalid", reason: "invalid_relationships" });
const unsupportedThenDuplicatePr = `{"schema_version":1,"sources":[],"pull_requests":["https://gitlab.com/r/r/-/merge_requests/1","https://github.com/rore/repo/pull/1","https://github.com/RORE/REPO/pull/1"]}`;
assert.deepEqual(decodeRecord(bytes(recordFor(unsupportedThenDuplicatePr)), recordOptions), { status: "invalid", reason: "invalid_relationships" });
const whitespaceIdentity = `{"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"\u00a0","local_ref":"item"}],"pull_requests":[]}`;
assert.deepEqual(decodeRecord(bytes(recordFor(whitespaceIdentity)), recordOptions), { status: "invalid", reason: "invalid_relationships" });
const zeroVersion = `{"schema_version":0,"sources":[],"pull_requests":[]}`;
assert.deepEqual(decodeRecord(bytes(recordFor(zeroVersion)), recordOptions), { status: "invalid", reason: "invalid_relationships" });
const tooLargeRelationships = `{"schema_version":1,"sources":[],"pull_requests":[],"padding":"${"x".repeat(65536)}"}`;
assert.deepEqual(decodeRecord(bytes(recordFor(tooLargeRelationships)), recordOptions), { status: "invalid", reason: "relationships_too_large" });
const relationshipWithRef = (ref) => JSON.stringify({ schema_version: 1, sources: [{ provider: "p", scope_ref: "s", local_ref: ref }], pull_requests: [] });
const exactRefLength = 65536 - bytes(relationshipWithRef("")).byteLength;
assert.equal(bytes(relationshipWithRef("x".repeat(exactRefLength))).byteLength, 65536);
assert.equal(decodeRecord(bytes(recordFor(relationshipWithRef("x".repeat(exactRefLength)))), recordOptions).status, "declared");
assert.deepEqual(decodeRecord(bytes(recordFor(relationshipWithRef("x".repeat(exactRefLength + 1)))), recordOptions), { status: "invalid", reason: "relationships_too_large" });
assert.equal(decodeRecord(bytes(recordFor(null) + "x".repeat(100000)), recordOptions).status, "legacy");

const deeplyNested = `{"schema_version":1,"sources":[],"pull_requests":[],"extra":${"[".repeat(3000)}0${"]".repeat(3000)}}`;
const deepResult = decodeRecord(bytes(recordFor(deeplyNested)), recordOptions);
assert.equal(deepResult.status, "invalid");
assert.ok(["invalid_json", "invalid_relationships"].includes(deepResult.reason));

const tooManyAliases = `version: 1\nbase: &base {x: 1}\nextra: [${Array(101).fill("*base").join(", ")}]\nworkRecord: {backend: local, local: {taskPath: "records/{slug}.md"}}\n`;
assert.deepEqual(decodeConfig(bytes(tooManyAliases)), { status: "invalid", reason: "invalid_config" });
const maxAliases = `version: 1\nbase: &base {x: 1}\nextra: [${Array(100).fill("*base").join(", ")}]\nworkRecord: {backend: local, local: {taskPath: "records/{slug}.md"}}\n`;
assert.deepEqual(decodeConfig(bytes(maxAliases)), { status: "ok", task_path: "records/{slug}.md" });
const tooDeepYaml = `version: 1\nextra: ${"[".repeat(101)}0${"]".repeat(101)}\nworkRecord: {backend: local, local: {taskPath: "records/{slug}.md"}}\n`;
assert.deepEqual(decodeConfig(bytes(tooDeepYaml)), { status: "invalid", reason: "invalid_config" });
const tooManyContainers = `version: 1\nextra: [${Array(10001).fill("{}").join(",")}]\nworkRecord: {backend: local, local: {taskPath: "records/{slug}.md"}}\n`;
assert.deepEqual(decodeConfig(bytes(tooManyContainers)), { status: "invalid", reason: "invalid_config" });
const mergeBase = `{${Array.from({ length: 1001 }, (_, i) => `k${i}: ${i}`).join(", ")}}`;
const tooMuchMergeWork = `version: 1\nbase: &base ${mergeBase}\nextra: {<<: [${Array(10).fill("*base").join(", ")}] }\nworkRecord: {backend: local, local: {taskPath: "records/{slug}.md"}}\n`;
assert.ok(bytes(tooMuchMergeWork).byteLength < 65536);
assert.deepEqual(decodeConfig(bytes(tooMuchMergeWork)), { status: "invalid", reason: "invalid_config" });
assert.deepEqual(decodeConfig(bytes("version: 1\n---\nversion: 1\n")), { status: "invalid", reason: "invalid_config" });

console.log(`Node relationship decoder: ${fixtures.cases.length} relationship and ${fixtures.config_cases.length} config fixtures plus generated bounds passed`);
