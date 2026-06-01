import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  deriveAvailableLenses,
  initializeWorkspace,
  loadWorkspace,
  parseBoardText,
  parseItemText,
  readItemById,
  saveBoardByGroups,
  saveItemById,
  saveScopeText,
  serializeBoard,
  serializeItem,
} from "../package/minimap/src/roadmap.js";
import {
  addFileSessionComment,
  addFileSessionCommentReply,
  addFileSessionSuggestion,
  applyFileSessionSuggestion,
  attachFileSession,
  createTextAnchor,
  getFileSessionContext,
  getFileSessionFileContent,
  listFileSessions,
  moveFileSession,
  parseMarkdownOutline,
  previewFileSessionSuggestion,
  resolveTextAnchor,
  resolveMinimapHome,
  updateFileSessionCommentStatus,
  updateFileSessionSuggestionStatus,
  removeFileSession,
} from "../package/minimap/src/sessions.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const sampleItemText = `---
id: feature-a
title: Test item
status: queued
priority: high
commitment: committed
labels:
  - ui
---

## Summary

Initial summary.

## Why

Initial why.

## In Scope

Initial in scope.

## Out of Scope

Initial out of scope.

## Done When

Initial done when.

## Notes

Initial notes.

## Extra

Keep this section untouched.
`;


const sampleRepoSpecificItemText = `---
id: feature-b
title: Repo specific item
status: queued
priority: high
commitment: committed
milestone: P2
---

## Goal

Ship the repo-specific shape without forcing canonical headings.

## Non-goals

- no hidden UI state

## Acceptance criteria

1. The item still loads in minimap.
2. Saving metadata does not inject empty canonical headings.

## Implementation Notes

