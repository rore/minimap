import test from "node:test";
import assert from "node:assert/strict";
import { slugifyHeadingId } from "../package/minimap/ui/spec/toc.js";

test("slugifyHeadingId: lowercases, replaces spaces with dashes, strips punctuation", () => {
  assert.equal(slugifyHeadingId("On This Page", new Set()), "on-this-page");
  assert.equal(slugifyHeadingId("Section: Why & How?", new Set()), "section-why-how");
});

test("slugifyHeadingId: collapses runs of whitespace and dashes", () => {
  assert.equal(slugifyHeadingId("a   b\n\nc", new Set()), "a-b-c");
  assert.equal(slugifyHeadingId("--a--b--", new Set()), "a-b");
});

test("slugifyHeadingId: empty / pure-punctuation input falls back to 'section'", () => {
  assert.equal(slugifyHeadingId("", new Set()), "section");
  assert.equal(slugifyHeadingId("???", new Set()), "section");
});

test("slugifyHeadingId: deduplicates against the taken set with -2, -3, …", () => {
  const taken = new Set(["intro"]);
  assert.equal(slugifyHeadingId("Intro", taken), "intro-2");
  taken.add("intro-2");
  assert.equal(slugifyHeadingId("Intro", taken), "intro-3");
});

test("slugifyHeadingId: non-ASCII letters survive (they're valid in HTML ids)", () => {
  assert.equal(slugifyHeadingId("Café résumé", new Set()), "café-résumé");
});
