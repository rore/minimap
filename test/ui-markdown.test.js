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