- Keep the original section order.
`;

async function makeTempRepo() {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "roadmap-ui-"));
  await fs.mkdir(path.join(repoRoot, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(repoRoot, "roadmap", "ideas"), { recursive: true });
  await fs.writeFile(
    path.join(repoRoot, "roadmap", "board.md"),
    "# Now\n- feature-a\n\n# Ideas\n- idea-a\n",
    "utf8",
  );
  await fs.writeFile(path.join(repoRoot, "roadmap", "scope.md"), "Current focus.\n", "utf8");
  await fs.writeFile(path.join(repoRoot, "roadmap", "features", "feature-a.md"), sampleItemText, "utf8");
  await fs.writeFile(
    path.join(repoRoot, "roadmap", "ideas", "idea-a.md"),
    sampleItemText
      .replaceAll("feature-a", "idea-a")
      .replace("title: Test item", "title: Idea item")
      .replace("commitment: committed", "commitment: uncommitted"),
    "utf8",
  );
  return repoRoot;
}

async function makeEmptyRepo() {
  return fs.mkdtemp(path.join(os.tmpdir(), "roadmap-ui-empty-"));
}

async function runCli(args, options = {}) {
  const child = spawn(process.execPath, [path.join(projectRoot, "package", "minimap", "cli.js"), ...args], {
    cwd: options.cwd || projectRoot,
    env: { ...process.env, ...(options.env || {}) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const exitCode = await new Promise((resolve) => {
    child.on("exit", resolve);
  });

  return { exitCode, stdout, stderr };
}


test("parseBoardText reads groups and item order", () => {
  const groups = parseBoardText("# Now\n- feature-a\n- feature-b\n\n# Next\n- feature-c\n");
  assert.deepEqual(groups, [
    { name: "Now", itemIds: ["feature-a", "feature-b"] },
    { name: "Next", itemIds: ["feature-c"] },
  ]);
});

test("serializeBoard writes canonical markdown", () => {
  const board = serializeBoard([
    { name: "Done", itemIds: ["a", "b"] },
    { name: "Next", itemIds: ["c"] },
  ]);

  assert.equal(board, "# Done\n- a\n- b\n\n# Next\n- c\n");
});

test("serializeItem preserves unknown frontmatter and unknown sections while allowing optional milestone", () => {
  const parsed = parseItemText(sampleItemText);
  const serialized = serializeItem(parsed, {
    metadata: { title: "Updated title", status: "done", milestone: "P2" },
    sections: { Summary: "Updated summary.", Extra: "Updated extra." },
  });

  assert.match(serialized, /labels:\n  - ui/);
  assert.match(serialized, /milestone: P2/);
  assert.match(serialized, /## Extra[\s\S]*Updated extra\./);
  assert.match(serialized, /title: "Updated title"/);
  assert.match(serialized, /status: done/);
  assert.match(serialized, /## Summary[\s\S]*Updated summary\./);
});

test("loadWorkspace uses roadmap.config.json override", async () => {
  const repoRoot = await makeTempRepo();
  await fs.mkdir(path.join(repoRoot, "docs", "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(repoRoot, "docs", "roadmap", "ideas"), { recursive: true });
  await fs.copyFile(path.join(repoRoot, "roadmap", "board.md"), path.join(repoRoot, "docs", "roadmap", "board.md"));
  await fs.copyFile(path.join(repoRoot, "roadmap", "scope.md"), path.join(repoRoot, "docs", "roadmap", "scope.md"));
  await fs.copyFile(
    path.join(repoRoot, "roadmap", "features", "feature-a.md"),
    path.join(repoRoot, "docs", "roadmap", "features", "feature-a.md"),
  );
  await fs.copyFile(
    path.join(repoRoot, "roadmap", "ideas", "idea-a.md"),
    path.join(repoRoot, "docs", "roadmap", "ideas", "idea-a.md"),
  );
  await fs.writeFile(path.join(repoRoot, "roadmap.config.json"), JSON.stringify({ roadmapPath: "docs/roadmap" }), "utf8");

  const workspace = await loadWorkspace(repoRoot);
  assert.equal(workspace.roadmapPath, "docs/roadmap");
  assert.equal(workspace.boardGroups[0].items[0].id, "feature-a");
  assert.equal(workspace.repoName, path.basename(repoRoot));
});

test("loadWorkspace returns actionable setup details when roadmap path is missing", async () => {
  const repoRoot = await makeEmptyRepo();

  await assert.rejects(
    () => loadWorkspace(repoRoot),
    (error) => {
      assert.equal(error.code, "setup_error");
      assert.equal(error.details.roadmapPath, "roadmap");
      assert.equal(error.details.canInitialize, true);
      assert.deepEqual(error.details.expectedEntries, [
        "roadmap/board.md",
        "roadmap/scope.md",
        "roadmap/features/",
        "roadmap/ideas/",
      ]);
      return true;
    },
  );
});

test("initializeWorkspace creates the starter roadmap workspace", async () => {
  const repoRoot = await makeEmptyRepo();

  const workspace = await initializeWorkspace(repoRoot);

  assert.equal(workspace.roadmapPath, "roadmap");
  assert.equal(workspace.boardGroups.length, 3);
  assert.equal(workspace.boardGroups[0].name, "Now");
  assert.equal(workspace.scopeText.trim().length > 0, true);
  assert.equal((await fs.readFile(path.join(repoRoot, "roadmap", "board.md"), "utf8")).replace(/\r\n/g, "\n"), "# Now\n\n# Next\n\n# Ideas\n");
});

test("initializeWorkspace respects roadmap.config.json overrides", async () => {
  const repoRoot = await makeEmptyRepo();
  await fs.writeFile(path.join(repoRoot, "roadmap.config.json"), JSON.stringify({ roadmapPath: "docs/roadmap" }), "utf8");

  const workspace = await initializeWorkspace(repoRoot);

  assert.equal(workspace.roadmapPath, "docs/roadmap");
  assert.equal(await fs.readFile(path.join(repoRoot, "docs", "roadmap", "scope.md"), "utf8").then((text) => text.includes("current-focus narrative")), true);
});
test("saveBoardByGroups persists group order", async () => {
  const repoRoot = await makeTempRepo();
  const workspace = await saveBoardByGroups(repoRoot, [
    { name: "Ideas", itemIds: ["idea-a"] },
    { name: "Now", itemIds: ["feature-a"] },
  ]);

  assert.equal(workspace.boardGroups[0].name, "Ideas");
  const boardText = await fs.readFile(path.join(repoRoot, "roadmap", "board.md"), "utf8");
  assert.equal(boardText, "# Ideas\n- idea-a\n\n# Now\n- feature-a\n");
});

test("saveScopeText persists markdown content", async () => {
  const repoRoot = await makeTempRepo();
  const workspace = await saveScopeText(repoRoot, "# Current focus\n\n- keep planning in the repo");

  assert.match(workspace.scopeText, /# Current focus/);
  const scopeText = await fs.readFile(path.join(repoRoot, "roadmap", "scope.md"), "utf8");
  assert.equal(scopeText, "# Current focus\n\n- keep planning in the repo\n");
});

test("readItemById returns extra sections separately", async () => {
  const repoRoot = await makeTempRepo();
  const item = await readItemById(repoRoot, "feature-a");

  assert.equal(item.extraSections.Extra, "Keep this section untouched.");
  assert.deepEqual(item.extraSectionOrder, ["Extra"]);
  assert.equal(item.metadata.milestone, "");
});

test("saveItemById updates structured fields, optional milestone, and extra sections", async () => {
  const repoRoot = await makeTempRepo();
  await saveItemById(repoRoot, "feature-a", {
    metadata: {
      title: "Updated feature",
      status: "in-progress",
      priority: "medium",
      commitment: "committed",
      milestone: "P2",
    },
    sections: {
      Summary: "New summary",
      Notes: "New notes",
      Extra: "Updated extra details",
    },
  });

  const saved = await readItemById(repoRoot, "feature-a");
  assert.equal(saved.metadata.title, "Updated feature");
  assert.equal(saved.metadata.status, "in-progress");
  assert.equal(saved.metadata.milestone, "P2");
  assert.equal(saved.sections.Summary, "New summary");
  assert.equal(saved.sections.Notes, "New notes");
  assert.equal(saved.extraSections.Extra, "Updated extra details");

  const rawText = await fs.readFile(path.join(repoRoot, "roadmap", "features", "feature-a.md"), "utf8");
  assert.match(rawText, /labels:\n  - ui/);
  assert.match(rawText, /milestone: P2/);
  assert.match(rawText, /## Extra[\s\S]*Updated extra details/);
});

test("saveItemById accepts validated raw markdown edits", async () => {
  const repoRoot = await makeTempRepo();
  const original = await readItemById(repoRoot, "feature-a");
  const updatedRaw = original.rawText
    .replace("title: Test item", 'title: "Raw updated title"')
    .replace("## Extra\n\nKeep this section untouched.", "## Extra\n\nEdited in raw mode.");

  const saved = await saveItemById(repoRoot, "feature-a", { rawText: updatedRaw });
  assert.equal(saved.metadata.title, "Raw updated title");
  assert.equal(saved.extraSections.Extra, "Edited in raw mode.");
});

test("saveItemById rejects raw markdown that changes the item id", async () => {
  const repoRoot = await makeTempRepo();
  const original = await readItemById(repoRoot, "feature-a");
  const invalidRaw = original.rawText.replace("id: feature-a", "id: feature-b");

  await assert.rejects(
    () => saveItemById(repoRoot, "feature-a", { rawText: invalidRaw }),
    (error) => error.code === "bad_request",
  );
});



test("loadWorkspace accepts UTF-8 BOM-prefixed roadmap files", async () => {
  const repoRoot = await makeTempRepo();
  await fs.writeFile(path.join(repoRoot, "roadmap", "features", "feature-a.md"), `﻿${sampleItemText}`, "utf8");

  const workspace = await loadWorkspace(repoRoot);
  assert.equal(workspace.boardGroups[0].items[0].id, "feature-a");
  assert.equal(workspace.items["feature-a"].title, "Test item");

  const item = await readItemById(repoRoot, "feature-a");
  assert.equal(item.rawText.startsWith("---"), true);
});

test("loadWorkspace surfaces malformed items as parse errors", async () => {
  const repoRoot = await makeTempRepo();
  await fs.writeFile(path.join(repoRoot, "roadmap", "features", "feature-a.md"), "broken", "utf8");

  await assert.rejects(
    () => loadWorkspace(repoRoot),
    (error) => error.code === "parse_error",
  );
});


test("loadWorkspace accepts repo-specific section headings", async () => {
  const repoRoot = await makeTempRepo();
  await fs.writeFile(path.join(repoRoot, "roadmap", "features", "feature-a.md"), sampleRepoSpecificItemText.replace("feature-b", "feature-a"), "utf8");

  const workspace = await loadWorkspace(repoRoot);
  assert.equal(workspace.boardGroups[0].items[0].id, "feature-a");

  const item = await readItemById(repoRoot, "feature-a");
  assert.deepEqual(item.sectionOrder, ["Goal", "Non-goals", "Acceptance criteria", "Implementation Notes"]);
  assert.equal(item.sections.Summary, "");
  assert.equal(item.extraSections.Goal, "Ship the repo-specific shape without forcing canonical headings.");
});

test("saveItemById preserves repo-specific section shapes without injecting empty canonical sections", async () => {
  const repoRoot = await makeTempRepo();
  await fs.writeFile(path.join(repoRoot, "roadmap", "features", "feature-a.md"), sampleRepoSpecificItemText.replace("feature-b", "feature-a"), "utf8");

  await saveItemById(repoRoot, "feature-a", {
    metadata: {
      title: "Updated repo specific item",
      status: "in-progress",
      priority: "high",
      commitment: "committed",
      milestone: "P3",
    },
    sections: {
      Summary: "",
      Notes: "",
    },
  });

  const rawText = await fs.readFile(path.join(repoRoot, "roadmap", "features", "feature-a.md"), "utf8");
  assert.doesNotMatch(rawText, /## Summary/);
  assert.doesNotMatch(rawText, /## Why/);
  assert.match(rawText, /title: "Updated repo specific item"/);
  assert.match(rawText, /status: in-progress/);
  assert.match(rawText, /milestone: P3/);
  assert.match(rawText, /## Goal/);
  assert.match(rawText, /## Acceptance criteria/);
});

test("server endpoints return workspace and allow board, scope, structured, and raw saves", async () => {
  const repoRoot = await makeTempRepo();
  const child = spawn(process.execPath, [path.join(projectRoot, "package", "minimap", "server.js")], {
    cwd: repoRoot,
    env: { ...process.env, PORT: "4412" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server did not start.")), 5000);
    const onData = (chunk) => {
      if (String(chunk).includes("http://localhost:4412")) {
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        child.stderr.off("data", onErrorData);
        child.off("exit", onExit);
        resolve();
      }
    };
    const onErrorData = (chunk) => {
      clearTimeout(timeout);
      reject(new Error(String(chunk)));
    };
    const onExit = (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited early with code ${code}.`));
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onErrorData);
    child.on("exit", onExit);
  });

  try {
    const workspaceResponse = await fetch("http://localhost:4412/api/workspace");
    assert.equal(workspaceResponse.status, 200);
    const workspace = await workspaceResponse.json();
    assert.equal(workspace.boardGroups[0].items[0].id, "feature-a");
    assert.equal(workspace.repoName, path.basename(repoRoot));

    const boardResponse = await fetch("http://localhost:4412/api/board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groups: [
          { name: "Ideas", itemIds: ["idea-a"] },
          { name: "Now", itemIds: ["feature-a"] },
        ],
      }),
    });

    assert.equal(boardResponse.status, 200);
    const boardPayload = await boardResponse.json();
    assert.equal(boardPayload.boardGroups[0].name, "Ideas");

    const scopeResponse = await fetch("http://localhost:4412/api/scope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopeText: "# Current focus\n\n- use the UI for scope edits" }),
    });

    assert.equal(scopeResponse.status, 200);
    const scopePayload = await scopeResponse.json();
    assert.match(scopePayload.scopeText, /# Current focus/);

    const saveResponse = await fetch("http://localhost:4412/api/items/feature-a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metadata: {
          title: "API updated",
          status: "done",
          priority: "low",
          commitment: "committed",
          milestone: "P3",
        },
        sections: {
          Summary: "Updated through the API.",
          Extra: "Updated extra through the API.",
        },
      }),
    });

    assert.equal(saveResponse.status, 200);
    const item = await saveResponse.json();
    assert.equal(item.metadata.title, "API updated");
    assert.equal(item.metadata.milestone, "P3");
    assert.equal(item.sections.Summary, "Updated through the API.");
    assert.equal(item.extraSections.Extra, "Updated extra through the API.");

    const rawSaveResponse = await fetch("http://localhost:4412/api/items/feature-a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawText: item.rawText.replace('title: "API updated"', 'title: "API raw edit"'),
      }),
    });

    assert.equal(rawSaveResponse.status, 200);
    const rawItem = await rawSaveResponse.json();
    assert.equal(rawItem.metadata.title, "API raw edit");
  } finally {
    child.kill();
  }
});

