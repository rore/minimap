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

import { buildSpecTocModel } from "../package/minimap/ui/spec/toc.js";

// Minimal heading-like stand-ins. The function only reads tagName, id, textContent.
function fakeHeading(tag, text, id = "") {
  return { tagName: tag, textContent: text, id, _idAssigned: false, set _setId(v) { this.id = v; this._idAssigned = true; } };
}

test("buildSpecTocModel: returns one entry per heading in document order", () => {
  const headings = [
    fakeHeading("H2", "Overview"),
    fakeHeading("H3", "Goals"),
    fakeHeading("H2", "Architecture"),
  ];
  const model = buildSpecTocModel(headings, { assignId: (el, slug) => { el.id = slug; } });
  assert.deepEqual(
    model.map((entry) => ({ level: entry.level, id: entry.id, text: entry.text })),
    [
      { level: 2, id: "overview", text: "Overview" },
      { level: 3, id: "goals", text: "Goals" },
      { level: 2, id: "architecture", text: "Architecture" },
    ],
  );
});

test("buildSpecTocModel: reuses existing ids when present", () => {
  const headings = [fakeHeading("H2", "Overview", "preset-id")];
  const model = buildSpecTocModel(headings, { assignId: () => assert.fail("should not assign") });
  assert.equal(model[0].id, "preset-id");
});

test("buildSpecTocModel: dedupes generated slugs against existing ids in this build", () => {
  const headings = [
    fakeHeading("H2", "Setup"),
    fakeHeading("H2", "Setup"),
    fakeHeading("H2", "Setup"),
  ];
  const model = buildSpecTocModel(headings, { assignId: (el, slug) => { el.id = slug; } });
  assert.deepEqual(model.map((m) => m.id), ["setup", "setup-2", "setup-3"]);
});

test("buildSpecTocModel: collapses internal whitespace in display text", () => {
  const headings = [fakeHeading("H2", "  Lots   of\n  space  ")];
  const model = buildSpecTocModel(headings, { assignId: (el, slug) => { el.id = slug; } });
  assert.equal(model[0].text, "Lots of space");
});

test("buildSpecTocModel: empty input returns []", () => {
  assert.deepEqual(buildSpecTocModel([], { assignId: () => {} }), []);
});
