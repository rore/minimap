import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Skill-doc drift guard. AGENTS.md § "Skill-doc drift check" calls out that
// behavior changes and skill prose live in different files and silently rot
// — the apply cascade was widened once and references/http.md still claimed
// exact-quote for two commits, then `--json-stdin` made the CLI multi-line-
// capable and references/http.md still framed it as single-line.
//
// This file pins concrete strings whose absence would mean the docs no longer
// describe shipped behavior. Each assertion names the behavior it guards. If
// you change a behavior, update the doc AND the assertion in the same commit.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const SKILL = path.join(projectRoot, "package/minimap/skills/minimap-spec-review");

async function readDoc(relPath) {
  return fs.readFile(path.join(SKILL, relPath), "utf8");
}

test("cli.md documents the inline anchor disambiguators", async () => {
  // Guards: --line-start / --line-end / --quote-offset on comment add and
  // suggest add. Without them an agent hitting anchor_ambiguous from an
  // inline --quote ... call has no recovery path short of switching to
  // --json-stdin, which is exactly the trap the inline flags exist to avoid.
  const doc = await readDoc("references/cli.md");
  assert.ok(doc.includes("--line-start"), "cli.md should mention --line-start");
  assert.ok(doc.includes("--line-end"), "cli.md should mention --line-end");
  assert.ok(doc.includes("--quote-offset"), "cli.md should mention --quote-offset");
});

test("cli.md shows a PowerShell --json-stdin example", async () => {
  // Guards: PowerShell users on Windows have a working stdin pattern. Without
  // an example they trip on heredoc-vs-here-string differences and reach for
  // /api/comment-style invented endpoints (the Codex failure that motivated
  // this fix).
  const doc = await readDoc("references/cli.md");
  assert.ok(doc.includes("ConvertTo-Json"), "cli.md should show the PowerShell ConvertTo-Json | node pattern");
  assert.ok(/--json-stdin/.test(doc), "PowerShell example should still pipe to --json-stdin");
});

test("SKILL.md names the correct comments endpoint when describing HTTP fallback", async () => {
  // Guards: when an agent does fall back to HTTP, it has the literal route
  // string in front of it instead of guessing /api/comment.
  const doc = await readDoc("SKILL.md");
  assert.ok(
    doc.includes("/api/spec-sessions/by-file/comments"),
    "SKILL.md should name the literal comments endpoint to prevent invented routes",
  );
});

test("SKILL.md guides recovery from anchor_ambiguous with the inline flags", async () => {
  // Guards: when anchor_ambiguous comes back, the agent knows to retry with
  // --line-start/--line-end or --quote-offset rather than abandoning the
  // CLI for HTTP.
  const doc = await readDoc("SKILL.md");
  assert.ok(doc.includes("anchor_ambiguous"), "SKILL.md should reference anchor_ambiguous by name");
  assert.ok(
    doc.includes("--line-start") || doc.includes("--quote-offset"),
    "SKILL.md should point at the inline disambiguator flags as the recovery path",
  );
});