test("server exposes global spec-session attach, list, and context APIs", async () => {
  const repoRoot = await makeEmptyRepo();
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-api-home-"));
  const specPath = path.join(repoRoot, "feature-spec.md");
  const originalText = "# Feature Spec\n\nServer API spec.\n";
  await fs.writeFile(specPath, originalText, "utf8");

  const child = spawn(process.execPath, [path.join(projectRoot, "package", "minimap", "server.js")], {
    cwd: repoRoot,
    env: { ...process.env, PORT: "4612", MINIMAP_HOME: minimapHome },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server did not start.")), 5000);
    const onData = (chunk) => {
      if (String(chunk).includes("http://localhost:4612")) {
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        child.stderr.off("data", onErrorData);
        child.off("exit", onExit);
        resolve();
      }
    };
    const onErrorData = (chunk) => {
      clearTimeout(timeout);
      reject(new Error(String(chunk)));
    };
    const onExit = (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited early with code ${code}.`));
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onErrorData);
    child.on("exit", onExit);
  });

  try {
    const attachResponse = await fetch("http://localhost:4612/api/spec-sessions/attach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: "feature-spec.md" }),
    });
    assert.equal(attachResponse.status, 200);
    const attachPayload = await attachResponse.json();
    assert.equal(attachPayload.created, true);
    assert.equal(attachPayload.session.targetFile, specPath.replaceAll("\\", "/"));
    assert.equal(attachPayload.session.markdown, true);

    const contextUrl = new URL("http://localhost:4612/api/spec-sessions/by-file/context");
    contextUrl.searchParams.set("path", "feature-spec.md");
    const contextResponse = await fetch(contextUrl);
    assert.equal(contextResponse.status, 200);
    const contextPayload = await contextResponse.json();
    assert.equal(contextPayload.session.id, attachPayload.session.id);
    assert.equal(Object.hasOwn(contextPayload, "content"), false);
    assert.deepEqual(contextPayload.outline, [
      { level: 1, title: "Feature Spec", headingPath: ["Feature Spec"], lineStart: 1 },
    ]);
    assert.deepEqual(contextPayload.comments, []);
    assert.deepEqual(contextPayload.suggestions, []);

    const listResponse = await fetch("http://localhost:4612/api/spec-sessions");
    assert.equal(listResponse.status, 200);
    const listPayload = await listResponse.json();
    assert.equal(listPayload.sessions.length, 1);
    assert.equal(listPayload.sessions[0].id, attachPayload.session.id);

    const movedPath = path.join(repoRoot, "renamed-spec.md");
    await fs.writeFile(movedPath, "# Renamed Spec\n", "utf8");
    const moveResponse = await fetch("http://localhost:4612/api/spec-sessions/by-file/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: "feature-spec.md", to: "renamed-spec.md" }),
    });
    assert.equal(moveResponse.status, 200);
    const movePayload = await moveResponse.json();
    assert.equal(movePayload.session.id, attachPayload.session.id);
    assert.equal(movePayload.session.targetFile, movedPath.replaceAll("\\", "/"));

    const commentResponse = await fetch("http://localhost:4612/api/spec-sessions/by-file/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: "renamed-spec.md",
        by: "ai:codex",
        kind: "concern",
        text: "The renamed spec needs a goal.",
        scope: "global",
      }),
    });
    assert.equal(commentResponse.status, 200);
    const commentPayload = await commentResponse.json();
    assert.equal(commentPayload.comment.id, "cmt_000001");

    const movedContextUrl = new URL("http://localhost:4612/api/spec-sessions/by-file/context");
    movedContextUrl.searchParams.set("path", "renamed-spec.md");
    const movedContextResponse = await fetch(movedContextUrl);
    assert.equal(movedContextResponse.status, 200);
    const movedContextPayload = await movedContextResponse.json();
    assert.equal(movedContextPayload.comments.length, 1);
    assert.equal(movedContextPayload.comments[0].text, "The renamed spec needs a goal.");

    const contentUrl = new URL("http://localhost:4612/api/spec-sessions/by-file/content");
    contentUrl.searchParams.set("path", "renamed-spec.md");
    const contentResponse = await fetch(contentUrl);
    assert.equal(contentResponse.status, 200);
    const contentPayload = await contentResponse.json();
    assert.equal(contentPayload.content, "# Renamed Spec\n");
    assert.equal(contentPayload.session.id, attachPayload.session.id);

    const replyResponse = await fetch("http://localhost:4612/api/spec-sessions/by-file/comments/cmt_000001/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: "renamed-spec.md",
        by: "human:local",
        text: "Use the first paragraph as the goal.",
      }),
    });
    assert.equal(replyResponse.status, 200);
    const replyPayload = await replyResponse.json();
    assert.equal(replyPayload.comment.replies[0].id, "rpl_000001");

    const resolveResponse = await fetch("http://localhost:4612/api/spec-sessions/by-file/comments/cmt_000001/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: "renamed-spec.md",
        by: "human:local",
      }),
    });
    assert.equal(resolveResponse.status, 200);
    const resolvePayload = await resolveResponse.json();
    assert.equal(resolvePayload.comment.status, "resolved");

    const suggestionResponse = await fetch("http://localhost:4612/api/spec-sessions/by-file/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: "renamed-spec.md",
        by: "ai:codex",
        kind: "replace",
        quote: "Renamed Spec",
        content: "Specific Spec",
      }),
    });
    assert.equal(suggestionResponse.status, 200);

    const rejectResponse = await fetch("http://localhost:4612/api/spec-sessions/by-file/suggestions/sug_000001/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: "renamed-spec.md",
        by: "human:local",
      }),
    });
    assert.equal(rejectResponse.status, 200);
    assert.equal((await rejectResponse.json()).suggestion.status, "rejected");

    const reopenResponse = await fetch("http://localhost:4612/api/spec-sessions/by-file/suggestions/sug_000001/reopen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: "renamed-spec.md",
        by: "human:local",
      }),
    });
    assert.equal(reopenResponse.status, 200);
    assert.equal((await reopenResponse.json()).suggestion.status, "pending");

    await fs.rm(movedPath, { force: true });
    const missingContextUrl = new URL("http://localhost:4612/api/spec-sessions/by-file/context");
    missingContextUrl.searchParams.set("path", "renamed-spec.md");
    const missingContextResponse = await fetch(missingContextUrl);
    assert.equal(missingContextResponse.status, 404);
    assert.equal((await missingContextResponse.json()).error.code, "target_missing");

    const removeResponse = await fetch(missingContextUrl, {
      method: "DELETE",
    });
    assert.equal(removeResponse.status, 200);
    assert.equal((await removeResponse.json()).removed, true);

    assert.equal(await fs.readFile(specPath, "utf8"), originalText);
  } finally {
    child.kill();
  }
});

test("server falls forward to the next free port when requested port is busy", async () => {
  const repoRoot = await makeTempRepo();
  const blocker = http.createServer((_request, response) => {
    response.writeHead(200);
    response.end("blocked");
  });

  await new Promise((resolve) => blocker.listen(4510, resolve));

  const child = spawn(process.execPath, [path.join(projectRoot, "package", "minimap", "server.js")], {
    cwd: repoRoot,
    env: { ...process.env, PORT: "4510" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let startedLine = "";
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server did not start.")), 5000);
    const onData = (chunk) => {
      const text = String(chunk);
      if (text.includes("Minimap running at")) {
        startedLine = text.trim();
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        child.stderr.off("data", onErrorData);
        child.off("exit", onExit);
        resolve();
      }
    };
    const onErrorData = (chunk) => {
      clearTimeout(timeout);
      reject(new Error(String(chunk)));
    };
    const onExit = (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited early with code ${code}.`));
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onErrorData);
    child.on("exit", onExit);
  });

  try {
    assert.match(startedLine, /http:\/\/localhost:4511 \(requested 4510\)$/);
    const response = await fetch("http://localhost:4511/health");
    assert.equal(response.status, 200);
  } finally {
    child.kill();
    await new Promise((resolve) => blocker.close(resolve));
  }
});

