// Document edits and session metadata use a recovery journal. A failure
// before document promotion leaves the old content; afterward, the next
// session read can complete metadata if the target still matches.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  attachFileSession,
  moveFileSession,
  removeFileSession,
  addFileSessionComment,
  addFileSessionSuggestion,
  applyFileSessionSuggestion,
  rollbackFileSessionSuggestion,
  getFileSessionContext,
} from "../package/minimap/src/sessions.js";

test("applyFileSessionSuggestion: journal publication failure leaves session store unchanged", async () => {
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

  // Fail while publishing the journal, before document or metadata promotion.
  // No file in the session should advance.
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

  // The target was not promoted, so recovery discards the intent.
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

async function transactionFixture(t) {
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-transaction-"));
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-transaction-work-"));
  t.after(async () => {
    await fs.rm(minimapHome, { recursive: true, force: true });
    await fs.rm(workDir, { recursive: true, force: true });
  });
  const targetPath = path.join(workDir, "spec.md");
  const originalText = "# Spec\n\nHello world.\n";
  await fs.writeFile(targetPath, originalText, "utf8");
  const opts = { minimapHome };
  await attachFileSession(targetPath, opts);
  const { suggestion } = await addFileSessionSuggestion(targetPath, {
    by: "tester", kind: "replace", quote: "Hello world.", content: "Hello, world!",
  }, opts);
  return { targetPath, originalText, suggestion, opts, minimapHome };
}

async function failSessionPromotion(action) {
  const realRename = fs.rename;
  let failed = false;
  fs.rename = async (from, to) => {
    if (!failed && path.basename(String(to)) === "session.json" && String(from).includes(".tmp-")) {
      failed = true;
      throw new Error("simulated metadata rename failure");
    }
    return realRename(from, to);
  };
  try { await assert.rejects(action, /simulated metadata rename failure/); }
  finally { fs.rename = realRename; }
  assert.ok(failed, "failure must happen after document promotion");
}

test("apply interruption recovers metadata when the document still matches", async (t) => {
  const { targetPath, suggestion, opts, minimapHome } = await transactionFixture(t);
  await failSessionPromotion(() => applyFileSessionSuggestion(targetPath, suggestion.id, { by: "tester" }, opts));
  assert.match(await fs.readFile(targetPath, "utf8"), /Hello, world!/);

  const context = await getFileSessionContext(targetPath, opts);
  assert.equal(context.suggestions.find((item) => item.id === suggestion.id).status, "applied");
  const sessionDir = path.join(minimapHome, "sessions", context.session.id);
  await assert.rejects(() => fs.access(path.join(sessionDir, "suggestion-transaction.json")), { code: "ENOENT" });
  const events = (await fs.readFile(path.join(sessionDir, "events.jsonl"), "utf8")).trim().split("\n");
  assert.equal(events.filter((line) => JSON.parse(line).type === "suggestion_applied").length, 1);
});

test("rollback interruption recovers metadata and preserves the original document", async (t) => {
  const { targetPath, originalText, suggestion, opts } = await transactionFixture(t);
  await applyFileSessionSuggestion(targetPath, suggestion.id, { by: "tester" }, opts);
  await failSessionPromotion(() => rollbackFileSessionSuggestion(targetPath, suggestion.id, { by: "tester" }, opts));
  assert.equal(await fs.readFile(targetPath, "utf8"), originalText);
  const context = await getFileSessionContext(targetPath, opts);
  assert.equal(context.suggestions.find((item) => item.id === suggestion.id).status, "pending");
});

test("recovery leaves an external document edit untouched", async (t) => {
  const { targetPath, suggestion, opts } = await transactionFixture(t);
  await failSessionPromotion(() => applyFileSessionSuggestion(targetPath, suggestion.id, { by: "tester" }, opts));
  const externalText = "# Spec\n\nIndependent edit.\n";
  await fs.writeFile(targetPath, externalText, "utf8");
  await assert.rejects(
    () => getFileSessionContext(targetPath, opts),
    (error) => error.code === "recovery_conflict",
  );
  assert.equal(await fs.readFile(targetPath, "utf8"), externalText);
});

test("a competing process holds the session lock until its edit completes", async (t) => {
  const { targetPath, suggestion, opts, minimapHome } = await transactionFixture(t);
  const context = await getFileSessionContext(targetPath, opts);
  const lockPath = path.join(minimapHome, "sessions", context.session.id, "session-mutation.lock");
  const holderCode = [
    "const fs=require('fs');",
    "fs.writeFileSync(" + JSON.stringify(lockPath) + ",JSON.stringify({pid:process.pid,token:'holder'}),{flag:'wx'});",
    "process.stdout.write('ready\\n');",
    "setTimeout(()=>{fs.unlinkSync(" + JSON.stringify(lockPath) + ");process.exit(0)},450);",
  ].join("");
  const holder = spawn(process.execPath, ["-e", holderCode], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    holder.stdout.once("data", resolve);
    holder.once("error", reject);
  });
  const started = Date.now();
  await applyFileSessionSuggestion(targetPath, suggestion.id, { by: "tester" }, opts);
  assert.ok(Date.now() - started >= 250, "apply should wait for the other process's lock");
  assert.equal((await getFileSessionContext(targetPath, opts)).suggestions[0].status, "applied");
});

test("an external edit before document promotion is never overwritten", async (t) => {
  const { targetPath, suggestion, opts } = await transactionFixture(t);
  const externalText = "# Spec\n\nExternal change during apply.\n";
  const realRename = fs.rename;
  let injected = false;
  fs.rename = async (from, to) => {
    await realRename(from, to);
    if (!injected && path.basename(String(to)) === "suggestion-transaction.json") {
      injected = true;
      await fs.writeFile(targetPath, externalText, "utf8");
    }
  };
  try {
    await assert.rejects(
      () => applyFileSessionSuggestion(targetPath, suggestion.id, { by: "tester" }, opts),
      (error) => error.code === "drift",
    );
  } finally {
    fs.rename = realRename;
  }
  assert.ok(injected);
  assert.equal(await fs.readFile(targetPath, "utf8"), externalText);
  await assert.rejects(() => getFileSessionContext(targetPath, opts), (error) => error.code === "recovery_conflict");
});

test("a queued mutation recovers a failed apply without locking itself", async (t) => {
  const { targetPath, suggestion, opts, minimapHome } = await transactionFixture(t);
  const sessionId = (await getFileSessionContext(targetPath, opts)).session.id;
  const lockPath = path.join(minimapHome, "sessions", sessionId, "session-mutation.lock");
  const realRename = fs.rename;
  const realWriteFile = fs.writeFile;
  let releaseJournal;
  const journalGate = new Promise((resolve) => { releaseJournal = resolve; });
  let signalJournal;
  const journalReached = new Promise((resolve) => { signalJournal = resolve; });
  let signalWaiter;
  const waiterReached = new Promise((resolve) => { signalWaiter = resolve; });
  let paused = false;
  let failed = false;
  fs.rename = async (from, to) => {
    if (!paused && path.basename(String(to)) === "suggestion-transaction.json") {
      paused = true;
      signalJournal();
      await journalGate;
    }
    if (!failed && path.basename(String(to)) === "session.json" && String(from).includes(".tmp-")) {
      failed = true;
      throw new Error("simulated metadata rename failure");
    }
    return realRename(from, to);
  };
  fs.writeFile = async (filePath, content, options) => {
    if (paused && filePath === lockPath && options?.flag === "wx") signalWaiter();
    return realWriteFile(filePath, content, options);
  };
  try {
    const applying = assert.rejects(
      applyFileSessionSuggestion(targetPath, suggestion.id, { by: "tester" }, opts),
      /simulated metadata rename failure/,
    );
    await journalReached;
    const editing = addFileSessionComment(targetPath, {
      by: "tester", kind: "confirmation", scope: "global", text: "Reviewed.",
    }, opts);
    await waiterReached;
    releaseJournal();
    await applying;
    const { comment } = await editing;
    assert.ok(comment.id);
  } finally {
    releaseJournal();
    fs.rename = realRename;
    fs.writeFile = realWriteFile;
  }
  assert.equal((await getFileSessionContext(targetPath, opts)).suggestions[0].status, "applied");
});

test("attach and move recover pending metadata; remove refuses an unresolved conflict", async (t) => {
  const { targetPath, suggestion, opts, minimapHome } = await transactionFixture(t);
  await failSessionPromotion(() => applyFileSessionSuggestion(targetPath, suggestion.id, { by: "tester" }, opts));
  await attachFileSession(targetPath, opts);
  assert.equal((await getFileSessionContext(targetPath, opts)).suggestions[0].status, "applied");

  const { suggestion: next } = await addFileSessionSuggestion(targetPath, {
    by: "tester", kind: "replace", quote: "Hello, world!", content: "Hello again.",
  }, opts);
  await failSessionPromotion(() => applyFileSessionSuggestion(targetPath, next.id, { by: "tester" }, opts));
  const movedPath = path.join(path.dirname(targetPath), "moved.md");
  await fs.copyFile(targetPath, movedPath);
  await moveFileSession(targetPath, movedPath, opts);
  assert.equal((await getFileSessionContext(movedPath, opts)).suggestions.find((s) => s.id === next.id).status, "applied");

  const { suggestion: last } = await addFileSessionSuggestion(movedPath, {
    by: "tester", kind: "replace", quote: "Hello again.", content: "Hello once more.",
  }, opts);
  await failSessionPromotion(() => applyFileSessionSuggestion(movedPath, last.id, { by: "tester" }, opts));
  await fs.writeFile(movedPath, "# Spec\n\nExternal edit.\n", "utf8");
  await assert.rejects(() => removeFileSession(movedPath, opts), (error) => error.code === "recovery_conflict");
  const index = JSON.parse(await fs.readFile(path.join(minimapHome, "session-index.json"), "utf8"));
  assert.equal(Object.keys(index.files).length, 1, "conflicted session remains attached");
});

test("apply keeps a symlink and the target file mode", async (t) => {
  const { targetPath, suggestion, opts } = await transactionFixture(t);
  const linkPath = path.join(path.dirname(targetPath), "linked.md");
  try { await fs.symlink(targetPath, linkPath, "file"); }
  catch (error) {
    if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) return t.skip("symlinks unavailable");
    throw error;
  }
  await moveFileSession(targetPath, linkPath, opts);
  await fs.chmod(targetPath, 0o640);
  const beforeMode = (await fs.stat(targetPath)).mode & 0o777;
  await applyFileSessionSuggestion(linkPath, suggestion.id, { by: "tester" }, opts);
  assert.equal((await fs.stat(targetPath)).mode & 0o777, beforeMode);
  assert.equal((await fs.lstat(linkPath)).isSymbolicLink(), true);
  assert.match(await fs.readFile(linkPath, "utf8"), /Hello, world!/);
});

test("an incomplete recovery journal is retained and reported as a conflict", async (t) => {
  const { targetPath, suggestion, opts, minimapHome } = await transactionFixture(t);
  const sessionId = (await getFileSessionContext(targetPath, opts)).session.id;
  await failSessionPromotion(() => applyFileSessionSuggestion(targetPath, suggestion.id, { by: "tester" }, opts));
  const journalPath = path.join(minimapHome, "sessions", sessionId, "suggestion-transaction.json");
  const journal = JSON.parse(await fs.readFile(journalPath, "utf8"));
  journal.writes = [];
  await fs.writeFile(journalPath, JSON.stringify(journal), "utf8");
  await assert.rejects(() => getFileSessionContext(targetPath, opts), (error) => error.code === "recovery_conflict");
  assert.ok(await fs.readFile(journalPath, "utf8"), "journal remains for inspection");
});
