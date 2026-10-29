import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getAppearanceColor, normalizeAppearance } from "../package/minimap/ui/appearance.js";
import { loadWorkspace } from "../package/minimap/src/roadmap.js";

test("normalizes explicit fields, preserves empty list, order, and first duplicate", () => {
  assert.deepEqual(normalizeAppearance({ cardFields: ["repo", "status", "repo", "bad.field", "id"] }), {
    appearance: { cardFields: ["repo", "status"] },
    warnings: [{
      code: "invalid_appearance",
      message: "Some roadmap appearance settings were ignored or limited.",
      details: ["duplicate cardFields entry was ignored", "invalid cardFields entry was ignored", "invalid cardFields entry was ignored"],
    }],
  });
  assert.deepEqual(normalizeAppearance({ cardFields: [] }).appearance, { cardFields: [] });
  assert.deepEqual(normalizeAppearance({}).appearance, {});
});

test("invalid whole appearance restores null while malformed JSON config handling stays elsewhere", () => {
  for (const value of [null, false, "x", [], 4]) {
    const result = normalizeAppearance(value);
    assert.equal(result.appearance, null);
    assert.equal(result.warnings.length, 1);
  }
  assert.deepEqual(normalizeAppearance(undefined), { appearance: null, warnings: [] });
  assert.equal(normalizeAppearance({ notes: "x".repeat(65 * 1024) }).appearance, null);
  const unicodeOversize = normalizeAppearance({ notes: "é".repeat(33 * 1024) });
  assert.equal(unicodeOversize.appearance, null);
  assert.match(unicodeOversize.warnings[0].details[0], /64 KiB/);
});

test("enforces prefix limits and reports one bounded warning", () => {
  const cardFields = Array.from({ length: 40 }, (_, i) => `field${i}`);
  const values = Object.fromEntries(Array.from({ length: 70 }, (_, i) => [`v${i}`, "blue"]));
  const tagColors = Object.fromEntries(Array.from({ length: 35 }, (_, i) => [`field${i}`, values]));
  const result = normalizeAppearance({ cardFields, tagColors, extra: true });
  assert.equal(result.appearance.cardFields.length, 32);
  assert.equal(Object.keys(result.appearance.tagColors).length, 32);
  assert.equal(Object.keys(result.appearance.tagColors.field0).length, 64);
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0].details.length <= 8);
});

test("drops invalid types, forbidden fields, status colors, oversized keys, and unknown palettes", () => {
  const result = normalizeAppearance({
    cardFields: "status",
    cardColorBy: "status",
    tagColors: {
      status: { active: "red" },
      constructor: { x: "blue" },
      repo: { okay: "teal", ["x".repeat(121)]: "blue", unknown: "chartreuse" },
      broken: [],
    },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(result.appearance)), { tagColors: { repo: { okay: "teal" } } });
  assert.equal(result.warnings.length, 1);
});

test("colorTags accepts booleans, defaults invalid values to enabled, and preserves raw border mappings", () => {
  const disabled = normalizeAppearance({ colorTags: false, tagColors: { repo: { alpha: "blue" } } });
  assert.equal(disabled.appearance.colorTags, false);
  assert.equal(getAppearanceColor(disabled.appearance, "repo", "alpha"), "blue");

  const enabled = normalizeAppearance({ colorTags: true });
  assert.equal(enabled.appearance.colorTags, true);

  const invalid = normalizeAppearance({ colorTags: "false" });
  assert.equal(Object.hasOwn(invalid.appearance, "colorTags"), false);
  assert.equal(invalid.warnings.length, 1);
  assert.match(invalid.warnings[0].details[0], /colorTags must be a boolean/);

  assert.deepEqual(normalizeAppearance({}).appearance, {});
});

test("lookups use exact own keys and scalar string forms without prototype access", () => {
  const { appearance } = normalizeAppearance(JSON.parse('{"tagColors":{"repo":{"0":"blue","false":"amber","__proto__":"red","Team":"green"},"Repo":{"Team":"purple"},"team_name":{"x":"teal"},"team-name":{"x":"red"}}}'));
  assert.equal(getAppearanceColor(appearance, "repo", 0), "blue");
  assert.equal(getAppearanceColor(appearance, "repo", false), "amber");
  assert.equal(getAppearanceColor(appearance, "repo", "Team"), "green");
  assert.equal(getAppearanceColor(appearance, "repo", "team"), "");
  assert.equal(getAppearanceColor(appearance, "Repo", "Team"), "purple");
  assert.equal(getAppearanceColor(appearance, "team_name", "x"), "teal");
  assert.equal(getAppearanceColor(appearance, "team-name", "x"), "red");
  assert.equal(getAppearanceColor(appearance, "repo", "toString"), "");
  assert.equal(getAppearanceColor(appearance, "repo", ""), "");
  assert.equal(getAppearanceColor(appearance, "repo", null), "");
  assert.equal(getAppearanceColor({ tagColors: { status: { active: "red" } } }, "status", "active"), "");
  const inheritedColors = Object.create({ repo: { x: "blue" } });
  assert.equal(getAppearanceColor({ tagColors: inheritedColors }, "repo", "x"), "");
  const invalidPalette = { tagColors: { repo: { x: new String("blue") } } };
  assert.equal(getAppearanceColor(invalidPalette, "repo", "x"), "");
});

test("loadWorkspace carries fresh config-only appearance and defaults missing appearance to null", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-appearance-"));
  try {
    const roadmapRoot = path.join(repoRoot, "roadmap");
    await fs.mkdir(path.join(roadmapRoot, "features"), { recursive: true });
    await fs.mkdir(path.join(roadmapRoot, "ideas"));
    await fs.writeFile(path.join(roadmapRoot, "board.md"), "# Queued\n", "utf8");
    await fs.writeFile(path.join(roadmapRoot, "scope.md"), "", "utf8");

    const defaults = await loadWorkspace(repoRoot);
    assert.equal(defaults.appearance, null);
    assert.equal(defaults.warnings.some((warning) => warning.code === "invalid_appearance"), false);

    const configPath = path.join(repoRoot, "roadmap.config.json");
    await fs.writeFile(configPath, JSON.stringify({ roadmapPath: "roadmap", appearance: { cardFields: ["repo"] } }), "utf8");
    const first = await loadWorkspace(repoRoot);
    assert.deepEqual(first.appearance, { cardFields: ["repo"] });

    await fs.writeFile(configPath, JSON.stringify({ roadmapPath: "roadmap", appearance: { cardFields: [], cardColorBy: "repo" } }), "utf8");
    const refreshed = await loadWorkspace(repoRoot);
    assert.deepEqual(refreshed.appearance, { cardFields: [], cardColorBy: "repo" });
    assert.deepEqual(first.appearance, { cardFields: ["repo"] });

    await fs.writeFile(configPath, "{", "utf8");
    await assert.rejects(loadWorkspace(repoRoot), (error) => error.code === "config_error");
  } finally {
    await fs.rm(repoRoot, { recursive: true, force: true });
  }
});
