import test from "node:test";
import assert from "node:assert/strict";
import { renderMarkdownToHtml, renderInlineMarkdown } from "../package/minimap/ui/markdown.js";

test("renders an h1 heading", () => {
  assert.match(renderMarkdownToHtml("# Hello"), /^<h1>Hello<\/h1>$/);
});

test("renders an h6 heading", () => {
  assert.match(renderMarkdownToHtml("###### Tiny"), /^<h6>Tiny<\/h6>$/);
});

test("escapes HTML in plain text paragraphs", () => {
  const html = renderMarkdownToHtml("hello <script>alert(1)</script>");
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("renders inline code", () => {
  assert.match(renderMarkdownToHtml("hello `world`"), /<code>world<\/code>/);
});

test("renders a fenced code block", () => {
  const html = renderMarkdownToHtml("```\nfoo\n```");
  assert.match(html, /<pre><code>foo<\/code><\/pre>/);
});

test("escapes HTML inside fenced code blocks", () => {
  const html = renderMarkdownToHtml("```\n<x>\n```");
  assert.match(html, /<pre><code>&lt;x&gt;<\/code><\/pre>/);
});

test("renders an unordered list", () => {
  const html = renderMarkdownToHtml("- a\n- b");
  assert.match(html, /<ul><li>a<\/li><li>b<\/li><\/ul>/);
});

test("renders nested unordered lists", () => {
  const html = renderMarkdownToHtml("- a\n  - b");
  assert.match(html, /<ul><li><p>a<\/p><ul><li>b<\/li><\/ul><\/li><\/ul>/);
});

test("renders an ordered list", () => {
  const html = renderMarkdownToHtml("1. a\n2. b");
  assert.match(html, /<ol><li>a<\/li><li>b<\/li><\/ol>/);
});

test("renders bold and italic", () => {
  const html = renderMarkdownToHtml("**bold** and *italic*");
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
});

test("renders a horizontal rule", () => {
  assert.match(renderMarkdownToHtml("---"), /<hr ?\/?>/);
});

test("renders a blockquote", () => {
  const html = renderMarkdownToHtml("> hello");
  assert.match(html, /<blockquote>.*<p>hello<\/p>.*<\/blockquote>/s);
});

test("renders a table", () => {
  const md = "| h1 | h2 |\n| --- | --- |\n| a | b |";
  const html = renderMarkdownToHtml(md);
  assert.match(html, /<table>/);
  assert.match(html, /<th[^>]*>h1<\/th>/);
  assert.match(html, /<td[^>]*>a<\/td>/);
});

test("renderInlineMarkdown applies escape + backticks + bold + italic", () => {
  assert.equal(renderInlineMarkdown("a `b` *c* **d** <e>"), "a <code>b</code> <em>c</em> <strong>d</strong> &lt;e&gt;");
});

test("normalizes CRLF line endings", () => {
  const html = renderMarkdownToHtml("line1\r\nline2");
  // single paragraph from two lines joined by space (per current renderer)
  assert.match(html, /<p>line1 line2<\/p>/);
});

test("empty input returns empty string", () => {
  assert.equal(renderMarkdownToHtml(""), "");
  assert.equal(renderMarkdownToHtml(null), "");
  assert.equal(renderMarkdownToHtml(undefined), "");
});

// ── Source-line attributes (emitLines option) ─────────────────────────────
//
// The spec-review UI opts into per-block `data-spec-source-line` attrs so
// margin cards can be anchored by line number rather than by re-doing text
// matching in the browser. Off by default to keep other callers (scope
// preview, setup readme) lean.

test("emitLines:false (default) emits no source-line attributes", () => {
  const html = renderMarkdownToHtml("# Heading\n\nA paragraph.\n");
  assert.doesNotMatch(html, /data-spec-source-line/);
});

test("emitLines:true stamps every top-level block with its 1-based source line", () => {
  const md = "# Title\n\nA paragraph.\n\n## Section\n\nAnother paragraph.\n";
  const html = renderMarkdownToHtml(md, { emitLines: true });
  assert.match(html, /<h1 data-spec-source-line="1">/);
  assert.match(html, /<p data-spec-source-line="3">/);
  assert.match(html, /<h2 data-spec-source-line="5">/);
  assert.match(html, /<p data-spec-source-line="7">/);
});

test("emitLines:true stamps fenced code blocks and lists", () => {
  const md = "```python\nx = 1\n```\n\n- one\n- two\n";
  const html = renderMarkdownToHtml(md, { emitLines: true });
  assert.match(html, /<pre data-spec-source-line="1">/);
  assert.match(html, /<ul data-spec-source-line="5">/);
  assert.match(html, /<li data-spec-source-line="5">/);
  assert.match(html, /<li data-spec-source-line="6">/);
});

test("emitLines:true stamps individual table rows with their source line", () => {
  const md = "| h1 | h2 |\n| --- | --- |\n| a | b |\n| c | d |\n";
  const html = renderMarkdownToHtml(md, { emitLines: true });
  // header row points at the header line; body rows at their own lines
  assert.match(html, /<tr data-spec-source-line="1">/);
  assert.match(html, /<tr data-spec-source-line="3">/);
  assert.match(html, /<tr data-spec-source-line="4">/);
});

test("lineOffset shifts every emitted line value", () => {
  // Used by spec/render.js to compensate for stripped frontmatter.
  const html = renderMarkdownToHtml("# H\n\np", { emitLines: true, lineOffset: 10 });
  assert.match(html, /<h1 data-spec-source-line="11">/);
  assert.match(html, /<p data-spec-source-line="13">/);
});

test("blockquote outer block carries a line attr; inner blocks are unattributed", () => {
  // Recursive renderer calls don't propagate emitLines — the inner block
  // line indices wouldn't map back to the outer document accurately, so
  // we suppress them. The outer <blockquote> still carries the line.
  const html = renderMarkdownToHtml("> quoted\n", { emitLines: true });
  assert.match(html, /<blockquote data-spec-source-line="1">/);
  // Inner <p> rendered from the blockquote body must NOT have an attr.
  const innerMatch = html.match(/<blockquote[^>]*>(.*?)<\/blockquote>/s);
  assert.ok(innerMatch, "blockquote block should be present");
  assert.doesNotMatch(innerMatch[1], /data-spec-source-line/);
});
