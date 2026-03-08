import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
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
      if (text.includes("Roadmap UI running at")) {
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

test("portable minimap package includes app, skill, and starter templates", async () => {
  const requiredPaths = [
    ["package", "minimap", "package.json"],
    ["package", "minimap", "server.js"],
    ["package", "minimap", "src", "roadmap.js"],
    ["package", "minimap", "ui", "index.html"],
    ["package", "minimap", "ui", "app.js"],
    ["package", "minimap", "ui", "styles.css"],
    ["package", "minimap", "SKILL.md"],
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
  assert.equal(packageJson.scripts.start, "node server.js");
});