test("portable minimap package includes app, skills, and starter templates", async () => {
  const requiredPaths = [
    ["package", "minimap", "package.json"],
    ["package", "minimap", "cli.js"],
    ["package", "minimap", "server.js"],
    ["package", "minimap", "src", "roadmap.js"],
    ["package", "minimap", "src", "sessions.js"],
    ["package", "minimap", "ui", "index.html"],
    ["package", "minimap", "ui", "app.js"],
    ["package", "minimap", "ui", "styles.css"],
    ["package", "minimap", "SKILL.md"],
    ["package", "minimap", "skills", "minimap-roadmap", "SKILL.md"],
    ["package", "minimap", "skills", "minimap-roadmap", "references", "roadmap-contract.md"],
    ["package", "minimap", "skills", "minimap-spec-review", "SKILL.md"],
    ["package", "minimap", "skills", "minimap-spec-review", "references", "server.md"],
    ["package", "minimap", "skills", "minimap-spec-review", "references", "cli.md"],
    ["package", "minimap", "skills", "minimap-spec-review", "references", "review-workflow.md"],
    ["package", "minimap", "skills", "minimap-spec-review", "scripts", "start-server.mjs"],
    ["package", "minimap", "skills", "minimap-spec-review", "scripts", "minimap.mjs"],
    ["package", "minimap", "skills", "minimap-spec-review", "runtime", "package.json"],
    ["package", "minimap", "skills", "minimap-spec-review", "runtime", "server.js"],
    ["package", "minimap", "skills", "minimap-spec-review", "runtime", "cli.js"],
    ["package", "minimap", "skills", "minimap-spec-review", "runtime", "src", "sessions.js"],
    ["package", "minimap", "skills", "minimap-spec-review", "runtime", "src", "roadmap.js"],
    ["package", "minimap", "skills", "minimap-spec-review", "runtime", "ui", "index.html"],
    ["package", "minimap", "skills", "minimap-spec-review", "runtime", "ui", "app.js"],
    ["package", "minimap", "skills", "minimap-spec-review", "runtime", "ui", "styles.css"],
    ["package", "minimap", "CONTRACT.md"],
    ["package", "minimap", "README.md"],
    ["package", "minimap", "AGENTS_SNIPPET.md"],
    ["package", "minimap", "templates", "roadmap", "board.md"],
    ["package", "minimap", "templates", "roadmap", "scope.md"],
    ["package", "minimap", "templates", "roadmap", "features", "example-feature.md"],
    ["package", "minimap", "templates", "roadmap", "ideas", "example-idea.md"],
    ["package", "minimap", "templates", "roadmap.config.json"],
  ];

  for (const segments of requiredPaths) {
    await fs.access(path.join(projectRoot, ...segments));
  }

  const packageJson = JSON.parse(
    await fs.readFile(path.join(projectRoot, "package", "minimap", "package.json"), "utf8"),
  );

  assert.equal(packageJson.type, "module");
  assert.equal(packageJson.bin.minimap, "./cli.js");
  assert.equal(packageJson.scripts.start, "node server.js");

  const bundledRuntimeFiles = [
    ["server.js"],
    ["cli.js"],
    ["src", "roadmap.js"],
    ["src", "sessions.js"],
    ["ui", "index.html"],
    ["ui", "app.js"],
    ["ui", "styles.css"],
  ];

  for (const segments of bundledRuntimeFiles) {
    const packageFile = await fs.readFile(path.join(projectRoot, "package", "minimap", ...segments), "utf8");
    const runtimeFile = await fs.readFile(path.join(projectRoot, "package", "minimap", "skills", "minimap-spec-review", "runtime", ...segments), "utf8");
    assert.equal(runtimeFile, packageFile, `Bundled spec-review runtime is stale: ${segments.join("/")}`);
  }
});

