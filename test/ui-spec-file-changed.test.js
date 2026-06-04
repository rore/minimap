import test from "node:test";
import assert from "node:assert/strict";
import { detectSpecFileChange } from "../package/minimap/ui/spec/file-change.js";

test("detectSpecFileChange returns false when stash is empty (first load not yet complete)", () => {
  assert.equal(detectSpecFileChange("", "abc123"), false);
});

test("detectSpecFileChange returns false when fresh hash is empty (server returned no metadata)", () => {
  assert.equal(detectSpecFileChange("abc123", ""), false);
});

test("detectSpecFileChange returns false when hashes match", () => {
  assert.equal(detectSpecFileChange("abc123", "abc123"), false);
});

test("detectSpecFileChange returns true when both hashes are non-empty and differ", () => {
  assert.equal(detectSpecFileChange("abc123", "def456"), true);
});

test("detectSpecFileChange tolerates null / undefined inputs", () => {
  assert.equal(detectSpecFileChange(null, "abc"), false);
  assert.equal(detectSpecFileChange("abc", null), false);
  assert.equal(detectSpecFileChange(undefined, undefined), false);
});
