// Tests that the metadata triple-write at the tail of
// applyFileSessionSuggestion / rollbackFileSessionSuggestion is atomic-ish:
// a crash mid-temp-write must leave the on-disk session store in its
// pre-apply state so the operation can be retried cleanly.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  attachFileSession,
  addFileSessionSuggestion,
  applyFileSessionSuggestion,
  getFileSessionContext,
} from "../package/minimap/src/sessions.js";

test("applyFileSessionSuggestion: crash mid-temp-write leaves session store unchanged", async () => {
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-atomic-"));
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-atomic-work-"));
  const targetPath = path.join(workDir, "spec.md");
  const originalText = "# Spec\n\nHello world.\n";
  await fs.writeFile(targetPath, originalText, "utf8");

  const opts = { minimapHome };
  await attachFileSession(targetPath, opts);
  const { suggestion } = await addFileSessionSuggestion(
    targetPath,
    {
      by: "tester",
      kind: "replace",
      quote: "Hello world.",
      content: "Hello, world!",
      rationale: "punctuation",
    },
    opts,
  );

  // Capture pre-apply state so we can assert it survived the failed apply.
  const ctxBefore = await getFileSessionContext(targetPath, opts);
  const pendingBefore = ctxBefore.suggestions.find((s) => s.id === suggestion.id);
  assert.equal(pendingBefore.status, "pending", "precondition: suggestion starts pending");

  // Sabotage: fail on the second .tmp- write to simulate a crash mid
  // multi-file transaction. The first temp write succeeds; the second
  // throws; the rename phase must never run, so the .json files on disk
  // stay at their pre-apply contents.
  const realWriteFile = fs.writeFile.bind(fs);
  let tmpWriteCount = 0;
  const sabotaged = async (filePath, ...rest) => {
    if (typeof filePath === "string" && filePath.includes(".tmp-")) {
      tmpWriteCount += 1;
      if (tmpWriteCount === 2) {
        throw new Error("simulated crash mid-transaction");
      }
    }
    return realWriteFile(filePath, ...rest);
  };
  fs.writeFile = sabotaged;
  let caught;
  try {
    await applyFileSessionSuggestion(
      targetPath,
      suggestion.id,
      { by: "tester" },
      opts,
    );
  } catch (error) {
    caught = error;
  } finally {
    fs.writeFile = realWriteFile;
  }
  assert.ok(caught, "apply should have thrown when mid-temp-write");
  assert.match(caught.message, /simulated crash/);
  assert.ok(tmpWriteCount >= 2, `expected at least 2 .tmp- writes, saw ${tmpWriteCount}`);

  // Post-condition: session metadata is consistent. The suggestion must
  // still appear pending; suggestions.jsonl and session.json were not
  // promoted past the failed write because writeAllOrNothing never reached
  // the rename phase.
  const ctxAfter = await getFileSessionContext(targetPath, opts);
  const stillPending = ctxAfter.suggestions.find((s) => s.id === suggestion.id);
  assert.ok(stillPending, "suggestion must still exist after failed apply");
  assert.equal(
    stillPending.status,
    "pending",
    "suggestion must still be pending after the failed apply",
  );
});