test("self-contained spec-review skill runs when copied outside the repo", async () => {
  const installRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-global-skill-"));
  const workRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-work-repo-"));
  const sourceSkill = path.join(projectRoot, "package", "minimap", "skills", "minimap-spec-review");
  const installedSkill = path.join(installRoot, "minimap-spec-review");
  const specPath = path.join(workRoot, "feature-spec.md");

  await fs.cp(sourceSkill, installedSkill, { recursive: true });
  await fs.writeFile(specPath, "# Feature Spec\n\nThis spec needs review from multiple agents.\n", "utf8");

  const env = { ...process.env, MINIMAP_HOME: path.join(workRoot, ".minimap-home") };
  const cliPath = path.join(installedSkill, "scripts", "minimap.mjs");
  const attach = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, "attach", "feature-spec.md", "--json"], {
      cwd: workRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(JSON.parse(stdout));
        return;
      }
      reject(new Error(`Bundled CLI attach failed with ${code}\n${stdout}\n${stderr}`));
    });
  });

  assert.equal(attach.targetFile, specPath.replaceAll("\\", "/"));

  const serverPort = "4722";
  const server = spawn(process.execPath, [path.join(installedSkill, "scripts", "start-server.mjs")], {
    cwd: workRoot,
    env: { ...env, PORT: serverPort },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await new Promise((resolve, reject) => {
      let output = "";
      const timeout = setTimeout(() => reject(new Error(`Bundled server did not start. Output: ${output}`)), 5000);
      server.stdout.on("data", (chunk) => {
        output += String(chunk);
        if (output.includes("Minimap running")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      server.stderr.on("data", (chunk) => {
        output += String(chunk);
      });
      server.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      server.on("exit", (code) => {
        if (code !== null && code !== 0) {
          clearTimeout(timeout);
          reject(new Error(`Bundled server exited early with ${code}. Output: ${output}`));
        }
      });
    });

    const health = await fetch(`http://localhost:${serverPort}/health`);
    assert.deepEqual(await health.json(), { ok: true });
  } finally {
    server.kill();
  }
});

test("resolveMinimapHome supports test override and platform defaults", () => {
  assert.equal(resolveMinimapHome({ MINIMAP_HOME: "C:\\tmp\\mini" }, "win32"), path.resolve("C:\\tmp\\mini"));
  assert.equal(resolveMinimapHome({ LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local" }, "win32"), path.join("C:\\Users\\me\\AppData\\Local", "minimap"));
  assert.equal(resolveMinimapHome({}, "linux"), path.join(os.homedir(), ".minimap"));
});

test("attachFileSession creates one global session per target file without modifying the file", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-spec-repo-"));
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const specPath = path.join(repoRoot, "my-new-feature.md");
  const originalText = "# My New Feature\n\nInitial spec.\n";
  await fs.writeFile(specPath, originalText, "utf8");

  const first = await attachFileSession("my-new-feature.md", { cwd: repoRoot, minimapHome });
  const second = await attachFileSession(specPath, { cwd: os.tmpdir(), minimapHome });

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.session.id, first.session.id);
  assert.equal(second.session.targetFile, specPath.replaceAll("\\", "/"));
  assert.equal(second.session.markdown, true);
  assert.equal(await fs.readFile(specPath, "utf8"), originalText);

  const index = JSON.parse(await fs.readFile(path.join(minimapHome, "session-index.json"), "utf8"));
  assert.equal(Object.values(index.files)[0], first.session.id);
  await fs.access(path.join(minimapHome, "sessions", first.session.id, "session.json"));
  await fs.access(path.join(minimapHome, "sessions", first.session.id, "comments.jsonl"));
  await fs.access(path.join(minimapHome, "sessions", first.session.id, "suggestions.jsonl"));
  await fs.access(path.join(minimapHome, "sessions", first.session.id, "events.jsonl"));
});

test("file session context returns collaboration state without target file content", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-spec-context-"));
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const specPath = path.join(repoRoot, "notes.txt");
  await fs.writeFile(specPath, "Plain text spec.\n", "utf8");
  const attached = await attachFileSession(specPath, { minimapHome });
  const beforeLastActiveAt = attached.session.lastActiveAt;

  const context = await getFileSessionContext(specPath, { minimapHome });
  const afterContextSession = await getFileSessionContext(specPath, { minimapHome });

  assert.equal(context.session.id, attached.session.id);
  assert.equal(context.session.fileKind, "text");
  assert.equal(context.session.markdown, false);
  assert.equal(context.session.targetFile, specPath.replaceAll("\\", "/"));
  assert.match(context.session.contentHash, /^sha256:/);
  assert.deepEqual(context.comments, []);
  assert.deepEqual(context.suggestions, []);
  assert.equal(Object.hasOwn(context, "content"), false);
  assert.equal(afterContextSession.session.lastActiveAt, beforeLastActiveAt);
});

test("file session content is explicit and separate from default context", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-spec-content-"));
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const specPath = path.join(repoRoot, "spec.md");
  await fs.writeFile(specPath, "# Spec\n\nReadable in the UI.\n", "utf8");
  const attached = await attachFileSession(specPath, { minimapHome });

  const payload = await getFileSessionFileContent(specPath, { minimapHome });

  assert.equal(payload.session.id, attached.session.id);
  assert.equal(payload.content, "# Spec\n\nReadable in the UI.\n");
  assert.deepEqual(payload.outline, [
    { level: 1, title: "Spec", headingPath: ["Spec"], lineStart: 1 },
  ]);
});

test("Markdown outline ignores fenced headings and preserves heading paths", () => {
  const markdown = [
    "# Memory Model",
    "",
    "Intro.",
    "",
    "## Visibility",
    "",
    "Visibility text.",
    "",
    "```",
    "# Not A Heading",
    "```",
    "",
    "### Private Scope",
    "Details.",
  ].join("\n");

  assert.deepEqual(parseMarkdownOutline(markdown), [
    { level: 1, title: "Memory Model", headingPath: ["Memory Model"], lineStart: 1 },
    { level: 2, title: "Visibility", headingPath: ["Memory Model", "Visibility"], lineStart: 5 },
    { level: 3, title: "Private Scope", headingPath: ["Memory Model", "Visibility", "Private Scope"], lineStart: 13 },
  ]);
});

test("text anchors resolve after nearby line drift and flag ambiguous quotes", () => {
  const original = [
    "# Memory Model",
    "",
    "## Visibility",
    "",
    "Memory visibility is local-only by default.",
    "",
    "## Lifecycle",
    "",
    "Other text.",
  ].join("\n");
  const anchor = createTextAnchor(original, {
    quote: "Memory visibility is local-only by default.",
  });

  assert.equal(anchor.scope, "anchor");
  assert.deepEqual(anchor.headingPath, ["Memory Model", "Visibility"]);
  assert.equal(anchor.lineStart, 5);

  const drifted = original.replace("## Visibility", "Intro line.\n\n## Visibility");
  const resolved = resolveTextAnchor(drifted, anchor);

  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.strategy, "heading_quote");
  assert.equal(resolved.lineStart, 7);

  const ambiguousText = original.replace(anchor.quote, "Changed text.") + `\n\n${anchor.quote}\n\n${anchor.quote}\n`;
  const ambiguous = resolveTextAnchor(ambiguousText, anchor);
  assert.equal(ambiguous.status, "ambiguous");
});

test("addFileSessionComment stores global, section, and anchored comments in context", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-comments-"));
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const specPath = path.join(repoRoot, "feature.md");
  await fs.writeFile(specPath, "# Feature\n\n## Risks\n\nThis needs a rollback plan.\n", "utf8");
  await attachFileSession(specPath, { minimapHome });

  const globalComment = await addFileSessionComment(specPath, {
    by: "human:local",
    kind: "instruction",
    text: "Focus this review on failure modes.",
    scope: "global",
  }, { minimapHome });
  const sectionComment = await addFileSessionComment(specPath, {
    by: "ai:codex",
    kind: "concern",
    text: "This section needs concrete mitigations.",
    scope: "section",
    headingPath: ["Feature", "Risks"],
  }, { minimapHome });
  const anchoredComment = await addFileSessionComment(specPath, {
    by: "ai:claude",
    kind: "question",
    text: "Who owns the rollback plan?",
    quote: "This needs a rollback plan.",
  }, { minimapHome });
  const context = await getFileSessionContext(specPath, { minimapHome });

  assert.equal(globalComment.comment.id, "cmt_000001");
  assert.equal(sectionComment.comment.id, "cmt_000002");
  assert.equal(anchoredComment.comment.id, "cmt_000003");
  assert.equal(context.comments.length, 3);
  assert.equal(context.comments[0].anchor.scope, "global");
  assert.deepEqual(context.comments[1].anchor.headingPath, ["Feature", "Risks"]);
  assert.equal(context.comments[1].anchorStatus.status, "resolved");
  assert.equal(context.comments[2].anchor.quote, "This needs a rollback plan.");
  assert.equal(context.comments[2].anchorStatus.status, "resolved");
  assert.equal(context.comments[2].status, "open");
  assert.deepEqual(context.comments[2].replies, []);
  assert.deepEqual(context.suggestions, []);
});

test("addFileSessionComment rejects missing actor, invalid kinds, and ambiguous anchors", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-comments-invalid-"));
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const specPath = path.join(repoRoot, "feature.md");
  await fs.writeFile(specPath, "# Feature\n\nRepeated.\n\nRepeated.\n", "utf8");
  await attachFileSession(specPath, { minimapHome });

  await assert.rejects(
    () => addFileSessionComment(specPath, {
      kind: "concern",
      text: "Missing actor.",
      scope: "global",
    }, { minimapHome }),
    (error) => error.code === "bad_request",
  );
  await assert.rejects(
    () => addFileSessionComment(specPath, {
      by: "ai:codex",
      kind: "nit",
      text: "Invalid kind.",
      scope: "global",
    }, { minimapHome }),
    (error) => error.code === "bad_request",
  );
  await assert.rejects(
    () => addFileSessionComment(specPath, {
      by: "ai:codex",
      kind: "concern",
      text: "Ambiguous.",
      quote: "Repeated.",
    }, { minimapHome }),
    (error) => error.code === "anchor_ambiguous",
  );
});

test("comment replies and status updates persist in context", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-comment-thread-"));
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const specPath = path.join(repoRoot, "feature.md");
  await fs.writeFile(specPath, "# Feature\n\nNeeds review.\n", "utf8");
  await attachFileSession(specPath, { minimapHome });
  const added = await addFileSessionComment(specPath, {
    by: "ai:codex",
    kind: "concern",
    text: "This needs a clearer success metric.",
    scope: "global",
  }, { minimapHome });

  const replied = await addFileSessionCommentReply(specPath, added.comment.id, {
    by: "human:local",
    text: "Use adoption rate as the success metric.",
  }, { minimapHome });
  const resolved = await updateFileSessionCommentStatus(specPath, added.comment.id, "resolved", {
    by: "human:local",
  }, { minimapHome });
  const context = await getFileSessionContext(specPath, { minimapHome });

  assert.equal(replied.comment.replies.length, 1);
  assert.equal(replied.comment.replies[0].id, "rpl_000001");
  assert.equal(replied.comment.replies[0].by, "human:local");
  assert.equal(resolved.comment.status, "resolved");
  assert.equal(resolved.comment.statusBy, "human:local");
  assert.equal(context.comments[0].status, "resolved");
  assert.equal(context.comments[0].replies[0].text, "Use adoption rate as the success metric.");

  const reopened = await updateFileSessionCommentStatus(specPath, added.comment.id, "open", {
    by: "human:local",
  }, { minimapHome });
  assert.equal(reopened.comment.status, "open");
});

