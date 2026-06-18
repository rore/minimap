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

// Regression: a real-world bug surfaced when MINIMAP_HOME/session-index.json
// ended up with trailing bytes from a previous longer write. Pattern in the
// damaged file:
//
//     ...valid JSON ending with `}\n`
//     0a"
//       }
//     }
//
// Diagnosis: writeJson used bare fs.writeFile to the live target. When the
// new content was shorter than the existing file (or a write was preempted),
// the tail of the old file survived past the new EOF, yielding invalid JSON
// the next time the server tried to load it (HTTP 500s on attach).
//
// Fix: writeJson must write to a `.tmp-<pid>` sibling and rename, the same
// pattern writeAllOrNothing uses for the session metadata triple-write.
//
// This test simulates the failure mode that produced the corruption: a write
// to session-index.json that crashes mid-flight. With atomic writes, the
// on-disk file must either contain the previous valid JSON or the new valid
// JSON — never a mash-up of both.

test("session-index.json: writes go to a temp file and rename, never directly to the live target", async () => {
  // Why this contract matters:
  // A real-world bug surfaced when MINIMAP_HOME/session-index.json had
  // trailing bytes from a previous longer write — the new (shorter) JSON
  // followed by leftover old bytes past the new EOF. The next read failed
  // JSON parsing and the server returned HTTP 500 on attach.
  //
  //     ...valid JSON ending with `}\n`
  //     0a"
  //       }
  //     }
  //
  // Diagnosis: writeJson called fs.writeFile directly against the live
  // target. fs.writeFile is not atomic on Windows — preempted writes,
  // antivirus interception, or two writers racing each leave a partial
  // file. The fix is the same write-temp-then-rename pattern that
  // writeAllOrNothing already uses for the metadata triple-write.
  //
  // We can't reliably simulate a real partial write in a unit test, but we
  // can assert the contract that prevents it: the live target file must
  // never be written to directly. A write to a `.tmp-<pid>` sibling
  // followed by a rename is the only acceptable shape.

  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-atomic-idx-"));
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-atomic-idx-work-"));
  const opts = { minimapHome };
  const indexPath = path.join(minimapHome, "session-index.json");

  // Seed a valid index by attaching one file. This first attach is when
  // the directory + initial index get created; we instrument the second
  // attach below so the seed write doesn't pollute the trace.
  const firstPath = path.join(workDir, "first.md");
  await fs.writeFile(firstPath, "# First\n", "utf8");
  await attachFileSession(firstPath, opts);

  // Spy on every fs.writeFile call during the second attach. Atomic
  // writers go to `.tmp-*` siblings; non-atomic writers hit the live
  // index path directly.
  const writes = [];
  const realWriteFile = fs.writeFile.bind(fs);
  fs.writeFile = async (filePath, content, encoding) => {
    if (typeof filePath === "string") {
      writes.push(filePath);
    }
    return realWriteFile(filePath, content, encoding);
  };

  try {
    const secondPath = path.join(workDir, "second.md");
    await realWriteFile(secondPath, "# Second\n", "utf8");
    await attachFileSession(secondPath, opts);
  } finally {
    fs.writeFile = realWriteFile;
  }

  const writesToIndex = writes.filter((w) => w.endsWith("session-index.json"));
  const writesToIndexTemp = writes.filter((w) => w.includes("session-index.json.tmp-"));

  assert.equal(
    writesToIndex.length,
    0,
    `session-index.json must never be written to directly; saw ${writesToIndex.length} direct write(s)`,
  );
  assert.ok(
    writesToIndexTemp.length >= 1,
    `expected at least one .tmp-<pid> write for session-index.json, saw ${writesToIndexTemp.length}`,
  );

  // Sanity: the resulting live file must still be valid JSON containing
  // both attached entries. (If atomic writes also broke functionality, no
  // amount of trace evidence would matter.)
  const text = await fs.readFile(indexPath, "utf8");
  const parsed = JSON.parse(text);
  assert.ok(parsed && parsed.files && Object.keys(parsed.files).length >= 2, "index should record both attached files");
});
