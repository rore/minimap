import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWhitespaceNormalizedMap,
  buildRenderedNormalizedMap,
  sourceQuoteForRenderedSelection,
  resolveSourceQuoteFromRendered,
  nthOccurrence,
  computeLineRange,
  normalizeVisibleText,
  stripMarkdownSyntaxForUi,
  decodeLiteralEscapes,
} from "../package/minimap/ui/spec/anchors.js";

test("buildWhitespaceNormalizedMap collapses whitespace and preserves length mapping", () => {
  const result = buildWhitespaceNormalizedMap("a   b\n\nc");
  assert.equal(result.text, "a b c");
  // originalIndexes maps each normalized char back to its source offset
  assert.equal(result.originalIndexes.length, result.text.length);
});

test("buildWhitespaceNormalizedMap empty input is safe", () => {
  const result = buildWhitespaceNormalizedMap("");
  assert.equal(result.text, "");
  assert.deepEqual(result.originalIndexes, []);
});

test("buildRenderedNormalizedMap strips markdown markers from inline content", () => {
  // Backticks, asterisks, underscores normalized to plain text
  const result = buildRenderedNormalizedMap("`code` and **bold**");
  assert.match(result.text, /code/);
  assert.match(result.text, /bold/);
  // The rendered version should not contain ` or *
  assert.doesNotMatch(result.text, /[`*]/);
});

test("nthOccurrence: finds the nth match (0-indexed)", () => {
  assert.equal(nthOccurrence("aaa-bbb-aaa", "aaa", 0), 0);
  assert.equal(nthOccurrence("aaa-bbb-aaa", "aaa", 1), 8);
  // Past-the-end clamps to last occurrence (per the implementation contract)
  assert.equal(nthOccurrence("aaa-bbb-aaa", "aaa", 2), 8);
});

test("nthOccurrence: missing needle returns -1", () => {
  assert.equal(nthOccurrence("abc", "xyz", 0), -1);
});

test("computeLineRange: maps a single-line offset to {lineStart,lineEnd}", () => {
  assert.deepEqual(computeLineRange("line1\nline2\nline3", 6, 5), { lineStart: 2, lineEnd: 2 });
});

test("computeLineRange: maps a multi-line range correctly", () => {
  const text = "line1\nline2\nline3";
  // Offset 0, length 11 = "line1\nline2" — no trailing newline, so lineEnd=2
  assert.deepEqual(computeLineRange(text, 0, 11), { lineStart: 1, lineEnd: 2 });
});

test("normalizeVisibleText: collapses whitespace runs to single spaces and trims", () => {
  assert.equal(normalizeVisibleText("  hello   world  "), "hello world");
});

test("stripMarkdownSyntaxForUi: removes inline code/bold/italic markers", () => {
  assert.equal(stripMarkdownSyntaxForUi("`code` **bold** *italic*"), "code bold italic");
});

test("decodeLiteralEscapes: \\n becomes a real newline", () => {
  assert.equal(decodeLiteralEscapes("a\\nb"), "a\nb");
});

test("decodeLiteralEscapes: leaves text without escapes alone", () => {
  assert.equal(decodeLiteralEscapes("hello"), "hello");
});

test("sourceQuoteForRenderedSelection: maps a rendered selection back to the source", () => {
  const source = "Plain text. This is `inline code` and a sentence.";
  const result = sourceQuoteForRenderedSelection("inline code", source);
  // Result should be the source-side text matching the rendered selection
  assert.ok(result, "expected a non-empty source quote");
  assert.match(result, /inline code/);
});

test("sourceQuoteForRenderedSelection: returns selection-trim fallback when not found", () => {
  const source = "Plain text only.";
  const result = sourceQuoteForRenderedSelection("nonexistent xyz", source);
  // When no match the implementation falls back to selectionText.trim()
  assert.equal(result, "nonexistent xyz");
});

test("resolveSourceQuoteFromRendered: returns { quote, lineRange, quoteOffset } for a found selection", () => {
  const source = "Line one with text.\nLine two with more text.";
  const result = resolveSourceQuoteFromRendered("Line two", source, 0);
  assert.ok(result);
  // quote should match
  assert.match(result.quote, /Line two/);
  // lineRange present
  assert.ok(result.lineRange);
  assert.equal(typeof result.quoteOffset, "number");
});