test("missing target files return a domain error and sessions can be removed", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-missing-target-"));
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const specPath = path.join(repoRoot, "feature.md");
  await fs.writeFile(specPath, "# Feature\n\nNeeds review.\n", "utf8");
  await attachFileSession(specPath, { minimapHome });
  await fs.rm(specPath);

  await assert.rejects(
    () => getFileSessionContext(specPath, { minimapHome }),
    (error) => error.code === "target_missing" && error.statusCode === 404,
  );

  const removed = await removeFileSession(specPath, { minimapHome });
  const sessions = await listFileSessions({ minimapHome });
  assert.equal(removed.removed, true);
  assert.equal(sessions.length, 0);
});

test("file session suggestions persist in context without mutating the target file", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-suggestions-"));
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const specPath = path.join(repoRoot, "feature.md");
  const originalText = "# Feature\n\nReplace this sentence.\n\nInsert after this sentence.\n\nDelete this sentence.\n";
  await fs.writeFile(specPath, originalText, "utf8");
  await attachFileSession(specPath, { minimapHome });

  const replace = await addFileSessionSuggestion(specPath, {
    by: "ai:codex",
    kind: "replace",
    quote: "Replace this sentence.",
    content: "Use this replacement sentence.",
    rationale: "The replacement is clearer.",
  }, { minimapHome });
  const insert = await addFileSessionSuggestion(specPath, {
    by: "human:local",
    kind: "insert_after",
    quote: "Insert after this sentence.",
    content: "Inserted follow-up sentence.",
  }, { minimapHome });
  const deletion = await addFileSessionSuggestion(specPath, {
    by: "ai:claude",
    kind: "delete",
    quote: "Delete this sentence.",
  }, { minimapHome });
  const accepted = await updateFileSessionSuggestionStatus(specPath, replace.suggestion.id, "accepted", {
    by: "human:local",
  }, { minimapHome });
  const reopened = await updateFileSessionSuggestionStatus(specPath, replace.suggestion.id, "pending", {
    by: "human:local",
  }, { minimapHome });
  const context = await getFileSessionContext(specPath, { minimapHome });

  assert.equal(replace.suggestion.id, "sug_000001");
  assert.equal(insert.suggestion.id, "sug_000002");
  assert.equal(deletion.suggestion.id, "sug_000003");
  assert.equal(accepted.suggestion.status, "accepted");
  assert.equal(accepted.suggestion.statusBy, "human:local");
  assert.equal(reopened.suggestion.status, "pending");
  assert.equal(context.suggestions.length, 3);
  assert.equal(context.suggestions[0].kind, "replace");
  assert.equal(context.suggestions[0].anchorStatus.status, "resolved");
  assert.equal(context.suggestions[1].content, "Inserted follow-up sentence.");
  assert.equal(context.suggestions[2].kind, "delete");
  assert.equal(context.suggestions[2].content, "");
  assert.equal(await fs.readFile(specPath, "utf8"), originalText);
});

test("file session suggestions reject invalid input and global anchors", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-suggestions-invalid-"));
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const specPath = path.join(repoRoot, "feature.md");
  await fs.writeFile(specPath, "# Feature\n\nRepeated.\n\nRepeated.\n", "utf8");
  await attachFileSession(specPath, { minimapHome });

  await assert.rejects(
    () => addFileSessionSuggestion(specPath, {
      kind: "replace",
      quote: "Repeated.",
      content: "Replacement.",
    }, { minimapHome }),
    (error) => error.code === "bad_request",
  );
  await assert.rejects(
    () => addFileSessionSuggestion(specPath, {
      by: "ai:codex",
      kind: "rewrite",
      quote: "Repeated.",
      content: "Replacement.",
    }, { minimapHome }),
    (error) => error.code === "bad_request",
  );
  await assert.rejects(
    () => addFileSessionSuggestion(specPath, {
      by: "ai:codex",
      kind: "replace",
      scope: "global",
      content: "Replacement.",
    }, { minimapHome }),
    (error) => error.code === "bad_request",
  );
  await assert.rejects(
    () => addFileSessionSuggestion(specPath, {
      by: "ai:codex",
      kind: "replace",
      quote: "Repeated.",
      content: "Replacement.",
    }, { minimapHome }),
    (error) => error.code === "anchor_ambiguous",
  );
});

test("file session suggestion preview and apply mutate only after explicit apply", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-suggestion-apply-"));
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const specPath = path.join(repoRoot, "feature.md");
  const originalText = "# Feature\r\n\r\nOld line.\r\nKeep line.\r\n";
  await fs.writeFile(specPath, originalText, "utf8");
  await attachFileSession(specPath, { minimapHome });
  const added = await addFileSessionSuggestion(specPath, {
    by: "ai:codex",
    kind: "replace",
    quote: "Old line.",
    content: "New line.",
    rationale: "Use the current wording.",
  }, { minimapHome });

  const preview = await previewFileSessionSuggestion(specPath, added.suggestion.id, { minimapHome });
  assert.equal(preview.preview.kind, "replace");
  assert.equal(preview.preview.before, "Old line.");
  assert.equal(preview.preview.after, "New line.");
  assert.match(preview.preview.diff, /-Old line\./);
  assert.match(preview.preview.diff, /\+New line\./);
  assert.equal(await fs.readFile(specPath, "utf8"), originalText);

  const applied = await applyFileSessionSuggestion(specPath, added.suggestion.id, {
    by: "human:local",
  }, { minimapHome });
  assert.equal(applied.suggestion.status, "applied");
  assert.equal(applied.suggestion.statusBy, "human:local");
  assert.equal(await fs.readFile(specPath, "utf8"), "# Feature\r\n\r\nNew line.\r\nKeep line.\r\n");

  const context = await getFileSessionContext(specPath, { minimapHome });
  assert.equal(context.suggestions[0].status, "applied");
  // After apply, a `replace` suggestion's anchor is rewritten to point at
  // the new content so it doesn't show up as orphaned even though the
  // original quote is gone. Verify the re-anchor landed.
  assert.equal(context.suggestions[0].anchorStatus.status, "resolved");
  assert.equal(context.suggestions[0].anchor.quote, "New line.");
  assert.match(context.session.contentHash, /^sha256:/);

  await assert.rejects(
    () => applyFileSessionSuggestion(specPath, added.suggestion.id, {
      by: "human:local",
    }, { minimapHome }),
    (error) => error.code === "conflict",
  );

  const insert = await addFileSessionSuggestion(specPath, {
    by: "ai:codex",
    kind: "insert_after",
    quote: "Keep line.",
    content: "\nNext line.\nMore.",
  }, { minimapHome });
  await applyFileSessionSuggestion(specPath, insert.suggestion.id, {
    by: "human:local",
  }, { minimapHome });
  assert.equal(await fs.readFile(specPath, "utf8"), "# Feature\r\n\r\nNew line.\r\nKeep line.\r\nNext line.\r\nMore.\r\n");

  const eventsPath = path.join(minimapHome, "sessions", context.session.id, "events.jsonl");
  const events = (await fs.readFile(eventsPath, "utf8")).trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(events.filter((event) => event.type === "suggestion_applied").length, 2);
});

test("file session suggestion preview blocks stale anchors and unsupported section edits", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-suggestion-preview-invalid-"));
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const specPath = path.join(repoRoot, "feature.md");
  await fs.writeFile(specPath, "# Feature\n\nOld line.\n", "utf8");
  await attachFileSession(specPath, { minimapHome });
  const stale = await addFileSessionSuggestion(specPath, {
    by: "ai:codex",
    kind: "delete",
    quote: "Old line.",
  }, { minimapHome });
  await fs.writeFile(specPath, "# Feature\n\nChanged line.\n", "utf8");

  await assert.rejects(
    () => previewFileSessionSuggestion(specPath, stale.suggestion.id, { minimapHome }),
    (error) => error.code === "anchor_orphaned",
  );

  const section = await addFileSessionSuggestion(specPath, {
    by: "ai:codex",
    kind: "replace",
    scope: "section",
    headingPath: ["Feature"],
    content: "# Better Feature",
  }, { minimapHome });

  await assert.rejects(
    () => previewFileSessionSuggestion(specPath, section.suggestion.id, { minimapHome }),
    (error) => error.code === "unsupported_suggestion_anchor",
  );

  const rejected = await addFileSessionSuggestion(specPath, {
    by: "ai:codex",
    kind: "replace",
    quote: "Changed line.",
    content: "Better line.",
  }, { minimapHome });
  await updateFileSessionSuggestionStatus(specPath, rejected.suggestion.id, "rejected", {
    by: "human:local",
  }, { minimapHome });
  await assert.rejects(
    () => applyFileSessionSuggestion(specPath, rejected.suggestion.id, {
      by: "human:local",
    }, { minimapHome }),
    (error) => error.code === "conflict",
  );

  const context = await getFileSessionContext(specPath, { minimapHome });
  const eventsPath = path.join(minimapHome, "sessions", context.session.id, "events.jsonl");
  const events = (await fs.readFile(eventsPath, "utf8")).trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(events.some((event) => event.type === "suggestion_status_updated" && event.toStatus === "rejected"), true);
});

test("comment replies and status updates reject missing comments and missing actors", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-comment-thread-invalid-"));
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const specPath = path.join(repoRoot, "feature.md");
  await fs.writeFile(specPath, "# Feature\n\nNeeds review.\n", "utf8");
  await attachFileSession(specPath, { minimapHome });
  const added = await addFileSessionComment(specPath, {
    by: "ai:codex",
    kind: "question",
    text: "What is the metric?",
    scope: "global",
  }, { minimapHome });

  await assert.rejects(
    () => addFileSessionCommentReply(specPath, "cmt_missing", {
      by: "human:local",
      text: "No comment.",
    }, { minimapHome }),
    (error) => error.code === "not_found",
  );
  await assert.rejects(
    () => addFileSessionCommentReply(specPath, added.comment.id, {
      text: "Missing actor.",
    }, { minimapHome }),
    (error) => error.code === "bad_request",
  );
  await assert.rejects(
    () => updateFileSessionCommentStatus(specPath, added.comment.id, "closed", {
      by: "human:local",
    }, { minimapHome }),
    (error) => error.code === "bad_request",
  );
});

test("attachFileSession rejects missing files, directories, and binary files", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-spec-invalid-"));
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const binaryPath = path.join(repoRoot, "image.bin");
  await fs.writeFile(binaryPath, Buffer.from([0, 1, 2, 3, 4]));

  await assert.rejects(
    () => attachFileSession("missing.md", { cwd: repoRoot, minimapHome }),
    (error) => error.code === "not_found",
  );
  await assert.rejects(
    () => attachFileSession(repoRoot, { minimapHome }),
    (error) => error.code === "invalid_target",
  );
  await assert.rejects(
    () => attachFileSession(binaryPath, { minimapHome }),
    (error) => error.code === "invalid_target",
  );
});

test("file sessions list by last active time", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-spec-list-"));
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const firstPath = path.join(repoRoot, "a.md");
  const secondPath = path.join(repoRoot, "b.md");
  await fs.writeFile(firstPath, "# A\n", "utf8");
  await fs.writeFile(secondPath, "# B\n", "utf8");

  const first = await attachFileSession(firstPath, { minimapHome });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await attachFileSession(secondPath, { minimapHome });
  const sessions = await listFileSessions({ minimapHome });

  assert.equal(sessions[0].id, second.session.id);
  assert.equal(sessions[1].id, first.session.id);
});

test("moveFileSession retargets an existing session without moving files", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-spec-move-"));
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const oldPath = path.join(repoRoot, "old-name.md");
  const newPath = path.join(repoRoot, "new-name.md");
  await fs.writeFile(oldPath, "# Old\n", "utf8");
  await fs.writeFile(newPath, "# New\n", "utf8");
  const attached = await attachFileSession(oldPath, { minimapHome });

  const moved = await moveFileSession(oldPath, newPath, { minimapHome });
  const context = await getFileSessionContext(newPath, { minimapHome });

  assert.equal(moved.session.id, attached.session.id);
  assert.equal(moved.session.targetFile, newPath.replaceAll("\\", "/"));
  assert.equal(context.session.id, attached.session.id);
  assert.equal(await fs.readFile(oldPath, "utf8"), "# Old\n");
  assert.equal(await fs.readFile(newPath, "utf8"), "# New\n");
  await assert.rejects(
    () => getFileSessionContext(oldPath, { minimapHome }),
    (error) => error.code === "not_found",
  );
});

test("moveFileSession rejects conflicts with another attached file", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-spec-move-conflict-"));
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const firstPath = path.join(repoRoot, "first.md");
  const secondPath = path.join(repoRoot, "second.md");
  await fs.writeFile(firstPath, "# First\n", "utf8");
  await fs.writeFile(secondPath, "# Second\n", "utf8");
  await attachFileSession(firstPath, { minimapHome });
  await attachFileSession(secondPath, { minimapHome });

  await assert.rejects(
    () => moveFileSession(firstPath, secondPath, { minimapHome }),
    (error) => error.code === "conflict",
  );
});

test("minimap CLI attaches files and returns JSON context", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-cli-repo-"));
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-cli-home-"));
  await fs.writeFile(path.join(repoRoot, "feature.md"), "# Feature\n\nSpec body.\n", "utf8");

  const attach = await runCli(["attach", "feature.md", "--json"], {
    cwd: repoRoot,
    env: { MINIMAP_HOME: minimapHome },
  });
  assert.equal(attach.exitCode, 0);
  const attachPayload = JSON.parse(attach.stdout);
  assert.equal(attachPayload.created, true);
  assert.match(attachPayload.sessionId, /^feature-[a-f0-9]{8}$/);

  const context = await runCli(["context", "feature.md", "--json"], {
    cwd: repoRoot,
    env: { MINIMAP_HOME: minimapHome },
  });
  assert.equal(context.exitCode, 0);
  const contextPayload = JSON.parse(context.stdout);
  assert.equal(contextPayload.session.id, attachPayload.sessionId);
  assert.equal(contextPayload.session.markdown, true);
  assert.equal(Object.hasOwn(contextPayload, "content"), false);

  const list = await runCli(["session", "list", "--json"], {
    cwd: repoRoot,
    env: { MINIMAP_HOME: minimapHome },
  });
  assert.equal(list.exitCode, 0);
  assert.equal(JSON.parse(list.stdout).sessions.length, 1);

  await fs.writeFile(path.join(repoRoot, "renamed.md"), "# Renamed\n", "utf8");
  const move = await runCli(["session", "move", "feature.md", "renamed.md", "--json"], {
    cwd: repoRoot,
    env: { MINIMAP_HOME: minimapHome },
  });
  assert.equal(move.exitCode, 0);
  assert.equal(JSON.parse(move.stdout).session.id, attachPayload.sessionId);

  const comment = await runCli([
    "comment",
    "add",
    "renamed.md",
    "--by",
    "ai:codex",
    "--kind",
    "concern",
    "--quote",
    "Renamed",
    "--text",
    "This heading is too generic.",
    "--json",
  ], {
    cwd: repoRoot,
    env: { MINIMAP_HOME: minimapHome },
  });
  assert.equal(comment.exitCode, 0, comment.stderr);
  const commentPayload = JSON.parse(comment.stdout);
  assert.equal(commentPayload.comment.id, "cmt_000001");
  assert.equal(commentPayload.comment.anchor.scope, "anchor");

  const reply = await runCli([
    "comment",
    "reply",
    "renamed.md",
    "cmt_000001",
    "--by",
    "human:local",
    "--text",
    "Use a more specific heading.",
    "--json",
  ], {
    cwd: repoRoot,
    env: { MINIMAP_HOME: minimapHome },
  });
  assert.equal(reply.exitCode, 0, reply.stderr);
  assert.equal(JSON.parse(reply.stdout).comment.replies[0].id, "rpl_000001");

  const resolve = await runCli([
    "comment",
    "resolve",
    "renamed.md",
    "cmt_000001",
    "--by",
    "human:local",
    "--json",
  ], {
    cwd: repoRoot,
    env: { MINIMAP_HOME: minimapHome },
  });
  assert.equal(resolve.exitCode, 0, resolve.stderr);
  assert.equal(JSON.parse(resolve.stdout).comment.status, "resolved");

  const suggestion = await runCli([
    "suggest",
    "add",
    "renamed.md",
    "--by",
    "ai:codex",
    "--kind",
    "replace",
    "--quote",
    "Renamed",
    "--content",
    "Specific Feature",
    "--rationale",
    "The heading should identify the feature.",
    "--json",
  ], {
    cwd: repoRoot,
    env: { MINIMAP_HOME: minimapHome },
  });
  assert.equal(suggestion.exitCode, 0, suggestion.stderr);
  const suggestionPayload = JSON.parse(suggestion.stdout);
  assert.equal(suggestionPayload.suggestion.id, "sug_000001");
  assert.equal(suggestionPayload.suggestion.status, "pending");

  const accept = await runCli([
    "suggest",
    "accept",
    "renamed.md",
    "sug_000001",
    "--by",
    "human:local",
    "--json",
  ], {
    cwd: repoRoot,
    env: { MINIMAP_HOME: minimapHome },
  });
  assert.equal(accept.exitCode, 0, accept.stderr);
  assert.equal(JSON.parse(accept.stdout).suggestion.status, "accepted");

  const suggestionContext = await runCli(["context", "renamed.md", "--json"], {
    cwd: repoRoot,
    env: { MINIMAP_HOME: minimapHome },
  });
  assert.equal(suggestionContext.exitCode, 0, suggestionContext.stderr);
  const suggestionContextPayload = JSON.parse(suggestionContext.stdout);
  assert.equal(suggestionContextPayload.suggestions.length, 1);
  assert.equal(suggestionContextPayload.suggestions[0].content, "Specific Feature");
  assert.equal(await fs.readFile(path.join(repoRoot, "renamed.md"), "utf8"), "# Renamed\n");

  const preview = await runCli([
    "suggest",
    "preview",
    "renamed.md",
    "sug_000001",
    "--json",
  ], {
    cwd: repoRoot,
    env: { MINIMAP_HOME: minimapHome },
  });
  assert.equal(preview.exitCode, 0, preview.stderr);
  assert.match(JSON.parse(preview.stdout).preview.diff, /\+Specific Feature/);

  const apply = await runCli([
    "suggest",
    "apply",
    "renamed.md",
    "sug_000001",
    "--by",
    "human:local",
    "--json",
  ], {
    cwd: repoRoot,
    env: { MINIMAP_HOME: minimapHome },
  });
  assert.equal(apply.exitCode, 0, apply.stderr);
  assert.equal(JSON.parse(apply.stdout).suggestion.status, "applied");
  assert.equal(await fs.readFile(path.join(repoRoot, "renamed.md"), "utf8"), "# Specific Feature\n");
});


test("loadWorkspace exposes compact search text and generic metadata filters", async () => {
  const repoRoot = await makeTempRepo();
  const ideaPath = path.join(repoRoot, "roadmap", "ideas", "idea-a.md");
  const originalIdeaText = await fs.readFile(ideaPath, "utf8");
  await fs.writeFile(ideaPath, originalIdeaText.replace("labels:\n  - ui", "labels:\n  - docs"), "utf8");

  const workspace = await loadWorkspace(repoRoot);
  assert.deepEqual(workspace.items["feature-a"].metadata.labels, ["ui"]);
  assert.equal(workspace.items["feature-a"].metadata.kind, "feature");
  assert.match(workspace.items["feature-a"].searchText, /initial summary/);
  assert.match(workspace.items["feature-a"].searchText, /keep this section untouched/);
  assert.equal(workspace.items["feature-a"].overviewHeading, "Summary");
  assert.match(workspace.items["feature-a"].overviewExcerpt, /Initial summary/);
  assert.ok(workspace.boardGroups[0].items[0].overviewExcerpt.length > 0);
  assert.deepEqual(workspace.availableFilters.find((facet) => facet.key === "labels")?.values, ["docs", "ui"]);
});
test("deriveAvailableLenses ignores noisy keys and respects configured domains", () => {
  const lenses = deriveAvailableLenses({
    "feature-a": {
      metadata: {
        status: "queued",
        commitment: "committed",
        priority: "high",
        kind: "feature",
        team: "product",
        owner: "alex",
        labels: ["ui"],
      },
    },
    "idea-a": {
      metadata: {
        status: "done",
        commitment: "uncommitted",
        priority: "low",
        kind: "idea",
        team: "platform",
        owner: "alex",
        labels: ["docs"],
      },
    },
  }, {
    lenses: {
      fields: {
        status: { order: ["queued", "in-progress", "blocked", "done"] },
        team: { values: ["platform", "product", "docs"], draggable: true },
      },
    },
  });

  assert.deepEqual(lenses.map((lens) => lens.key), ["board", "status", "commitment", "priority", "kind", "team"]);
  assert.deepEqual(lenses.find((lens) => lens.key === "status")?.values, ["queued", "in-progress", "blocked", "done"]);
  assert.equal(lenses.find((lens) => lens.key === "team")?.draggable, true);
  assert.deepEqual(lenses.find((lens) => lens.key === "team")?.values, ["platform", "product", "docs"]);
  assert.equal(lenses.some((lens) => lens.key === "labels"), false);
  assert.equal(lenses.some((lens) => lens.key === "owner"), false);
});

test("loadWorkspace exposes derived lenses from metadata and roadmap config", async () => {
  const repoRoot = await makeTempRepo();
  const featureItemPath = path.join(repoRoot, "roadmap", "features", "feature-a.md");
  const ideaItemPath = path.join(repoRoot, "roadmap", "ideas", "idea-a.md");

  await fs.writeFile(path.join(repoRoot, "roadmap.config.json"), JSON.stringify({
    roadmapPath: "roadmap",
    lenses: {
      fields: {
        team: { values: ["platform", "product", "docs"], draggable: true },
        milestone: { values: ["P1", "P2", "P3"] },
      },
    },
  }), "utf8");
  await fs.writeFile(featureItemPath, sampleItemText.replace("milestone: P2", "milestone: P3").replace("labels:\n  - ui", "team: product\nlabels:\n  - ui"), "utf8");
  await fs.writeFile(ideaItemPath, sampleItemText
    .replaceAll("feature-a", "idea-a")
    .replace("title: Test item", "title: Idea item")
    .replace("commitment: committed", "commitment: uncommitted")
    .replace("milestone: P2", "milestone: P1")
    .replace("labels:\n  - ui", "team: platform\nlabels:\n  - docs"), "utf8");

  const workspace = await loadWorkspace(repoRoot);
  assert.equal(workspace.availableLenses.some((lens) => lens.key === "team"), true);
  assert.deepEqual(workspace.availableLenses.find((lens) => lens.key === "team")?.values, ["platform", "product", "docs"]);
  assert.equal(workspace.availableLenses.find((lens) => lens.key === "team")?.draggable, true);
  assert.deepEqual(workspace.availableLenses.find((lens) => lens.key === "milestone")?.values, ["P1", "P2", "P3"]);
  assert.equal(workspace.availableLenses.some((lens) => lens.key === "labels"), false);
});

test("saveItemById updates generic metadata and can move an item between feature and idea kinds", async () => {
  const repoRoot = await makeTempRepo();
  const featureFilePath = path.join(repoRoot, "roadmap", "features", "feature-a.md");
  const ideaFilePath = path.join(repoRoot, "roadmap", "ideas", "feature-a.md");

  await saveItemById(repoRoot, "feature-a", {
    metadata: {
      kind: "idea",
      team: "platform",
    },
  });

  const saved = await readItemById(repoRoot, "feature-a");
  assert.equal(saved.kind, "idea");
  assert.equal(await fs.readFile(ideaFilePath, "utf8").then((content) => content.includes("team: platform")), true);
  await assert.rejects(() => fs.access(featureFilePath));
});
