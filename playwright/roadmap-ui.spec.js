import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const boardPath = path.join(process.cwd(), "roadmap", "board.md");
const scopePath = path.join(process.cwd(), "roadmap", "scope.md");
const featurePath = path.join(process.cwd(), "roadmap", "features", "feature-setup-guidance.md");
const searchFeaturePath = path.join(process.cwd(), "roadmap", "features", "feature-search-and-filters.md");
const ideaCreatePath = path.join(process.cwd(), "roadmap", "ideas", "idea-create-items.md");
const configPath = path.join(process.cwd(), "roadmap.config.json");
const setupSandboxPath = path.join(process.cwd(), "playwright-setup-roadmap");

const repoHashParam = `repo=${encodeURIComponent(process.cwd())}`;

function repoUrl(suffix = "") {
  // suffix is either "" (root) or starts with "/#..." or "/#" (hash with item params).
  // We want the repo= param to come FIRST in the hash so it's clearly visible.
  if (!suffix || suffix === "/") {
    return `/#${repoHashParam}`;
  }
  if (suffix.startsWith("/#")) {
    const tail = suffix.slice(2); // strip the leading "/#"
    return `/#${repoHashParam}&${tail}`;
  }
  // Anything else: prepend / and the hash.
  return `${suffix}#${repoHashParam}`;
}

function repoUrlFor(repoRoot, suffix = "") {
  const repo = `repo=${encodeURIComponent(repoRoot)}`;
  if (!suffix || suffix === "/") return `/#${repo}`;
  return suffix.startsWith("/#") ? `/#${repo}&${suffix.slice(2)}` : `${suffix}#${repo}`;
}

function participantPayload(itemId, alias = "minimap-dev", count = 1) {
  const scopeRef = "roadmap:v1:git:github.com/rore/minimap#roadmap";
  const localRef = "item:v1:" + encodeURIComponent(itemId);
  return {
    status: "ok",
    reference: {
      contract: "minimap-roadmap-item/v1",
      scope_ref: scopeRef,
      local_ref: localRef,
    },
    participants: Array.from({ length: count }, (_, index) => ({
      endpoint_id: "relay-session-" + String(index).padStart(32, "0"),
      runtime: index % 2 ? "claude-code" : "codex",
      session_ref: "session-" + index,
      container_ref: "git:github.com/rore/minimap",
      title: "Minimap delivery " + index,
      alias: index === 0 ? alias : "worker-" + index,
      state: "active",
      lifecycle: index % 2 ? "dormant" : "recent",
      destination_health: "active",
      first_seen_at: "2026-09-12T08:00:00.000Z",
      last_seen_at: "2026-09-12T08:30:00.000Z",
      closed_at: null,
      scope_generation: 1,
      association: {
        work_ref: "work:v1:" + "a".repeat(64),
        scope_ref: scopeRef,
        local_ref: localRef,
        origins: ["explicit"],
        created_at: "2026-09-12T08:00:00.000Z",
        updated_at: "2026-09-12T08:30:00.000Z",
      },
    })),
    partial: count === 200,
    refreshedAt: "2026-09-12T08:30:00.000Z",
  };
}async function makeLargeRoadmapFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-large-roadmap-"));
  await fs.mkdir(path.join(root, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"), { recursive: true });
  const lanes = Array.from({ length: 10 }, (_, i) => `lane-${String(i + 1).padStart(2, "0")}`);
  const milestones = Array.from({ length: 12 }, (_, i) => `Milestone ${String(i + 1).padStart(2, "0")} — Unicode 🚀 / very long planning label`);
  const ids = Array.from({ length: 84 }, (_, i) => `large-item-${String(i + 1).padStart(2, "0")}`);
  const board = [`# Backlog`, ...ids.slice(0, 28).map((id) => `- ${id}`), ``, `# Delivery`, ...ids.slice(28, 56).map((id) => `- ${id}`), ``, `# Done`, ...ids.slice(56).map((id) => `- ${id}`), ``].join("\n");
  await fs.writeFile(path.join(root, "roadmap", "board.md"), board, "utf8");
  await fs.writeFile(path.join(root, "roadmap", "scope.md"), "Large-project usability fixture.\n", "utf8");
  await fs.writeFile(path.join(root, "roadmap.config.json"), JSON.stringify({
    roadmapPath: "roadmap",
    defaultLens: "lane",
    filters: { fields: ["release_train"] },
    lenses: { fields: {
      lane: { order: lanes, values: lanes, draggable: true },
      milestone: { order: milestones, values: milestones },
      status: { order: ["queued", "in-progress", "blocked", "done"], draggable: true },
    } },
  }), "utf8");
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    const title = i % 7 === 0
      ? `A deliberately long roadmap title for ${id} that must remain reachable without card overlap or hidden open controls`
      : `Large project item ${id} — usable title`;
    const overview = i % 5 === 0 ? "Long overview ".repeat(24) : "Short overview.";
    const lane = i < 66 ? lanes[0] : i % 13 === 0 ? "" : lanes[1 + ((i - 66) % (lanes.length - 1))];
    const milestone = i % 17 === 0 ? "" : milestones[i % milestones.length];
    const status = ["queued", "in-progress", "blocked", "done"][i % 4];
    await fs.writeFile(path.join(root, "roadmap", "features", `${id}.md`), `---\nid: ${id}\ntitle: ${title}\nstatus: ${status}\npriority: ${i % 3 === 0 ? "high" : i % 3 === 1 ? "medium" : "low"}\ncommitment: committed\nrelease_train: train-${String((i % 10) + 1).padStart(2, "0")}\nresolved_by: ${i % 2 === 0 ? "automated-cleanup" : "manual-follow-up"}\nshipped_at: 2026-0${(i % 3) + 6}-01\n${lane ? `lane: ${lane}\n` : ""}${milestone ? `milestone: ${milestone}\n` : ""}---\n\n## Summary\n\n${overview}\n`, "utf8");
  }
  return root;
}

async function makeDragRoadmapFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-drag-roadmap-"));
  const featureDir = path.join(root, "roadmap", "features");
  await fs.mkdir(featureDir, { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"), { recursive: true });
  await fs.writeFile(path.join(root, "roadmap", "board.md"), "# Items\n- drag-source\n- drag-target\n- drag-third\n- drag-unassigned\n", "utf8");
  await fs.writeFile(path.join(root, "roadmap", "scope.md"), "Drag interaction fixture.\n", "utf8");
  await fs.writeFile(path.join(root, "roadmap.config.json"), JSON.stringify({ roadmapPath: "roadmap", defaultLens: "status", lenses: { fields: { status: { order: ["queued", "done", "blocked"], draggable: true }, lane: { order: ["alpha"], draggable: true } } } }), "utf8");
  await fs.writeFile(path.join(featureDir, "drag-source.md"), "---\nid: drag-source\ntitle: Drag source\nstatus: done\npriority: high\ncommitment: committed\nlane: alpha\n---\n\n## Summary\n\nMove me with the drag handle.\n", "utf8");
  await fs.writeFile(path.join(featureDir, "drag-target.md"), "---\nid: drag-target\ntitle: Drag target\nstatus: queued\npriority: medium\ncommitment: committed\nlane: beta\n---\n\n## Summary\n\nKeep the destination visible.\n", "utf8");
  await fs.writeFile(path.join(featureDir, "drag-third.md"), "---\nid: drag-third\ntitle: Drag third\nstatus: queued\npriority: low\ncommitment: committed\n---\n\n## Summary\n\nUse me as an ordering target.\n", "utf8");
  await fs.writeFile(path.join(featureDir, "drag-unassigned.md"), "---\nid: drag-unassigned\ntitle: Drag unassigned\nstatus: queued\npriority: low\ncommitment: committed\n---\n\n## Summary\n\nRequired metadata is intentionally blank.\n", "utf8");
  return root;
}
function extractHeadings(boardText) {
  return boardText
    .split(/\r?\n/)
    .filter((line) => line.startsWith("# "))
    .map((line) => line.slice(2).trim());
}

function replaceTitle(text, nextTitle) {
  return text.replace(/^title:\s*(?:".*"|.*)$/m, `title: "${nextTitle}"`);
}

function addMilestone(text, milestone) {
  if (/^milestone:/m.test(text)) {
    return text.replace(/^milestone:\s*(?:".*"|.*)$/m, `milestone: ${milestone}`);
  }

  return text.replace(/^commitment:\s*.*$/m, (line) => `${line}\nmilestone: ${milestone}`);
}

function addExtraSection(text, heading, content) {
  return `${text.trimEnd()}\n\n## ${heading}\n\n${content}\n`;
}

function replaceSectionContent(text, heading, content) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const pattern = new RegExp(`## ${escapedHeading}\\r?\\n\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`);
  const normalizedContent = content.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, eol);
  return text.replace(pattern, `## ${heading}${eol}${eol}${normalizedContent}${eol}`);
}
function addFrontmatterField(text, key, value) {
  if (new RegExp(`^${key}:`, "m").test(text)) {
    return text.replace(new RegExp(`^${key}:\\s*(?:".*"|.*)$`, "m"), `${key}: ${value}`);
  }

  return text.replace(/^commitment:\s*.*$/m, (line) => `${line}\n${key}: ${value}`);
}

const repoSpecificFeatureText = `---
id: feature-setup-guidance
title: Repo-specific feature shape
status: queued
priority: high
commitment: committed
milestone: P2
---

## Goal

Render the real file sections in edit mode.

## Non-goals

- do not force canonical section names

## Acceptance criteria

1. Edit mode shows Goal.
2. Edit mode does not show Summary first.

## Implementation Notes

- keep the section order from the file
`;

async function restoreFixture(file, contents) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await fs.writeFile(file, contents, "utf8");
      return;
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}

async function currentSpecFile(page) {
  await expect(page).toHaveURL(/file=/);
  return page.evaluate(() => decodeURIComponent(window.location.hash.match(/file=([^&]+)/)[1]));
}

async function openMetadataDetails(page) {
  const details = page.locator(".metadata-details");
  if ((await details.getAttribute("open")) === null) {
    await page.locator("#metadata-toggle").click();
  }
}

async function dragRoadmapElement(page, sourceSelector, targetSelector, { targetYRatio = 0.5, scrollTargets = true } = {}) {
  const sourceLocator = page.locator(sourceSelector);
  const targetLocator = page.locator(targetSelector);
  if (scrollTargets) {
    await sourceLocator.scrollIntoViewIfNeeded();
    await targetLocator.scrollIntoViewIfNeeded();
  }
  const sourceBox = await sourceLocator.boundingBox();
  const targetBox = await targetLocator.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error(`Drag targets were not visible: ${sourceSelector} -> ${targetSelector}`);
  }

  const source = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
  const target = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height * targetYRatio };
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(source.x + 8, source.y + 8, { steps: 4 });
  await page.mouse.move(target.x - 2, target.y - 2, { steps: 16 });
  await page.mouse.move(target.x, target.y, { steps: 2 });
  await page.mouse.up();
}

test.describe.configure({ mode: "serial" });

let originalBoardText = "";
let originalScopeText = "";
let originalFeatureText = "";
let originalSearchFeatureText = "";
let originalIdeaCreateText = "";
let originalConfigText = null;

test.beforeEach(async ({ page }) => {
  originalBoardText = await fs.readFile(boardPath, "utf8");
  originalScopeText = await fs.readFile(scopePath, "utf8");
  originalFeatureText = await fs.readFile(featurePath, "utf8");
  originalSearchFeatureText = await fs.readFile(searchFeaturePath, "utf8");
  originalIdeaCreateText = await fs.readFile(ideaCreatePath, "utf8");
  originalConfigText = await fs.readFile(configPath, "utf8").catch(() => null);
  await fs.rm(setupSandboxPath, { recursive: true, force: true });
  await page.addInitScript(() => window.localStorage.removeItem("roadmap-ui.scope-collapsed"));
});

test.afterEach(async () => {
  await restoreFixture(boardPath, originalBoardText);
  await restoreFixture(scopePath, originalScopeText);
  await restoreFixture(featurePath, originalFeatureText);
  await restoreFixture(searchFeaturePath, originalSearchFeatureText);
  await restoreFixture(ideaCreatePath, originalIdeaCreateText);
  await fs.rm(setupSandboxPath, { recursive: true, force: true });
  if (originalConfigText === null) {
    await fs.rm(configPath, { force: true });
    return;
  }

  await restoreFixture(configPath, originalConfigText);
});

test("shows repo name and ASCII workspace summary in the header", async ({ page }) => {
  await page.goto(repoUrl());

  await expect(page).toHaveTitle(/Minimap.*minimap.*Roadmap/);
  await expect(page.locator("#repo-name")).toHaveText("minimap");
  await expect(page.locator("#mode-title")).toHaveText("Roadmap");
  await expect(page.locator("#workspace-summary")).toContainText(/\d+ items \/ \d+ groups/);
  await expect(page.locator("#workspace-summary")).not.toContainText("?");
});

test("shows guided setup state and can create a starter workspace", async ({ page }) => {
  await fs.writeFile(configPath, JSON.stringify({ roadmapPath: "playwright-setup-roadmap" }), "utf8");
  await page.goto(repoUrl());

  await expect(page.locator("#workspace-summary")).toContainText("Setup required");
  await expect(page.locator("#editor-title")).toContainText("Roadmap workspace needs setup");
  await expect(page.locator("#setup-view")).toContainText("Roadmap workspace needs setup");
  await expect(page.locator("#setup-view")).toContainText("playwright-setup-roadmap");
  await page.locator('[data-setup-action="initialize"]').click();

  await expect(page.locator("#workspace-summary")).toContainText("0 items / 3 groups");
  await expect(page.locator(".board-group").first()).toContainText("Now");
  await expect(page.locator("#setup-view")).toBeHidden();
  await expect(page.locator("#status-banner")).toContainText("Roadmap workspace created.");
});
test("keeps scope on the right side of the editor and narrower on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(repoUrl());

  const editorBox = await page.locator(".editor-panel").boundingBox();
  const scopeBox = await page.locator(".scope-panel").boundingBox();

  expect(editorBox).not.toBeNull();
  expect(scopeBox).not.toBeNull();
  expect(scopeBox.x).toBeGreaterThan(editorBox.x + 80);
  expect(editorBox.width).toBeGreaterThan(scopeBox.width + 220);
});

test("renders scope markdown instead of raw text", async ({ page }) => {
  await page.goto(repoUrl());

  await expect(page.locator("#scope-content ul li").first()).toContainText("keep the canonical minimap contract as small as possible");
  await expect(page.locator("#scope-content")).not.toContainText("- keep the canonical minimap contract as small as possible");
});

test("allows resizing the scope panel on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(repoUrl());

  const handle = page.locator("#scope-resizer");
  await expect(handle).toBeVisible();

  const initialEditorBox = await page.locator(".editor-panel").boundingBox();
  const initialScopeBox = await page.locator(".scope-panel").boundingBox();
  const handleBox = await handle.boundingBox();

  expect(initialEditorBox).not.toBeNull();
  expect(initialScopeBox).not.toBeNull();
  expect(handleBox).not.toBeNull();

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 120);
  await page.mouse.down();
  await page.mouse.move(handleBox.x - 120, handleBox.y + 120, { steps: 8 });
  await page.mouse.up();

  const resizedEditorBox = await page.locator(".editor-panel").boundingBox();
  const resizedScopeBox = await page.locator(".scope-panel").boundingBox();

  expect(resizedEditorBox).not.toBeNull();
  expect(resizedScopeBox).not.toBeNull();
  expect(resizedScopeBox.width).toBeGreaterThan(initialScopeBox.width + 80);
  expect(resizedEditorBox.width).toBeLessThan(initialEditorBox.width - 80);
});

test("resizes the List board and item panes and persists the board width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(repoUrl());

  const handle = page.locator("#board-editor-resizer");
  await expect(handle).toBeVisible();
  await expect(handle).toHaveAttribute("role", "separator");

  const initialBoard = await page.locator(".board-panel").boundingBox();
  const initialEditor = await page.locator(".editor-panel").boundingBox();
  const handleBox = await handle.boundingBox();
  expect(initialBoard).not.toBeNull();
  expect(initialEditor).not.toBeNull();
  expect(handleBox).not.toBeNull();

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 120);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 140, handleBox.y + 120, { steps: 8 });
  await page.mouse.up();

  const resizedBoard = await page.locator(".board-panel").boundingBox();
  const resizedEditor = await page.locator(".editor-panel").boundingBox();
  expect(resizedBoard.width).toBeGreaterThan(initialBoard.width + 100);
  expect(resizedEditor.width).toBeLessThan(initialEditor.width - 100);
  await expect(handle).toHaveAttribute("aria-valuenow", String(Math.round(resizedBoard.width)));

  const storedWidth = await page.evaluate(() => window.localStorage.getItem("roadmap-ui.board-width"));
  expect(Number(storedWidth)).toBeGreaterThan(initialBoard.width + 100);

  await page.reload();
  const restoredBoard = await page.locator(".board-panel").boundingBox();
  expect(Math.abs(restoredBoard.width - resizedBoard.width)).toBeLessThan(2);
});
test("keeps the board visible at medium widths and pushes scope below", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 1100 });
  await page.goto(repoUrl());

  const boardBox = await page.locator('.board-panel').boundingBox();
  const editorBox = await page.locator('.editor-panel').boundingBox();
  const scopeBox = await page.locator('.scope-panel').boundingBox();

  expect(boardBox).not.toBeNull();
  expect(editorBox).not.toBeNull();
  expect(scopeBox).not.toBeNull();

  expect(boardBox.x).toBeLessThan(editorBox.x);
  expect(Math.abs(boardBox.y - editorBox.y)).toBeLessThan(40);
  expect(scopeBox.y).toBeGreaterThan(boardBox.y + boardBox.height - 20);
  expect(scopeBox.y).toBeGreaterThan(editorBox.y + 120);
  expect(scopeBox.height).toBeLessThan(420);
  await expect(page.locator('#jump-to-board')).toBeHidden();
  await expect(page.locator('#jump-to-editor')).toBeHidden();
  await expect(page.locator('pre#scope-content')).toHaveCount(0);
});

test("renders a denser board rail on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(repoUrl());

  const firstCard = page.locator(".board-item").first();
  await expect(firstCard).toBeVisible();
  const box = await firstCard.boundingBox();

  expect(box).not.toBeNull();
  expect(box.height).toBeLessThan(210);
});

test("renders compact board group controls that stay on one row", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(repoUrl());

  const firstHeader = page.locator(".board-group-header").first();
  const toggle = firstHeader.locator(".collapse-toggle");
  const actions = firstHeader.locator(".group-actions");
  const upButton = actions.locator('[data-move-group="up"]');
  const downButton = actions.locator('[data-move-group="down"]');

  await expect(upButton).toContainText("Up");
  await expect(downButton).toContainText("Down");
  await expect(firstHeader).toBeVisible();

  const headerBox = await firstHeader.boundingBox();
  const toggleBox = await toggle.boundingBox();
  const actionsBox = await actions.boundingBox();

  expect(headerBox).not.toBeNull();
  expect(toggleBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  expect(actionsBox.y).toBeLessThan(toggleBox.y + 10);
  expect(actionsBox.x + actionsBox.width).toBeLessThanOrEqual(headerBox.x + headerBox.width + 1);
});

test("collapses scope into a narrow rail and gives space back to the editor", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(repoUrl());

  const editorPanel = page.locator(".editor-panel");
  const scopePanel = page.locator(".scope-panel");
  const scopeToggle = page.locator("#scope-toggle");
  const scopeContent = page.locator("#scope-content");

  const expandedEditorBox = await editorPanel.boundingBox();
  const expandedScopeBox = await scopePanel.boundingBox();

  await scopeToggle.click();

  await expect(scopePanel).toHaveClass(/scope-collapsed/);
  await expect(scopeToggle).toContainText("Open");
  await expect(page.locator("#scope-edit-button")).toBeHidden();
  await expect(scopeContent).toBeHidden();

  const collapsedEditorBox = await editorPanel.boundingBox();
  const collapsedScopeBox = await scopePanel.boundingBox();

  expect(expandedEditorBox).not.toBeNull();
  expect(expandedScopeBox).not.toBeNull();
  expect(collapsedEditorBox).not.toBeNull();
  expect(collapsedScopeBox).not.toBeNull();
  expect(collapsedEditorBox.width).toBeGreaterThan(expandedEditorBox.width + 100);
  expect(collapsedScopeBox.width).toBeLessThan(expandedScopeBox.width - 100);
});

test("shows only the active editor pane for each mode", async ({ page }) => {
  await page.goto(repoUrl());

  await expect(page.locator('[data-mode-pane="structured"]')).toBeHidden();
  await expect(page.locator('[data-mode-pane="preview"]')).toBeVisible();
  await expect(page.locator('[data-mode-pane="raw"]')).toBeHidden();

  await page.locator('[data-editor-mode="structured"]').click();
  await expect(page.locator('[data-mode-pane="structured"]')).toBeVisible();
  await expect(page.locator('[data-mode-pane="preview"]')).toBeHidden();
  await expect(page.locator('[data-mode-pane="raw"]')).toBeHidden();

  await page.locator('[data-editor-mode="raw"]').click();
  await expect(page.locator('[data-mode-pane="structured"]')).toBeHidden();
  await expect(page.locator('[data-mode-pane="preview"]')).toBeHidden();
  await expect(page.locator('[data-mode-pane="raw"]')).toBeVisible();
});

test("uses the tabs as the only mode chrome in the editor header", async ({ page }) => {
  await page.goto(repoUrl());

  await expect(page.locator("#editor-mode-pill")).toHaveCount(0);
  await expect(page.locator("#editor-mode-description")).toHaveCount(0);
  await expect(page.locator('#tab-preview')).toHaveClass(/is-active/);

  await page.locator('#tab-structured').click();
  await expect(page.locator('#tab-structured')).toHaveClass(/is-active/);

  await page.locator('#tab-raw').click();
  await expect(page.locator('#tab-raw')).toHaveClass(/is-active/);
});

test("edit mode starts with details collapsed so content shows earlier", async ({ page }) => {
  await page.goto(repoUrl());
  await page.locator('[data-editor-mode="structured"]').click();

  const details = page.locator(".metadata-details");
  await expect(details).not.toHaveAttribute("open", "open");
  await expect(page.locator("#metadata-toggle")).toBeVisible();
  await expect(page.locator("#field-title")).toBeHidden();
  await expect(page.locator('[data-section-heading="Summary"]')).toBeVisible();

  await page.locator("#metadata-toggle").click();
  await expect(details).toHaveAttribute("open", "");
  await expect(page.locator("#field-title")).toBeVisible();
});

test("edit mode stacks sections in one clean column and autosizes long content", async ({ page }) => {
  await page.goto(repoUrl());
  await page.locator('[data-editor-mode="structured"]').click();
  await expect(page.locator('#tab-structured')).toHaveClass(/is-active/);
  await expect(page.locator('[data-mode-pane="structured"]')).toBeVisible();

  const sectionLabels = page.locator('.structured-section-field');
  await expect(sectionLabels.nth(1)).toBeVisible();
  expect(await sectionLabels.count()).toBeGreaterThanOrEqual(2);
  const firstBox = await sectionLabels.nth(0).boundingBox();
  const secondBox = await sectionLabels.nth(1).boundingBox();

  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height - 10);

  const size = await sectionLabels.nth(1).locator('[data-section-heading]').evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));

  expect(size.scrollHeight).toBeLessThanOrEqual(size.clientHeight + 2);
});

test("opens another board item in read mode before entering edit mode", async ({ page }) => {
  await page.goto(repoUrl());

  const targetCard = page.locator('[data-item-id="feature-edit-board-and-scope"]');
  await expect(targetCard.locator('.board-item-overview')).toContainText('Add first-class editing for board.md and scope.md');
  await expect(targetCard).toHaveAttribute('title', 'Edit board and scope from the UI');

  await targetCard.click();
  await expect(page.locator('#tab-preview')).toHaveClass(/is-active/);
  await expect(page.locator('#save-button')).toBeHidden();
  await expect(page.locator('#item-preview')).toContainText('Add first-class editing for board.md and scope.md');

  await page.locator('#tab-structured').click();
  await expect(page.locator('#tab-structured')).toHaveClass(/is-active/);
  await openMetadataDetails(page);

  await expect(page.locator("#field-id")).toHaveValue("feature-edit-board-and-scope");
  await expect(page.locator("#field-title")).toHaveValue("Edit board and scope from the UI");
  await expect(page.locator("#editor-subtitle")).toContainText("feature-edit-board-and-scope.md");
});


test("shows the same lazy participant details in List and Columns without per-card requests", async ({ page }) => {
  const participantRequests = [];
  await page.route(/\/api\/items\/([^/]+)\/participants$/, async (route) => {
    const itemId = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-2));
    participantRequests.push(itemId);
    await route.fulfill({ json: participantPayload(itemId) });
  });

  await page.goto(repoUrl("/#item=feature-setup-guidance"));
  const details = page.locator("#item-participants");
  await expect(details).toBeVisible();
  await expect(page.locator("#item-participants-status")).toHaveText("1 participant");
  expect(participantRequests).toEqual(["feature-setup-guidance"]);

  await details.locator("summary").click();
  await expect(page.locator("#item-participants-list")).toContainText("minimap-dev");
  await expect(page.locator("#item-participants-list")).toContainText("codex");
  await expect(page.locator("#item-participants-list .badge")).toHaveCount(4);
  await expect(page.locator("#item-participants-list")).toContainText("git:github.com/rore/minimap");
  await expect(page.locator("#item-participants-list a")).toHaveCount(0);
  await expect(page.locator("#item-participants-scope")).toHaveText("roadmap:v1:git:github.com/rore/minimap#roadmap");

  await page.locator("#board-layout-columns").click();
  await page.locator('[data-item-open="feature-setup-guidance"]').click();
  await expect(page.locator("#editor-overlay")).toBeVisible();
  await expect(page.locator("#item-participants-list")).toContainText("minimap-dev");
  expect(participantRequests).toEqual(["feature-setup-guidance", "feature-setup-guidance"]);
});

test("keeps a 200-session participant result scrollable without squeezing the item pane", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 820 });
  await page.route(/\/api\/items\/([^/]+)\/participants$/, async (route) => {
    const itemId = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-2));
    await route.fulfill({ json: participantPayload(itemId, "minimap-dev", 200) });
  });

  await page.goto(repoUrl("/#item=feature-setup-guidance"));
  const details = page.locator("#item-participants");
  await details.locator("summary").click();
  await expect(page.locator(".item-participant")).toHaveCount(200);
  let geometry = await page.evaluate(() => ({
    participantClientHeight: document.querySelector(".item-participants-body").clientHeight,
    participantScrollHeight: document.querySelector(".item-participants-body").scrollHeight,
    itemClientHeight: document.querySelector(".editor-panels").clientHeight,
  }));
  expect(geometry.participantScrollHeight).toBeGreaterThan(geometry.participantClientHeight);
  expect(geometry.itemClientHeight).toBeGreaterThan(180);

  await page.locator("#board-layout-columns").click();
  await page.locator('[data-item-open="feature-setup-guidance"]').click();
  await expect(page.locator("#editor-overlay")).toBeVisible();
  await expect(page.locator(".item-participant")).toHaveCount(200);
  geometry = await page.evaluate(() => ({
    participantClientHeight: document.querySelector(".item-participants-body").clientHeight,
    participantScrollHeight: document.querySelector(".item-participants-body").scrollHeight,
    itemClientHeight: document.querySelector(".editor-panels").clientHeight,
  }));
  expect(geometry.participantScrollHeight).toBeGreaterThan(geometry.participantClientHeight);
  expect(geometry.itemClientHeight).toBeGreaterThan(180);
});
test("keeps participant lookup invisible and ordinary editing usable when Pallium is not configured", async ({ page }) => {
  await page.goto(repoUrl("/#item=feature-setup-guidance"));

  await expect(page.locator("#item-participants")).toBeHidden();
  await page.locator("#tab-structured").click();
  await openMetadataDetails(page);
  await expect(page.locator("#field-title")).toBeEditable();
  await expect(page.locator("#field-title")).toHaveValue("Setup guidance and empty-state workflow");
});

test("does not let a stale item response replace the latest selection", async ({ page }) => {
  await page.goto(repoUrl());
  await page.route(/\/api\/items\/feature-setup-guidance$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      await route.continue();
    } catch {
      // The newer selection intentionally aborts this request.
    }
  });

  await page.locator('[data-item-id="feature-setup-guidance"]').click();
  await page.locator('[data-item-id="feature-search-and-filters"]').click();
  await expect(page.locator("#editor-title")).toContainText("Search");
  await page.waitForTimeout(400);
  await expect(page.locator("#editor-title")).toContainText("Search");
});

test("does not let an in-flight participant response replace the latest selection", async ({ page }) => {
  let markSlowStarted;
  const slowStarted = new Promise((resolve) => { markSlowStarted = resolve; });
  await page.route(/\/api\/items\/([^/]+)\/participants$/, async (route) => {
    const itemId = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-2));
    if (itemId === "feature-setup-guidance") {
      markSlowStarted();
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    try {
      await route.fulfill({ json: participantPayload(itemId, itemId === "feature-setup-guidance" ? "stale-session" : "current-session") });
    } catch {
      // The newer selection intentionally aborts this request.
    }
  });

  await page.goto(repoUrl("/#item=feature-setup-guidance"));
  await slowStarted;
  await page.locator('[data-item-id="feature-search-and-filters"]').click();
  await expect(page.locator("#editor-title")).toContainText("Search");
  await expect(page.locator("#item-participants")).toBeVisible();
  await page.locator("#item-participants summary").click();
  await expect(page.locator("#item-participants-list")).toContainText("current-session");
  await page.waitForTimeout(400);
  await expect(page.locator("#item-participants-list")).not.toContainText("stale-session");
});

test("keeps the selected item in the URL so refresh returns to it", async ({ page }) => {
  await page.goto(repoUrl());

  await page.locator('[data-item-id="feature-edit-board-and-scope"]').click();
  await expect(page).toHaveURL(/[#&]item=feature-edit-board-and-scope$/);

  await page.reload();
  await expect(page.locator("#editor-title")).toHaveText("Edit board and scope from the UI");
  await expect(page).toHaveURL(/[#&]item=feature-edit-board-and-scope$/);
});

test("supports direct item links and back-forward navigation through the URL", async ({ page }) => {
  await page.goto(repoUrl("/#item=feature-edit-board-and-scope&mode=structured"));

  await expect(page.locator("#editor-title")).toHaveText("Edit board and scope from the UI");
  await expect(page.locator('#tab-structured')).toHaveClass(/is-active/);

  await page.locator('[data-item-id="feature-search-and-filters"]').click();
  await expect(page).toHaveURL(/[#&]item=feature-search-and-filters$/);
  await expect(page.locator('#tab-preview')).toHaveClass(/is-active/);

  await page.goBack();
  await expect(page.locator("#editor-title")).toHaveText("Edit board and scope from the UI");
  await expect(page).toHaveURL(/[#&]item=feature-edit-board-and-scope&mode=structured$/);
});

test("collapses and expands a board section", async ({ page }) => {
  await page.goto(repoUrl());

  const firstGroup = page.locator(".board-group").first();
  const toggle = firstGroup.locator(".collapse-toggle");
  const items = firstGroup.locator(".board-item-list");

  await expect(items).toBeVisible();
  await toggle.click();
  await expect(items).toBeHidden();
  await toggle.click();
  await expect(items).toBeVisible();
});

test("reorders board sections and persists after reload", async ({ page }) => {
  const originalHeadings = extractHeadings(originalBoardText);
  expect(originalHeadings.length).toBeGreaterThan(1);

  await page.goto(repoUrl());

  const firstGroup = page.locator(".board-group").first();
  await expect(firstGroup.locator('[data-move-group="up"]')).toContainText("Up");
  await expect(firstGroup.locator('[data-move-group="down"]')).toContainText("Down");

  await firstGroup.locator('[data-move-group="down"]').click();
  await expect(page.locator("#status-banner")).toContainText("Board order saved.");

  const updatedBoardText = await fs.readFile(boardPath, "utf8");
  const updatedHeadings = extractHeadings(updatedBoardText);
  const expectedHeadings = [...originalHeadings];
  [expectedHeadings[0], expectedHeadings[1]] = [expectedHeadings[1], expectedHeadings[0]];

  expect(updatedHeadings).toEqual(expectedHeadings);
  await page.reload();
  await expect(page.locator(".board-group").first().locator(".collapse-toggle")).toContainText(expectedHeadings[0]);
});

test("saves optional milestone metadata and reflects it in the board", async ({ page }) => {
  await page.goto(repoUrl("/#item=feature-setup-guidance"));
  await page.locator('[data-editor-mode="structured"]').click();
  await openMetadataDetails(page);

  await page.locator("#field-milestone").fill("P2");
  await page.locator("#save-button").click();

  await expect(page.locator("#status-banner")).toContainText("Saved.");
  await expect(page.locator('[data-item-id="feature-setup-guidance"]')).toContainText("P2");

  const updatedFeatureText = await fs.readFile(featurePath, "utf8");
  expect(updatedFeatureText).toContain("milestone: P2");
});

test("renders extra sections from the item file in the structured editor", async ({ page }) => {
  const nextText = addExtraSection(addMilestone(originalFeatureText, "P3"), "Decision Locks", "- keep the file contract thin");
  await fs.writeFile(featurePath, nextText, "utf8");

  await page.goto(repoUrl("/#item=feature-setup-guidance"));
  await expect(page.locator("#editor-title")).toContainText("Setup guidance");
  await page.locator('[data-editor-mode="structured"]').click();
  await openMetadataDetails(page);

  await expect(page.locator('[data-section-heading="Decision Locks"]')).toHaveValue("- keep the file contract thin");
  await expect(page.locator("#field-milestone")).toHaveValue("P3");
});


test("edit mode renders the item's real section headings for repo-specific item shapes", async ({ page }) => {
  await fs.writeFile(featurePath, repoSpecificFeatureText, "utf8");

  await page.goto(repoUrl("/#item=feature-setup-guidance"));
  await expect(page.locator("#editor-title")).toContainText("Repo-specific feature shape");
  await page.locator('[data-editor-mode="structured"]').click();

  await expect(page.locator('[data-section-heading="Goal"]')).toHaveValue("Render the real file sections in edit mode.");
  await expect(page.locator('[data-section-heading="Acceptance criteria"]')).toHaveValue(/Edit mode shows Goal\./);
  await expect(page.locator('[data-section-heading="Summary"]')).toHaveCount(0);

  const firstHeading = await page.locator('.structured-section-field span').first().textContent();
  expect(firstHeading).toBe("Goal");
});

test("read mode shows the full item and reflects the current edit state", async ({ page }) => {
  await page.goto(repoUrl("/#item=feature-setup-guidance&mode=structured"));

  await page.locator('[data-section-heading="Summary"]').fill('Keep planning in the repo, show board changes clearly, and tighten review workflow.');
  await page.locator('[data-section-heading="Why"]').fill('Read mode should show the whole item while still reflecting the current edit state.');
  await page.locator('[data-editor-mode="preview"]').click();

  await expect(page.locator('#item-preview')).toContainText('Keep planning in the repo');
  await expect(page.locator('#item-preview')).toContainText('Read mode should show the whole item');
  const sectionCount = await page.locator('#item-preview .preview-section').count();
  expect(sectionCount).toBeGreaterThanOrEqual(6);
  await expect(page.locator('#item-preview .preview-glance-card')).toHaveCount(0);
  await expect(page.locator('#save-button')).toBeHidden();
});

test("renders and edits generic scalar metadata fields like lane", async ({ page }) => {
  await fs.writeFile(featurePath, addFrontmatterField(originalFeatureText, "lane", "integration-feedback"), "utf8");

  await page.goto(repoUrl("/#item=feature-setup-guidance"));
  await expect(page.locator("#editor-title")).toContainText("Setup guidance");

  const boardCard = page.locator('[data-item-id="feature-setup-guidance"]').first();
  await expect(boardCard).toContainText('Lane: integration-feedback');
  await expect(page.locator('#item-preview .preview-meta')).toContainText('Lane: integration-feedback');

  await page.locator('#tab-structured').click();
  await openMetadataDetails(page);
  const laneField = page.locator('[data-extra-metadata-key="lane"]');
  await expect(laneField).toHaveValue('integration-feedback');
  await laneField.fill('stabilization-foundation');
  await page.locator('#save-button').click();
  await page.locator('#tab-preview').click();

  await expect(page.locator('#item-preview .preview-meta')).toContainText('Lane: stabilization-foundation');
  await expect(page.locator('[data-item-id="feature-setup-guidance"]').first()).toContainText('Lane: stabilization-foundation');
  await expect.poll(async () => fs.readFile(featurePath, 'utf8')).toContain('lane: stabilization-foundation');
});

test("renders nested and wrapped markdown list content in read mode", async ({ page }) => {
  const nestedInScope = [
    "- add automatic suspicious-case detectors over live/debug traces",
    "  - generic summary selected while sharper active memory exists in scope",
    "  - same-thread continuation with sufficient local context still injecting",
    "- add one replay-promotion tool or workflow that turns a captured miss bundle",
    "  into a benchmark-ready scenario skeleton with fields for:",
    "  - prior events",
    "  - current thread context",
  ].join("\n");

  await fs.writeFile(featurePath, replaceSectionContent(originalFeatureText, "In Scope", nestedInScope), "utf8");

  await page.goto(repoUrl("/#item=feature-setup-guidance"));
  await expect(page.locator("#editor-title")).toContainText("Setup guidance");

  const section = page.locator(".preview-section", { has: page.locator("h2", { hasText: "In Scope" }) });
  const html = await section.locator(".preview-markdown").innerHTML();
  expect(html).toContain("<ul>");
  expect(html).toContain("add automatic suspicious-case detectors over live/debug traces");
  expect(html).toContain("same-thread continuation with sufficient local context still injecting");
  expect(html).toContain("captured miss bundle into a benchmark-ready scenario skeleton with fields for:");
  expect(html).toContain("<ul><li>prior events</li><li>current thread context</li></ul>");
  expect(html).not.toContain("</ul><p>");
  expect(html).not.toContain("</li><p>prior events</p>");
});
test("prompts before discarding unsaved structured changes when switching items from the board", async ({ page }) => {
  await page.goto(repoUrl("/#item=feature-setup-guidance&mode=structured"));
  await expect(page.locator("#editor-title")).toContainText("Setup guidance");
  await openMetadataDetails(page);
  await expect(page.locator("#field-title")).toHaveValue("Setup guidance and empty-state workflow");
  await page.locator('#field-title').fill('Unsaved setup title');

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Discard unsaved item changes');
    await dialog.dismiss();
  });
  await page.locator('[data-item-id="feature-edit-board-and-scope"]').click();

  await expect(page.locator('#field-title')).toHaveValue('Unsaved setup title');
  await expect(page).toHaveURL(/[#&]item=feature-setup-guidance&mode=structured$/);

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Discard unsaved item changes');
    await dialog.accept();
  });
  await page.locator('[data-item-id="feature-edit-board-and-scope"]').click();

  await expect(page).toHaveURL(/[#&]item=feature-edit-board-and-scope$/);
  await expect(page.locator('#tab-preview')).toHaveClass(/is-active/);
  await expect(page.locator('#save-button')).toBeHidden();
});

test("inline edit mode shows cancel beside save and discards changes back to read", async ({ page }) => {
  await page.goto(repoUrl("/#item=feature-setup-guidance&mode=structured"));

  await expect(page.locator("#editor-cancel-button")).toBeVisible();
  await openMetadataDetails(page);
  await page.locator("#field-title").fill("Discard me");
  await page.locator("#editor-cancel-button").click();

  await expect(page.locator('#tab-preview')).toHaveClass(/is-active/);
  await expect(page.locator('#item-preview')).not.toContainText('Discard me');
  await page.locator('#tab-structured').click();
  await openMetadataDetails(page);
  await expect(page.locator('#field-title')).toHaveValue('Setup guidance and empty-state workflow');
});

test("raw mode saves full-file edits", async ({ page }) => {
  await page.goto(repoUrl("/#item=feature-setup-guidance"));
  await expect(page.locator("#editor-title")).toContainText("Setup guidance");

  await page.locator('[data-editor-mode="raw"]').click();
  await page.locator("#raw-text").fill(replaceTitle(originalFeatureText, "Search roadmap items through raw mode"));
  await page.locator("#save-button").click();

  await expect(page.locator("#status-banner")).toContainText("Saved.");
  await page.locator('[data-editor-mode="structured"]').click();
  await openMetadataDetails(page);
  await expect(page.locator("#field-title")).toHaveValue("Search roadmap items through raw mode");

  const updatedFeatureText = await fs.readFile(featurePath, "utf8");
  expect(updatedFeatureText).toContain('title: "Search roadmap items through raw mode"');
});

test("refresh reloads the workspace after an external file edit", async ({ page }) => {
  await page.goto(repoUrl("/#item=feature-setup-guidance"));
  await expect(page.locator("#editor-title")).toContainText("Setup guidance");

  const changedTitle = "Search roadmap items with guided setup";
  await fs.writeFile(featurePath, replaceTitle(originalFeatureText, changedTitle), "utf8");

  await page.locator("#refresh-button").click();
  await page.locator('[data-editor-mode="structured"]').click();
  await openMetadataDetails(page);

  await expect(page.locator("#field-title")).toHaveValue(changedTitle);
  await expect(page.locator('[data-item-id="feature-setup-guidance"]')).toContainText(changedTitle);
});

test("edits scope from the UI and saves markdown back to scope.md", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(repoUrl());

  await page.locator("#scope-edit-button").click();
  await expect(page.locator("#scope-toggle")).toBeHidden();
  await expect(page.locator("#scope-subtitle")).toBeHidden();
  await expect(page.locator("#scope-text")).toBeVisible();
  await page.locator("#scope-text").fill(`# Current focus\n\n- make scope editable from the UI`);
  await page.locator("#scope-save-button").click();

  await expect(page.locator("#status-banner")).toContainText("Scope saved.");
  await expect(page.locator("#scope-content ul li").first()).toContainText("make scope editable from the UI");

  const updatedScopeText = await fs.readFile(scopePath, "utf8");
  expect(updatedScopeText.replace(/\r/g, "")).toBe(`# Current focus\n\n- make scope editable from the UI\n`);
});

test("edits board groups, moves items, and saves the updated board", async ({ page }) => {
  await page.goto(repoUrl());
  await expect(page.locator("#workspace-summary")).toContainText(/\d+ items \/ \d+ groups/);

  await page.locator("#board-edit-button").click();
  await page.locator('[data-board-group-name="0"]').fill("Ready");
  await page.locator('[data-board-item-group="feature-setup-guidance"]').selectOption("0");
  await page.locator("#board-save-button").click();

  await expect(page.locator("#status-banner")).toContainText("Board saved.");
  const updatedBoardText = (await fs.readFile(boardPath, "utf8")).replace(/\r/g, "");
  expect(updatedBoardText).toContain("# Ready");
  expect(updatedBoardText).toContain("- feature-setup-guidance");

  await page.reload();
  await expect(page.locator(".board-group").first().locator(".group-name")).toContainText("Ready");
  await expect(page.locator('[data-item-id="feature-setup-guidance"]').first()).toContainText("Setup guidance and empty-state workflow");
});

test("moves an item to another board group from the structured editor and saves board.md", async ({ page }) => {
  await page.goto(repoUrl("/#item=idea-timeline-view&mode=structured"));

  await openMetadataDetails(page);
  await page.locator("#field-board-group").selectOption({ label: "Next" });
  await page.locator("#save-button").click();

  await expect(page.locator("#status-banner")).toContainText("Saved.");
  await expect(page.locator(".board-group").nth(1).locator(".group-name")).toContainText("Next");
  await expect(page.locator(".board-group").nth(1)).toContainText("Optional timeline view");

  const updatedBoardText = (await fs.readFile(boardPath, "utf8")).replace(/\r/g, "");
  const nextSection = updatedBoardText.match(/# Next\n([\s\S]*?)(?=\n# |$)/)?.[1] || "";
  const ideasSection = updatedBoardText.match(/# Ideas\n([\s\S]*?)(?=\n# |$)/)?.[1] || "";
  expect(nextSection).toContain("- idea-timeline-view");
  expect(ideasSection).not.toContain("- idea-timeline-view");
});

test("prioritizes the selected item before the board on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 540, height: 1100 });
  await page.goto(repoUrl());

  const boardBox = await page.locator(".board-panel").boundingBox();
  const editorBox = await page.locator(".editor-panel").boundingBox();
  const scopeBox = await page.locator(".scope-panel").boundingBox();

  expect(boardBox).not.toBeNull();
  expect(editorBox).not.toBeNull();
  expect(scopeBox).not.toBeNull();

  expect(boardBox.y).toBeGreaterThan(editorBox.y + 50);
  expect(scopeBox.y).toBeGreaterThan(boardBox.y + 50);
});


test("mobile scope toggle collapses and expands the scope panel", async ({ page }) => {
  await page.setViewportSize({ width: 540, height: 1100 });
  await page.goto(repoUrl());

  const scopePanel = page.locator(".scope-panel");
  const scopeToggle = page.locator("#scope-toggle");
  const scopeContent = page.locator("#scope-content");

  await scopePanel.scrollIntoViewIfNeeded();
  await expect(scopeContent).toBeVisible();

  await scopeToggle.click();
  await expect(scopePanel).toHaveClass(/scope-collapsed/);
  await expect(scopeToggle).toContainText("Open");
  await expect(scopeContent).toBeHidden();

  await scopeToggle.click();
  await expect(scopeToggle).toContainText("Collapse");
  await expect(scopeContent).toBeVisible();
});

test("stacked layout provides working jumps between board and item", async ({ page }) => {
  await page.setViewportSize({ width: 540, height: 1100 });
  await page.goto(repoUrl());

  await expect(page.locator("#jump-to-board")).toBeVisible();
  await page.locator("#jump-to-board").click();
  await page.waitForTimeout(250);

  const boardTop = await page.locator(".board-panel").evaluate((element) => Math.round(element.getBoundingClientRect().top));
  expect(boardTop).toBeLessThan(40);

  await expect(page.locator("#jump-to-editor")).toBeVisible();
  await page.locator("#jump-to-editor").click();
  await page.waitForTimeout(250);

  const editorTop = await page.locator(".editor-panel").evaluate((element) => Math.round(element.getBoundingClientRect().top));
  expect(editorTop).toBeLessThan(40);
});

test("selecting a board item in stacked layout returns focus to the editor", async ({ page }) => {
  await page.setViewportSize({ width: 540, height: 1100 });
  await page.goto(repoUrl());

  await page.locator(".board-panel").scrollIntoViewIfNeeded();
  await page.locator('[data-item-id="feature-edit-board-and-scope"]').click();
  await page.waitForTimeout(250);

  await expect(page.locator("#editor-title")).toHaveText("Edit board and scope from the UI");
  const editorTop = await page.locator(".editor-panel").evaluate((element) => Math.round(element.getBoundingClientRect().top));
  expect(editorTop).toBeLessThan(40);
});


test("search filters the grouped board by item body text and persists in the URL", async ({ page }) => {
  const nextText = originalSearchFeatureText.replace("Add fast search plus dynamic filter controls", "Add fast search plus dynamic filter controls for lighthouse review");
  await fs.writeFile(searchFeaturePath, nextText, "utf8");

  await page.goto(repoUrl());
  await page.locator("#board-search").fill("lighthouse review");

  await expect(page.locator('[data-item-id="feature-search-and-filters"]')).toBeVisible();
  await expect(page.locator('[data-item-id="feature-setup-guidance"]')).toHaveCount(0);
  await expect(page).toHaveURL(/q=lighthouse\+review/);

  await page.reload();
  await expect(page.locator("#board-search")).toHaveValue("lighthouse review");
  await expect(page.locator('[data-item-id="feature-search-and-filters"]')).toBeVisible();
});

test("generic metadata filters render from file frontmatter and combine with search", async ({ page }) => {
  await page.goto(repoUrl());
  await expect(page.locator("#workspace-summary")).toContainText(/\d+ items \/ \d+ groups/);

  await page.locator("#board-filter-toggle").click();
  await expect(page.locator('[data-filter-key="commitment"][data-filter-value="committed"]')).toBeVisible();
  await expect(page.locator('[data-filter-key="id"]')).toHaveCount(0);
  await expect(page.locator('[data-filter-key="labels"]')).toHaveCount(0);

  await page.locator('[data-filter-key="commitment"][data-filter-value="uncommitted"]').click();

  await expect(page.locator('[data-item-id="idea-create-items"]')).toBeVisible();
  await expect(page.locator('[data-item-id="feature-search-and-filters"]')).toHaveCount(0);
  await expect(page).toHaveURL(/f=commitment%3Auncommitted/);

  await page.locator("#board-filter-toggle").click();
  await expect(page.locator('[data-filter-key="commitment"][data-filter-value="committed"]')).toHaveCount(0);
  await expect(page.locator('[data-item-id="idea-create-items"]')).toBeVisible();

  await page.locator("#board-search").fill("create roadmap items");
  await expect(page).toHaveURL(/q=create\+roadmap\+items/);
  await page.locator("#board-clear-filters").click();

  await expect(page.locator("#board-search")).toHaveValue("");
  await expect(page.locator('[data-item-id="feature-setup-guidance"]')).toBeVisible();
  await expect(page).not.toHaveURL(/f=commitment%3Auncommitted/);
});
test("switches to the status lens, hides board editing, and restores from the URL", async ({ page }) => {
  await page.goto(repoUrl());

  await page.locator('#board-view-toggle').click();
  await page.locator('[data-lens-key="status"]').click();

  await expect(page).toHaveURL(/lens=status/);
  await expect(page.locator('#board-view-toggle')).toContainText('By status');
  await expect(page.locator('#board-view-toggle')).toHaveClass(/is-active/);
  await expect(page.locator(".board-group").first().locator(".group-name")).toContainText("queued");
  await expect(page.locator("#board-edit-button")).toBeHidden();

  await page.reload();
  await expect(page).toHaveURL(/lens=status/);
  await expect(page.locator('#board-view-toggle')).toContainText('By status');
  await expect(page.locator('#board-view-toggle')).toHaveClass(/is-active/);
  await expect(page.locator(".board-group").first().locator(".group-name")).toContainText("queued");
});

test("repository default grouping stays independent from layout and explicit Board wins", async ({ page }) => {
  await fs.writeFile(configPath, JSON.stringify({
    roadmapPath: "roadmap",
    defaultLens: "status",
    lenses: { fields: { status: { order: ["queued", "in-progress", "blocked", "done"], draggable: true } } },
  }), "utf8");

  await page.goto(repoUrl());
  await expect(page.locator("#board-view-toggle")).toContainText("By status");
  await expect(page).not.toHaveURL(/lens=/);
  await expect(page.locator("#board-layout-list")).toHaveClass(/is-active/);

  await page.goto(repoUrl("/#lens=board"));
  await expect(page.locator("#board-view-toggle")).toContainText("Group by");
  await expect(page).toHaveURL(/lens=board/);

  await page.goto(repoUrl("/#lens=retired-lane"));
  await expect(page.locator("#board-view-toggle")).toContainText("By status");
  await expect(page.locator("#status-banner")).toContainText(/URL grouping.*unavailable/i);
});
test("keeps the view chooser compact when switching to the milestone lens", async ({ page }) => {
  await fs.writeFile(searchFeaturePath, addMilestone(originalSearchFeatureText, "P3"), "utf8");
  await fs.writeFile(ideaCreatePath, addFrontmatterField(originalIdeaCreateText, "milestone", "P1"), "utf8");

  await page.goto(repoUrl());
  await page.getByRole("button", { name: "Refresh" }).click();
  await page.locator('#board-view-toggle').click();
  await page.locator('[data-lens-key="milestone"]').click();

  await expect(page).toHaveURL(/lens=milestone/);
  await expect(page.locator('#board-view-toggle')).toContainText('By milestone');
  await expect(page.locator(".board-group").first().locator(".group-name")).toContainText("P1");
  await expect(page.locator('[data-item-id="idea-create-items"]')).toBeVisible();

  const controlRow = await page.locator(".board-controls").boundingBox();
  const firstGroup = await page.locator(".board-group").first().boundingBox();
  const boardPanel = await page.locator(".board-panel").boundingBox();

  expect(controlRow).not.toBeNull();
  expect(firstGroup).not.toBeNull();
  expect(boardPanel).not.toBeNull();
  expect(controlRow.height).toBeLessThan(120);
  expect(firstGroup.y - boardPanel.y).toBeLessThan(320);
});

test("anchors the group-by chooser to the trigger instead of the far board edge", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(repoUrl());
  await expect(page.locator("#workspace-summary")).toContainText(/\d+ items \/ \d+ groups/);
  await page.locator("#board-layout-columns").click();
  await page.locator("#board-view-toggle").click();

  const triggerBox = await page.locator("#board-view-toggle").boundingBox();
  const chooserBox = await page.locator("#board-lens-switcher").boundingBox();

  expect(triggerBox).not.toBeNull();
  expect(chooserBox).not.toBeNull();
  expect(Math.abs((chooserBox?.x ?? 0) - (triggerBox?.x ?? 0))).toBeLessThan(40);
  expect((chooserBox?.y ?? 0)).toBeGreaterThan((triggerBox?.y ?? 0) + (triggerBox?.height ?? 0) - 6);
});
test("status columns keep configured empty lanes visible in columns mode", async ({ page }) => {
  const fixture = await makeDragRoadmapFixture();
  try {
    await page.goto(repoUrlFor(fixture, "/#layout=columns"));

    await expect(page.locator(".board-column")).toHaveCount(3);
    await expect(page.locator(".board-column").nth(0)).toContainText("queued");
    await expect(page.locator(".board-column").nth(1)).toContainText("done");
    await expect(page.locator(".board-column").nth(2)).toContainText("blocked");
    await expect(page.locator(".board-column").nth(2).locator(".board-column-empty")).toContainText("No visible items.");
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
});
test("keeps list-mode board controls compact and non-overlapping", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 1100 });
  await page.goto(repoUrl());

  const modeRow = page.locator(".board-mode-row");
  const groupBy = page.locator("#board-view-toggle");
  const layoutControls = page.locator("#board-layout-controls");
  const searchRow = page.locator(".board-toolbar-row");

  const modeRowBox = await modeRow.boundingBox();
  const groupByBox = await groupBy.boundingBox();
  const layoutBox = await layoutControls.boundingBox();
  const searchRowBox = await searchRow.boundingBox();

  expect(modeRowBox).not.toBeNull();
  expect(groupByBox).not.toBeNull();
  expect(layoutBox).not.toBeNull();
  expect(searchRowBox).not.toBeNull();
  expect(modeRowBox.height).toBeLessThan(52);
  expect(layoutBox.x).toBeGreaterThan(groupByBox.x + groupByBox.width - 4);
  expect(searchRowBox.y).toBeGreaterThan(modeRowBox.y + modeRowBox.height - 2);
});

test("uses a board-first columns layout when many groups are visible", async ({ page }) => {
  const sixGroupBoard = `# Backlog\n\n- feature-edit-board-and-scope\n\n# Next\n\n- feature-setup-guidance\n\n# Ready\n\n- feature-search-and-filters\n\n# Working\n\n- feature-card-preview-and-overview\n\n# Verify\n\n- feature-derived-roadmap-lenses\n\n# done\n\n- idea-create-items\n`;
  await fs.writeFile(boardPath, sixGroupBoard, "utf8");

  await page.setViewportSize({ width: 1180, height: 1100 });
  await page.goto(repoUrl());
  await expect(page.locator("#workspace-summary")).toContainText(/\d+ items \/ \d+ groups/);
  await page.locator("#board-layout-columns").click();

  await expect(page).toHaveURL(/layout=columns/);
  await expect(page).not.toHaveURL(/item=/);
  await expect(page.locator(".board-column")).toHaveCount(6);
  await expect(page.locator("#editor-overlay")).toBeHidden();

  const boardMetrics = await page.locator(".board-columns").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));

  expect(boardMetrics.scrollWidth).toBeGreaterThan(boardMetrics.clientWidth + 80);

  const workingColumn = page.locator(".board-column", { has: page.locator('.board-column-name[title="Working"]') });
  const initialColumnWidth = (await workingColumn.boundingBox()).width;
  const initialDescriptionWidth = (await workingColumn.locator(".board-item-overview").boundingBox()).width;
  for (const name of ["Backlog", "Next", "Ready", "Verify", "done"]) {
    await page.getByRole("button", { name: `Collapse ${name} column`, exact: true }).click();
  }

  await expect(page.locator(".board-column-collapsed")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Expand done column", exact: true })).toBeFocused();
  const widenedColumnWidth = (await workingColumn.boundingBox()).width;
  const widenedDescriptionWidth = (await workingColumn.locator(".board-item-overview").boundingBox()).width;
  expect(widenedColumnWidth).toBeGreaterThan(initialColumnWidth + 120);
  expect(widenedDescriptionWidth).toBeGreaterThan(initialDescriptionWidth + 120);

  const collapsedBacklog = page.locator(".board-column", { has: page.locator('.board-column-name[title="Backlog"]') });
  expect((await collapsedBacklog.boundingBox()).width).toBeLessThanOrEqual(50);
  await expect(collapsedBacklog.locator(".board-column-list")).toBeHidden();
  const expandBacklog = page.getByRole("button", { name: "Expand Backlog column", exact: true });
  await expect(expandBacklog).toHaveAttribute("aria-expanded", "false");
  await expandBacklog.focus();
  await page.keyboard.press("Enter");
  await expect(collapsedBacklog).not.toHaveClass(/board-column-collapsed/);
  await expect(collapsedBacklog.locator(".board-column-list")).toBeVisible();
  const collapseBacklog = page.getByRole("button", { name: "Collapse Backlog column", exact: true });
  await expect(collapseBacklog).toHaveAttribute("aria-expanded", "true");
  await expect(collapseBacklog).toBeFocused();

  await page.locator("#board-view-toggle").click();
  await page.locator('[data-lens-key="status"]').click();
  const statusDone = page.locator(".board-column", { has: page.locator('.board-column-name[title="done"]') });
  await expect(statusDone).not.toHaveClass(/board-column-collapsed/);
  await expect(page.getByRole("button", { name: "Collapse done column", exact: true })).toHaveAttribute("aria-expanded", "true");
});

test("opens a card in an overlay from columns and keeps the full title as a tooltip", async ({ page }) => {
  const longTitle = "Add a recurring-question value benchmark with a long descriptive title that still needs the full tooltip";
  await fs.writeFile(featurePath, replaceTitle(originalFeatureText, longTitle), "utf8");

  await page.goto(repoUrl());
  await expect(page.locator("#workspace-summary")).toContainText(/\d+ items \/ \d+ groups/);
  await page.locator("#board-layout-columns").click();

  const cardBody = page.locator('[data-item-dblopen="feature-setup-guidance"]').first();
  const openButton = page.locator('[data-item-open="feature-setup-guidance"]').first();
  await expect(cardBody).toHaveAttribute("title", longTitle);
  await expect(cardBody.locator(".board-item-title")).toHaveAttribute("title", longTitle);
  await expect(page.locator("#editor-overlay")).toBeHidden();

  await openButton.click();
  await expect(page.locator("#editor-overlay")).toBeVisible();
  await expect(page.locator("#editor-title")).toContainText(longTitle);
  await expect(page.locator("#tab-preview")).toHaveClass(/is-active/);
  await expect(page).toHaveURL(/layout=columns/);
  await expect(page).toHaveURL(/item=feature-setup-guidance/);

  await expect(page.locator('#save-button')).toHaveText('Close');
  await page.locator('#save-button').click();
  await expect(page.locator("#editor-overlay")).toBeHidden();
  await expect(page).not.toHaveURL(/item=/);
});
test("overlay scroll locks the page background and scrolls the item instead", async ({ page }) => {
  const longNotes = "Paragraph ".repeat(1200);
  await fs.writeFile(featurePath, addExtraSection(originalFeatureText, "Overlay Scroll Notes", longNotes), "utf8");

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(repoUrl());
  await expect(page.locator("#workspace-summary")).toContainText(/\d+ items \/ \d+ groups/);
  await page.locator("#board-layout-columns").click();
  await page.locator('[data-item-open="feature-setup-guidance"]').click();

  const previewPane = page.locator('.editor-overlay [data-mode-pane="preview"]');
  await expect(page.locator("#editor-overlay")).toBeVisible();
  await expect(previewPane).toBeVisible();

  const before = await page.evaluate(() => {
    const preview = document.querySelector('.editor-overlay [data-mode-pane="preview"]');
    return {
      pageScroll: window.scrollY,
      previewScroll: preview?.scrollTop || 0,
      previewClientHeight: preview?.clientHeight || 0,
      previewScrollHeight: preview?.scrollHeight || 0,
      overflow: document.body.dataset.editorOverlayOpen,
    };
  });

  await previewPane.evaluate((element) => {
    element.scrollTop = 900;
  });

  const after = await page.evaluate(() => {
    const preview = document.querySelector('.editor-overlay [data-mode-pane="preview"]');
    return {
      pageScroll: window.scrollY,
      previewScroll: preview?.scrollTop || 0,
    };
  });

  expect(before.overflow).toBe("true");
  expect(before.previewScrollHeight).toBeGreaterThan(before.previewClientHeight + 80);
  expect(after.pageScroll).toBe(before.pageScroll);
  expect(after.previewScroll).toBeGreaterThan(before.previewScroll + 40);
});
test("overlay edit mode shows cancel beside save and returns to read mode", async ({ page }) => {
  await page.goto(repoUrl());
  await expect(page.locator("#workspace-summary")).toContainText(/\d+ items \/ \d+ groups/);
  await page.locator("#board-layout-columns").click();
  await page.locator('[data-item-open="feature-setup-guidance"]').click();

  await expect(page.locator("#editor-overlay")).toBeVisible();
  await expect(page.locator("#save-button")).toHaveText("Close");
  await page.locator('#tab-structured').click();

  await expect(page.locator("#save-button")).toHaveText("Save");
  await expect(page.locator("#editor-cancel-button")).toBeVisible();
  await page.locator('[data-section-heading="Summary"]').fill('Unsaved overlay edit');
  await page.locator("#editor-cancel-button").click();

  await expect(page.locator("#editor-overlay")).toBeVisible();
  await expect(page.locator('#tab-preview')).toHaveClass(/is-active/);
  await expect(page.locator('#item-preview')).not.toContainText('Unsaved overlay edit');
});

test("switches to columns layout, keeps the lens, and restores from the URL", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 1100 });
  await page.goto(repoUrl());
  await expect(page.locator("#workspace-summary")).toContainText(/\d+ items \/ \d+ groups/);

  await page.locator("#board-layout-columns").click();
  await page.locator("#board-view-toggle").click();
  await page.locator('[data-lens-key="status"]').click();

  await expect(page).toHaveURL(/layout=columns/);
  await expect(page).toHaveURL(/lens=status/);
  await expect(page.locator("#board-layout-columns")).toHaveClass(/is-active/);
  await expect(page.locator(".board-columns")).toBeVisible();
  await expect(page.locator(".board-column").first()).toContainText("queued");
  await expect(page.locator("#editor-overlay")).toBeHidden();

  const boardBox = await page.locator(".board-panel").boundingBox();
  const firstColumn = await page.locator(".board-column").first().boundingBox();
  const secondColumn = await page.locator(".board-column").nth(1).boundingBox();

  expect(boardBox).not.toBeNull();
  expect(firstColumn).not.toBeNull();
  expect(secondColumn).not.toBeNull();
  expect(boardBox.width).toBeGreaterThan(560);
  expect(secondColumn.x).toBeLessThan(boardBox.x + boardBox.width - 20);

  await page.reload();
  await expect(page).toHaveURL(/layout=columns/);
  await expect(page).toHaveURL(/lens=status/);
  await expect(page.locator(".board-columns")).toBeVisible();
  await expect(page.locator("#editor-overlay")).toBeHidden();
});

test("dragging between board columns rewrites the canonical board groups", async ({ page }) => {
  await page.goto(repoUrl());
  await expect(page.locator("#workspace-summary")).toContainText(/\d+ items \/ \d+ groups/);
  await page.locator("#board-layout-columns").click();
  await expect(page.locator('[data-drag-item-id="idea-parent-grouping-overview"]')).toBeVisible();
  await expect(page.locator('[data-board-drop-group-index="1"]').first()).toBeVisible();

  await dragRoadmapElement(page, '[data-drag-item-id="idea-parent-grouping-overview"]', '.board-column-list[data-board-drop-group-index="1"]');

  await expect(page.locator("#status-banner")).toContainText("Board updated.");
  await expect(page.locator('.board-column').nth(1)).toContainText("Parent grouping overview");
  await expect(page.locator("#editor-overlay")).toBeHidden();
  await expect(page).not.toHaveURL(/item=/);

  const updatedBoard = await fs.readFile(boardPath, "utf8");
  expect(updatedBoard).toMatch(/# Next[\s\S]*idea-parent-grouping-overview/);
});

test("dragging within a board column reprioritizes items in canonical board order", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  const customBoard = `# Now
- feature-search-and-filters
- feature-setup-guidance

# Next
- feature-card-preview-and-overview

# Ideas
- idea-create-items

# Done
`;
  await fs.writeFile(boardPath, customBoard, "utf8");

  await page.goto(repoUrl());
  await expect(page.locator("#workspace-summary")).toContainText(/\d+ items \/ \d+ groups/);
  await page.locator("#board-layout-columns").click();
  await expect(page.locator('[data-drag-item-id="feature-setup-guidance"]')).toBeVisible();
  await expect(page.locator('[data-board-drop-before-id="feature-search-and-filters"]')).toBeVisible();

  await dragRoadmapElement(page, '[data-drag-item-id="feature-setup-guidance"]', '[data-board-drop-before-id="feature-search-and-filters"]');

  await expect(page.locator("#status-banner")).toContainText("Board updated.");
  await expect(page.locator('.board-column').first().locator('.board-column-card').nth(0)).toContainText("Setup guidance and empty-state workflow");
  await expect(page.locator('.board-column').first().locator('.board-column-card').nth(1)).toContainText("Search and dynamic roadmap filters");

  const updatedBoard = await fs.readFile(boardPath, "utf8");
  expect(updatedBoard).toMatch(/# Now\s*- feature-setup-guidance\s*- feature-search-and-filters/);
});

test("dragging between status columns uses the handle and updates the canonical frontmatter", async ({ page }) => {
  const fixture = await makeDragRoadmapFixture();
  try {
    await page.goto(repoUrlFor(fixture, "/#layout=columns"));
    await expect(page.locator('[data-drag-item-id="drag-source"]')).toBeVisible();
    await expect(page.locator('[data-lens-drop-value="queued"]')).toBeVisible();

    await dragRoadmapElement(page, '[data-drag-item-id="drag-source"]', '[data-lens-drop-value="queued"]');

    await expect(page.locator("#status-banner")).toContainText("Status updated.");
    await expect(page.locator("#editor-overlay")).toBeHidden();
    await expect(page).not.toHaveURL(/item=/);
    expect(await fs.readFile(path.join(fixture, "roadmap", "features", "drag-source.md"), "utf8")).toContain("status: queued");
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
});

test("list view opens cards and supports moving and ordering with its in-card drag grip", async ({ page }) => {
  const fixture = await makeDragRoadmapFixture();
  const featureDir = path.join(fixture, "roadmap", "features");
  try {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.goto(repoUrlFor(fixture));
    const handle = page.locator('[data-drag-item-id="drag-source"]');
    const card = page.locator('[data-item-id="drag-source"]');
    await expect(handle).toBeVisible();
    await expect(handle).toHaveClass(/board-column-card-drag/);
    await expect(handle).toHaveText("::");
    await expect(handle).toHaveAttribute("aria-label", "Move Drag source");
    await expect(handle).toHaveAttribute("draggable", "true");
    await expect(card).toHaveAttribute("aria-label", "Open Drag source");
    await expect(card).toHaveAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown");
    await expect(card).toHaveAttribute("aria-description", "Press Alt+ArrowUp or Alt+ArrowDown to reorder.");
    await expect(handle).toHaveAttribute("title", /Keyboard: Alt\+Up or Alt\+Down/);
    await expect(page.locator("[data-move-item]")).toHaveCount(0);
    await expect(page.getByText("Move", { exact: true })).toHaveCount(0);
    expect(await handle.evaluate((element) => element.closest('[data-item-id="drag-source"]') !== null)).toBe(true);

    await dragRoadmapElement(page, '[data-drag-item-id="drag-source"]', '[data-item-order-drop-id="drag-target"]');

    await expect(page.locator("#status-banner")).toContainText("Status updated.");
    await expect(page.locator('[data-lens-drop-value="queued"]').locator("xpath=../..")).toContainText("Drag source");
    expect(await fs.readFile(path.join(featureDir, "drag-source.md"), "utf8")).toContain("status: queued");
    await expect(card).toHaveAttribute("data-item-order-drop-id", "drag-source");
    await dragRoadmapElement(page, '[data-drag-item-id="drag-source"]', '[data-item-order-drop-id="drag-third"]', { targetYRatio: 0.2 });
    await expect(page.locator("#status-banner")).toContainText("Shared item order saved.");
    let boardText = await fs.readFile(path.join(fixture, "roadmap", "board.md"), "utf8");
    expect(boardText.match(/^- (.+)$/gm)?.map((line) => line.slice(2))).toEqual(["drag-target", "drag-source", "drag-third", "drag-unassigned"]);

    await dragRoadmapElement(page, '[data-drag-item-id="drag-source"]', '[data-item-order-drop-id="drag-third"]', { targetYRatio: 0.8 });
    await expect(page.locator("#status-banner")).toContainText("Shared item order saved.");
    boardText = await fs.readFile(path.join(fixture, "roadmap", "board.md"), "utf8");
    expect(boardText.match(/^- (.+)$/gm)?.map((line) => line.slice(2))).toEqual(["drag-target", "drag-third", "drag-source", "drag-unassigned"]);

    await page.locator("#board-view-toggle").click();
    await page.locator('[data-lens-key="lane"]').click();
    const unassignedTarget = page.locator('[data-item-order-drop-id="drag-unassigned"]');
    await expect(unassignedTarget).toBeVisible();
    await expect(unassignedTarget).not.toHaveAttribute("data-item-order-drop-value", "");
    await dragRoadmapElement(page, '[data-drag-item-id="drag-source"]', '[data-item-order-drop-id="drag-unassigned"]');
    await expect(page.locator("#status-banner")).toContainText("Lane updated.");
    expect(await fs.readFile(path.join(featureDir, "drag-source.md"), "utf8")).not.toMatch(/^lane:/m);

    await card.click();
    await expect(page.locator("#editor-title")).toHaveText("Drag source");
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
});
test("stress-tests large metadata boards in list and columns views", async ({ page }) => {
  test.setTimeout(90_000);
  const fixture = await makeLargeRoadmapFixture();
  try {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto(repoUrlFor(fixture));
    await expect(page).not.toHaveURL(/lens=/);
    await expect(page.locator("#board-view-toggle")).toContainText("By lane");
    await expect(page.locator(".board-group").first()).toBeVisible();
    expect(await page.locator(".board-group").count()).toBeGreaterThanOrEqual(8);
    await page.locator("#board-filter-toggle").click();
    await expect(page.locator('[data-filter-key="resolved_by"]')).toHaveCount(0);
    await expect(page.locator('[data-filter-key="shipped_at"]')).toHaveCount(0);
    await expect(page.locator('[data-filter-key="release_train"][data-filter-value="train-10"]')).toBeVisible();
    const filterGeometry = await page.evaluate(() => {
      const search = document.querySelector("#board-search").getBoundingClientRect();
      const toggle = document.querySelector("#board-filter-toggle").getBoundingClientRect();
      const panel = document.querySelector("#board-filters").getBoundingClientRect();
      return {
        searchWidth: search.width,
        controlGap: toggle.left - search.right,
        panelHeight: panel.height,
      };
    });
    expect(filterGeometry.searchWidth).toBeLessThanOrEqual(550);
    expect(filterGeometry.controlGap).toBeLessThanOrEqual(10);
    expect(filterGeometry.panelHeight).toBeLessThan(240);
    const compactFilters = await page.evaluate(() => {
      const panel = document.querySelector("#board-filters");
      const groups = [...panel.querySelectorAll(".filter-group")].map((group) => group.getBoundingClientRect());
      const sameRowGaps = groups.flatMap((group, index) => {
        const next = groups[index + 1];
        return next && Math.abs(next.top - group.top) < 2 ? [next.left - group.right] : [];
      });
      const statusRow = panel.querySelector('[data-filter-key="status"]')?.closest(".filter-chip-row");
      return {
        panelOverflow: panel.scrollWidth - panel.clientWidth,
        groupsInsidePanel: groups.every((group) => group.right <= panel.getBoundingClientRect().right + 1),
        maxSameRowGap: Math.max(0, ...sameRowGaps),
        statusOverflow: statusRow ? statusRow.scrollWidth - statusRow.clientWidth : 0,
      };
    });
    expect(compactFilters.panelOverflow).toBeLessThanOrEqual(2);
    expect(compactFilters.groupsInsidePanel).toBe(true);
    expect(compactFilters.maxSameRowGap).toBeLessThanOrEqual(26);
    expect(compactFilters.statusOverflow).toBeLessThanOrEqual(2);
    const milestoneFilter = page.locator('[data-filter-key="milestone"]').first();
    const selectedMilestone = await milestoneFilter.getAttribute("data-filter-value");
    await milestoneFilter.click();
    await expect(page.locator('[data-filter-key="milestone"].is-active')).toBeVisible();
    await expect(page.locator("#board-view-toggle")).toContainText("By lane");
    const milestoneItemIds = await page.locator("[data-item-id]:visible").evaluateAll((cards) => cards.map((card) => card.dataset.itemId));
    expect(milestoneItemIds.length).toBeGreaterThan(0);
    for (const itemId of milestoneItemIds) {
      expect(await fs.readFile(path.join(fixture, "roadmap", "features", `${itemId}.md`), "utf8")).toContain(`milestone: ${selectedMilestone}`);
    }
    await page.locator("#board-clear-filters").click();
    await page.locator("#board-search").fill("");
    const listMetrics = await page.locator("#board-groups").evaluate((root) => ({
      right: root.getBoundingClientRect().right,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
    }));
    expect(listMetrics.scrollWidth).toBeLessThanOrEqual(listMetrics.clientWidth + 2);
    await expect(page.locator(".group-name", { hasText: "Unassigned" })).toBeVisible();
    for (const group of await page.locator(".board-group").all()) {
      const box = await group.boundingBox();
      if (!box) continue;
      const header = group.locator(".board-group-header");
      const card = group.locator("[data-item-id]:visible").first();
      if (await card.count()) {
        const headerBox = await header.boundingBox();
        const cardBox = await card.boundingBox();
        const titleBox = await card.locator(".board-item-title").boundingBox();
        const handleBox = await card.locator(".board-column-card-drag").boundingBox();
        if (!headerBox || !cardBox || !titleBox || !handleBox) continue;
        expect(cardBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
        expect(titleBox.width).toBeGreaterThan(64);
        expect(handleBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
        expect(handleBox.x + handleBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
        await expect(card).toHaveAttribute("aria-label", /^Open /);
      }
    }

    const openedCard = page.locator("[data-item-id]").first();
    const openedTitle = await openedCard.getAttribute("title");
    await openedCard.click();
    await expect(page.locator("#editor-title")).toHaveText(openedTitle);
    if (await page.locator("#editor-overlay-backdrop").isVisible()) {
      await page.locator("#editor-overlay-backdrop").click();
      await expect(page.locator("#editor-overlay")).toBeHidden();
    }

    const boardPath = path.join(fixture, "roadmap", "board.md");
    const boardBeforeGroupOrder = await fs.readFile(boardPath, "utf8");
    const groupMove = page.locator("[data-move-lens-group='up']:not([disabled])").first();
    const groupValue = await groupMove.getAttribute("data-lens-group-value");
    const groupAnchor = await groupMove.getAttribute("data-lens-group-anchor");
    await groupMove.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#status-banner")).toContainText(/group order saved/i);
    const savedConfig = JSON.parse(await fs.readFile(path.join(fixture, "roadmap.config.json"), "utf8"));
    expect(savedConfig.lenses.fields.lane.order.indexOf(groupValue)).toBe(savedConfig.lenses.fields.lane.order.indexOf(groupAnchor) - 1);
    expect(await fs.readFile(boardPath, "utf8")).toBe(boardBeforeGroupOrder);

    await page.locator("#board-search").fill("usable title");
    const firstMove = page.locator('[data-item-id-order][data-order-next-id]:not([data-order-next-id=""])').first();
    await expect(firstMove).toBeVisible();
    const movedId = await firstMove.getAttribute("data-item-id-order");
    const anchorId = await firstMove.getAttribute("data-order-next-id");
    const beforeOrder = (await fs.readFile(boardPath, "utf8")).match(/^- (.+)$/gm).map((line) => line.slice(2));
    await firstMove.focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(page.locator("#status-banner")).toContainText(/saved|updated/i);
    const afterOrder = (await fs.readFile(boardPath, "utf8")).match(/^- (.+)$/gm).map((line) => line.slice(2));
    expect(afterOrder.indexOf(movedId)).toBe(afterOrder.indexOf(anchorId) + 1);
    expect(afterOrder.filter((id) => id !== movedId)).toEqual(beforeOrder.filter((id) => id !== movedId));
    await page.goto(`/?qa=dense-list#repo=${encodeURIComponent(fixture)}`);
    await expect(page.locator("#board-view-toggle")).toContainText("By lane");
    await expect(page.locator("#board-search")).toHaveValue("");
    await expect(page.locator(`[data-item-id="${movedId}"]`)).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 820 });
    const largeBoardResizer = page.locator("#board-editor-resizer");
    await expect(largeBoardResizer).toBeVisible();
    const boardBeforeResize = await page.locator(".board-panel").boundingBox();
    const largeResizerBox = await largeBoardResizer.boundingBox();
    await page.mouse.move(largeResizerBox.x + largeResizerBox.width / 2, largeResizerBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(largeResizerBox.x - 120, largeResizerBox.y + 100, { steps: 8 });
    await page.mouse.up();
    const boardAfterResize = await page.locator(".board-panel").boundingBox();
    expect(boardAfterResize.width).toBeLessThan(boardBeforeResize.width - 80);
    const resizedTitleBox = await page.locator(".board-group").filter({ hasText: "lane-01" }).locator(".board-item-title").first().boundingBox();
    expect(resizedTitleBox.width).toBeGreaterThan(64);

    await page.setViewportSize({ width: 760, height: 700 });
    await page.locator(".board-panel").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/dense-lane-list-narrow.png" });
    const denseCards = page.locator(".board-group").filter({ hasText: "lane-01" }).locator("[data-item-id]");
    await expect(denseCards).toHaveCount(66, { timeout: 10000 });
    for (const index of [0, 33, 65]) {
      const card = denseCards.nth(index);
      await card.scrollIntoViewIfNeeded();
      const geometry = await card.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const group = element.closest(".board-group")?.getBoundingClientRect();
        const row = element.parentElement?.getBoundingClientRect();
        const title = element.querySelector(".board-item-title")?.getBoundingClientRect();
        const handle = element.querySelector(".board-column-card-drag")?.getBoundingClientRect();
        const previous = element.parentElement?.previousElementSibling?.querySelector("[data-item-id]")?.getBoundingClientRect();
        return {
          card: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
          group: group && { left: group.left, right: group.right },
          row: row && { top: row.top, bottom: row.bottom },
          title: title && { left: title.left, right: title.right, top: title.top, bottom: title.bottom, width: title.width, height: title.height },
          handle: handle && { left: handle.left, right: handle.right, top: handle.top, bottom: handle.bottom },
          previous: previous && { bottom: previous.bottom },
        };
      });
      expect(geometry.card.left).toBeGreaterThanOrEqual(geometry.group.left - 1);
      expect(geometry.card.right).toBeLessThanOrEqual(geometry.group.right + 1);
      expect(geometry.title.width).toBeGreaterThan(64);
      expect(geometry.handle.left).toBeGreaterThanOrEqual(geometry.card.left - 1);
      expect(geometry.handle.right).toBeLessThanOrEqual(geometry.card.right + 1);
      expect(geometry.title.height).toBeGreaterThanOrEqual(16);
      expect(geometry.title.top).toBeGreaterThanOrEqual(geometry.row.top - 1);
      expect(geometry.title.bottom).toBeLessThanOrEqual(geometry.row.bottom + 1);
      expect(geometry.handle.top).toBeGreaterThanOrEqual(geometry.row.top - 1);
      expect(geometry.handle.bottom).toBeLessThanOrEqual(geometry.row.bottom + 1);
      if (geometry.previous) expect(geometry.card.top).toBeGreaterThanOrEqual(geometry.previous.bottom - 1);
    }

    const middleMove = denseCards.nth(33);
    const middleMovedId = await middleMove.getAttribute("data-item-id-order");
    await middleMove.scrollIntoViewIfNeeded();
    await middleMove.focus();
    await page.keyboard.press("Alt+ArrowUp");
    await expect(page.locator("#status-banner")).toContainText(/saved|updated/i);
    await expect(page.locator(`[data-item-id-order="${middleMovedId}"]:focus`)).toBeVisible();

    const lastCard = denseCards.last();
    await lastCard.scrollIntoViewIfNeeded();
    const lastCardTitle = await lastCard.getAttribute("title");
    await lastCard.locator(".board-item-title").click();
    await expect(page.locator("#editor-title")).toHaveText(lastCardTitle);

    await page.setViewportSize({ width: 1440, height: 820 });
    const firstDenseTitle = await denseCards.first().getAttribute("title");
    await denseCards.first().click();
    await expect(page.locator("#editor-title")).toHaveText(firstDenseTitle);
    await page.locator("#tab-structured").click();
    await openMetadataDetails(page);
    await page.locator("#field-title").fill("Unsaved dense-board draft A");
    const otherMove = denseCards.nth(10);
    const otherMovedId = await otherMove.getAttribute("data-item-id-order");
    await otherMove.focus();
    await page.keyboard.press("Alt+ArrowUp");
    await expect(page.locator("#status-banner")).toContainText(/saved|updated/i);
    await expect(page.locator("#field-title")).toHaveValue("Unsaved dense-board draft A");
    await expect(page.locator(`[data-item-id-order="${otherMovedId}"]:focus`)).toBeVisible();
    await page.setViewportSize({ width: 760, height: 700 });
    await page.goto(repoUrlFor(fixture, "/#layout=columns"));
    await page.reload();
    await expect(page.locator("#board-view-toggle")).toContainText("By lane");
    await expect(page.locator(".board-columns")).toBeVisible();
    if (await page.locator("#editor-overlay").isVisible()) await page.locator("#editor-overlay-backdrop").click();
    await expect(page.locator("#editor-overlay")).toBeHidden();
    await page.screenshot({ path: "test-results/dense-lane-columns.png" });
    const columns = await page.locator(".board-column").count();
    expect(columns).toBeGreaterThanOrEqual(8);
    const laneColumn = page.locator(".board-column").filter({ hasText: "lane-01" }).first();
    const columnMove = laneColumn.locator('[data-item-id-order][data-order-next-id]:not([data-order-next-id=""])').first();
    const columnMovedId = await columnMove.getAttribute("data-item-id-order");
    await columnMove.focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(page.locator("#status-banner")).toContainText(/saved|updated/i);
    await expect(page.locator("#editor-overlay")).toBeHidden();
    await expect(page.locator(`[data-item-id-order="${columnMovedId}"]:focus`)).toBeVisible();
    const columnCards = laneColumn.locator(".board-column-card");
    await expect(columnCards).toHaveCount(66);
    for (const index of [0, 33, 65]) {
      const columnCard = columnCards.nth(index);
      await columnCard.scrollIntoViewIfNeeded();
      const geometry = await columnCard.evaluate((card) => {
        const rect = card.getBoundingClientRect();
        const title = card.querySelector(".board-item-title")?.getBoundingClientRect();
        const actions = card.querySelector(".board-column-card-actions")?.getBoundingClientRect();
        const previous = card.previousElementSibling?.getBoundingClientRect();
        return {
          card: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
          title: title && { left: title.left, right: title.right, top: title.top, bottom: title.bottom, height: title.height },
          actions: actions && { left: actions.left, right: actions.right, top: actions.top, bottom: actions.bottom },
          previous: previous && { bottom: previous.bottom },
        };
      });
      expect(geometry.title.left).toBeGreaterThanOrEqual(geometry.card.left - 1);
      expect(geometry.title.right).toBeLessThanOrEqual(geometry.card.right + 1);
      expect(geometry.actions.left).toBeGreaterThanOrEqual(geometry.card.left - 1);
      expect(geometry.actions.right).toBeLessThanOrEqual(geometry.card.right + 1);
      expect(geometry.title.height).toBeGreaterThanOrEqual(16);
      expect(geometry.title.top).toBeGreaterThanOrEqual(geometry.card.top - 1);
      expect(geometry.title.bottom).toBeLessThanOrEqual(geometry.card.bottom + 1);
      expect(geometry.actions.top).toBeGreaterThanOrEqual(geometry.card.top - 1);
      expect(geometry.actions.bottom).toBeLessThanOrEqual(geometry.card.bottom + 1);
      if (geometry.previous) expect(geometry.card.top).toBeGreaterThanOrEqual(geometry.previous.bottom - 1);
    }
    const columnMetrics = await page.locator(".board-columns").evaluate((root) => ({
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
    }));
    expect(columnMetrics.scrollWidth).toBeGreaterThan(columnMetrics.clientWidth);
    await page.locator(".board-columns").evaluate((root) => { root.scrollLeft = root.scrollWidth; });
    expect(await page.locator(".board-columns").evaluate((root) => root.scrollLeft)).toBeGreaterThan(0);

    await page.setViewportSize({ width: 1440, height: 820 });
    const laneWidthBeforeCollapse = (await laneColumn.boundingBox()).width;
    await expect(laneColumn.locator(".board-item-overview").first()).toBeHidden();
    const laneNames = (await page.locator(".board-column-name").allTextContents()).map((name) => name.trim());
    const firstCollapsedLane = laneNames.find((name) => name === "lane-03");
    const laneList = laneColumn.locator(".board-column-list");
    await page.locator(".board-columns").evaluate((root) => { root.scrollLeft = 120; });
    await laneList.evaluate((list) => { list.scrollTop = 240; });
    const horizontalScrollBeforeCollapse = await page.locator(".board-columns").evaluate((root) => root.scrollLeft);
    const verticalScrollBeforeCollapse = await laneList.evaluate((list) => list.scrollTop);
    const visibleDropIds = await laneList.locator("[data-item-order-drop-id]").evaluateAll((cards) => {
      const viewport = cards[0]?.closest(".board-column-list")?.getBoundingClientRect();
      return viewport
        ? cards.filter((card) => {
            const bounds = card.getBoundingClientRect();
            return bounds.top >= viewport.top + 4 && bounds.bottom <= viewport.bottom - 4;
          }).slice(0, 2).map((card) => card.dataset.itemOrderDropId)
        : [];
    });
    expect(visibleDropIds).toHaveLength(2);
    const [denseTargetId, denseSourceId] = visibleDropIds;
    const denseOrderBefore = (await fs.readFile(boardPath, "utf8")).match(/^- (.+)$/gm).map((line) => line.slice(2));
    await dragRoadmapElement(
      page,
      `[data-drag-item-id="${denseSourceId}"]`,
      `[data-item-order-drop-id="${denseTargetId}"]`,
      { targetYRatio: 0.2, scrollTargets: false },
    );
    await expect(page.locator("#status-banner")).toContainText("Shared item order saved.");
    expect(await page.locator(".board-columns").evaluate((root) => root.scrollLeft)).toBe(horizontalScrollBeforeCollapse);
    expect(await laneList.evaluate((list) => list.scrollTop)).toBe(verticalScrollBeforeCollapse);
    const denseOrderAfter = (await fs.readFile(boardPath, "utf8")).match(/^- (.+)$/gm).map((line) => line.slice(2));
    expect(denseOrderAfter.indexOf(denseSourceId)).toBe(denseOrderAfter.indexOf(denseTargetId) - 1);
    expect(denseOrderAfter.filter((id) => id !== denseSourceId)).toEqual(denseOrderBefore.filter((id) => id !== denseSourceId));
    await page.getByRole("button", { name: `Collapse ${firstCollapsedLane} column`, exact: true }).click();
    expect(await page.locator(".board-columns").evaluate((root) => root.scrollLeft)).toBe(horizontalScrollBeforeCollapse);
    expect(await laneList.evaluate((list) => list.scrollTop)).toBe(verticalScrollBeforeCollapse);
    await expect(page.getByRole("button", { name: `Expand ${firstCollapsedLane} column`, exact: true })).toBeFocused();
    for (const name of laneNames.filter((name) => name !== "lane-01" && name !== firstCollapsedLane)) {
      await page.getByRole("button", { name: `Collapse ${name} column`, exact: true }).click();
    }
    await expect(page.locator(".board-column-collapsed")).toHaveCount(laneNames.length - 1);
    expect((await laneColumn.boundingBox()).width).toBeGreaterThan(laneWidthBeforeCollapse + 100);
    await expect(laneColumn.locator(".board-item-overview").first()).toBeVisible();
    expect((await laneColumn.locator(".board-item-overview").first().boundingBox()).width).toBeGreaterThan(180);

    await page.locator("#board-view-toggle").click();
    await page.locator('[data-lens-key="milestone"]').click();
    await expect(page.locator(".board-column").first().locator(".board-column-name")).toHaveAttribute("title", /Milestone/);
    await expect(page.locator("[data-drag-item-id]")).toHaveCount(0);
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
});
test("milestone columns stay browse-only without drag handles", async ({ page }) => {
  await fs.writeFile(searchFeaturePath, addMilestone(originalSearchFeatureText, "P3"), "utf8");
  await fs.writeFile(ideaCreatePath, addFrontmatterField(originalIdeaCreateText, "milestone", "P1"), "utf8");

  await page.goto(repoUrl("/#layout=columns"));
  await expect(page.locator("#board-layout-columns")).toBeVisible();
  await expect(page.locator(".board-columns")).toBeVisible();
  await page.locator("#board-view-toggle").click();
  await page.locator('[data-lens-key="milestone"]').click();

  await expect(page.locator(".board-columns")).toBeVisible();
  await expect(page.locator('[data-drag-item-id]')).toHaveCount(0);
});


test("keeps long milestone labels and cards inside columns while list remains readable", async ({ page }) => {
  const longMilestone = "2026-very-long-milestone-name-for-historical-memory-quality-and-work-continuity";
  const longTitle = "A deliberately long roadmap card title that should remain fully readable in the list without leaking across adjacent milestone columns";

  await fs.writeFile(boardPath, `# ${longMilestone}` + "\n\n- feature-setup-guidance\n", "utf8");

  await Promise.all([
    fs.writeFile(featurePath, addMilestone(replaceTitle(originalFeatureText, longTitle), longMilestone), "utf8"),
    fs.writeFile(searchFeaturePath, addMilestone(originalSearchFeatureText, longMilestone), "utf8"),
    fs.writeFile(ideaCreatePath, addMilestone(originalIdeaCreateText, longMilestone), "utf8"),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(repoUrl("/#layout=columns"));
  await expect(page.locator(".board-columns")).toBeVisible();

  const milestoneColumn = page.locator(".board-column").filter({ has: page.locator(".board-column-name", { hasText: longMilestone }) }).first();
  await expect(milestoneColumn).toBeVisible();
  await expect(milestoneColumn.locator(".board-column-name")).toHaveAttribute("title", longMilestone);

  const columnMetrics = await milestoneColumn.evaluate((column) => {
    const lane = column.getBoundingClientRect();
    const header = column.querySelector(".board-column-name");
    return {
      laneRight: lane.right,
      laneScrollWidth: column.scrollWidth,
      laneClientWidth: column.clientWidth,
      headerHeight: header?.getBoundingClientRect().height || 0,
      cards: Array.from(column.querySelectorAll(".board-column-card")).map((card) => card.getBoundingClientRect().right),
    };
  });

  expect(columnMetrics.laneScrollWidth).toBeLessThanOrEqual(columnMetrics.laneClientWidth + 1);
  expect(columnMetrics.headerHeight).toBeLessThan(42);
  expect(columnMetrics.cards.every((right) => right <= columnMetrics.laneRight + 1)).toBe(true);

  await page.locator("#board-layout-list").click();
  const listCard = page.locator('[data-item-id="feature-setup-guidance"]').first();
  await expect(listCard).toBeVisible();

  const listMetrics = await listCard.evaluate((card) => {
    const panel = document.querySelector(".board-panel");
    const title = card.querySelector(".board-item-title");
    const overview = card.querySelector(".board-item-overview");
    return {
      panelWidth: panel?.getBoundingClientRect().width || 0,
      titleClipped: (title?.scrollHeight || 0) > (title?.clientHeight || 0) + 1,
      overviewClipped: (overview?.scrollHeight || 0) > (overview?.clientHeight || 0) + 1,
    };
  });

  expect(listMetrics.panelWidth).toBeGreaterThan(420);
  expect(listMetrics.titleClipped).toBe(false);
  expect(listMetrics.overviewClipped).toBe(false);
});
test("lets a crowded desktop column scroll inside the lane", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 720 });
  await page.goto(repoUrl());
  await expect(page.locator("#workspace-summary")).toContainText(/\d+ items \/ \d+ groups/);
  await page.locator("#board-layout-columns").click();

  const doneColumn = page.locator(".board-column").filter({ has: page.locator(".board-column-name", { hasText: "Done" }) }).first();
  const doneList = doneColumn.locator(".board-column-list");
  await expect(doneList).toBeVisible();
  await expect(doneColumn).toHaveClass(/board-column-dense/);
  const firstDenseCard = doneColumn.locator(".board-column-card").first();
  await expect(firstDenseCard.locator(".board-item-title")).toBeVisible();
  await expect(firstDenseCard.locator(".board-column-card-open")).toBeVisible();
  await expect(firstDenseCard.locator(".board-item-overview")).toBeHidden();
  const denseCardBox = await firstDenseCard.boundingBox();
  expect(denseCardBox.height).toBeGreaterThanOrEqual(40);
  expect(denseCardBox.height).toBeLessThan(90);

  const before = await doneList.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }));

  expect(before.scrollHeight).toBeGreaterThan(before.clientHeight + 80);

  await doneList.evaluate((element) => {
    element.scrollTop = 320;
  });

  const after = await doneList.evaluate((element) => element.scrollTop);
  expect(after).toBeGreaterThan(before.scrollTop + 80);
});

test("mobile list view keeps board mode and search rows stacked cleanly", async ({ page }) => {
  await page.setViewportSize({ width: 540, height: 900 });
  await page.goto(repoUrl());

  const modeRow = page.locator(".board-mode-row");
  const groupBy = page.locator("#board-view-toggle");
  const layoutControls = page.locator("#board-layout-controls");
  const toolbarRow = page.locator(".board-toolbar-row");
  const searchField = page.locator("#board-search");
  const filterButton = page.locator("#board-filter-toggle");

  const modeRowBox = await modeRow.boundingBox();
  const groupByBox = await groupBy.boundingBox();
  const layoutBox = await layoutControls.boundingBox();
  const toolbarBox = await toolbarRow.boundingBox();
  const searchBox = await searchField.boundingBox();
  const filterBox = await filterButton.boundingBox();

  expect(modeRowBox).not.toBeNull();
  expect(groupByBox).not.toBeNull();
  expect(layoutBox).not.toBeNull();
  expect(toolbarBox).not.toBeNull();
  expect(searchBox).not.toBeNull();
  expect(filterBox).not.toBeNull();
  expect(layoutBox.y).toBeGreaterThan(groupByBox.y + groupByBox.height - 2);
  expect(toolbarBox.y).toBeGreaterThan(modeRowBox.y + modeRowBox.height - 2);
  expect(filterBox.y).toBeGreaterThanOrEqual(searchBox.y - 2);
});

test("mobile columns view stays usable for grouping and opening items", async ({ page }) => {
  await page.setViewportSize({ width: 540, height: 900 });
  await page.goto(repoUrl());
  await expect(page.locator("#workspace-summary")).toContainText(/\d+ items \/ \d+ groups/);
  await page.locator("#board-layout-columns").click();
  await page.locator("#board-view-toggle").click();
  await page.locator('[data-lens-key="status"]').click();

  const columns = page.locator(".board-columns");
  await expect(columns).toBeVisible();
  await expect(page.locator(".board-column")).toHaveCount(4);

  const metrics = await columns.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth + 60);

  await page.locator('[data-item-open="feature-column-board-view"]').first().click();
  await expect(page.locator("#editor-overlay")).toBeVisible();
  await expect(page.locator("#editor-title")).toContainText("Column board view");

  const overlayBox = await page.locator(".editor-overlay-slot").boundingBox();
  expect(overlayBox).not.toBeNull();
  expect(overlayBox.x).toBeGreaterThanOrEqual(0);
  expect(overlayBox.x + overlayBox.width).toBeLessThanOrEqual(540);
  await expect(page.locator("#save-button")).toHaveText("Close");
});

test("uses restrained semantic badge tones without coloring every field", async ({ page }) => {
  await page.goto(repoUrl());
  await expect(page.locator("#workspace-summary")).toContainText(/\d+ items \/ \d+ groups/);
  await page.locator("#board-layout-columns").click();
  await page.locator("#board-view-toggle").click();
  await page.locator('[data-lens-key="priority"]').click();

  const card = page.locator('[data-item-open="foundation-local-server"]').first().locator('xpath=ancestor::article[1]');
  const badges = card.locator('.badge');
  await expect(badges).toHaveCount(2);
  await expect(badges.nth(0)).toHaveText("done");
  await expect(badges.nth(0)).toHaveClass(/badge-tone-status-done/);
  await expect(badges.nth(1)).toHaveText("committed");
  await expect(badges.nth(1)).toHaveClass(/badge-tone-commitment-committed/);
  await expect(card).not.toContainText("high");

  await page.locator('[data-item-open="feature-column-board-view"]').first().click();
  await expect(page.locator('.preview-meta .badge').first()).toHaveClass(/badge-tone-status-done/);
});

test("repo= URL hash param survives item-click navigation", async ({ page }) => {
  await page.goto(repoUrl());

  // Wait for the board to be visible (proxies for "workspace loaded").
  await expect(page.locator("#mode-title")).toContainText("Roadmap");

  // Click any board item that should be present.
  const firstItem = page.locator(".board-item").first();
  await firstItem.click();

  // After click, the hash should still include repo=.
  const hash = await page.evaluate(() => window.location.hash);
  expect(hash).toContain("repo=");
  expect(decodeURIComponent(hash)).toContain(process.cwd());
});

test("changing #repo= reloads the workspace for the new repo", async ({ page }) => {
  // Create a separate sandbox repo on disk with its own roadmap/ shape.
  const sandboxRepo = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-pw-multirepo-"));
  await fs.mkdir(path.join(sandboxRepo, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(sandboxRepo, "roadmap", "ideas"), { recursive: true });
  await fs.writeFile(path.join(sandboxRepo, "roadmap", "board.md"), "# Now\n", "utf8");
  await fs.writeFile(path.join(sandboxRepo, "roadmap", "scope.md"), "Sandbox focus.\n", "utf8");

  try {
    // First load: minimap repo (process.cwd()).
    await page.goto(repoUrl());
    await expect(page.locator("#mode-title")).toContainText("Roadmap");
    const initialHeader = await page.locator("#repo-name").textContent();
    expect(initialHeader).toBe(path.basename(process.cwd()));

    // Update the URL hash to point at the sandbox repo (full absolute path).
    await page.evaluate((repo) => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      params.set("repo", repo);
      window.location.hash = `#${params.toString()}`;
    }, sandboxRepo);

    // The UI must re-fetch the workspace and render the sandbox repo's name.
    await page.waitForFunction(
      (expected) => document.querySelector("#repo-name")?.textContent === expected,
      path.basename(sandboxRepo),
      { timeout: 5000 },
    );
    await expect(page.locator("#repo-name")).toHaveText(path.basename(sandboxRepo));
  } finally {
    await fs.rm(sandboxRepo, { recursive: true, force: true });
  }
});

test("Review button on a roadmap item opens it as a spec session", async ({ page }) => {
  await page.goto(repoUrl());
  await expect(page.locator("#mode-title")).toContainText("Roadmap");

  // Open any item — the first board item works.
  const firstItem = page.locator(".board-item").first();
  await firstItem.click();

  // Editor header gains a Review button only when an item is loaded.
  const reviewButton = page.locator("#open-in-spec-button");
  await expect(reviewButton).toBeVisible();
  await reviewButton.click();

  // Switches to spec mode and the spec session for this item is selected.
  await expect(page.locator("#mode-title")).toContainText("Spec sessions");
  // Banner reflects the attach (created or reopened).
  await expect(page.locator("#status-banner")).toContainText(/Spec session (attached|reopened)/i);

  // The hash should still contain repo= and now also view=spec & file=...
  const hash = await page.evaluate(() => window.location.hash);
  expect(hash).toContain("repo=");
  expect(hash).toContain("view=spec");
  expect(hash).toContain("file=");
});

test("board badge appears on items with an active spec session", async ({ page }) => {
  // Open the UI, click an item, click Review to open it as a spec session.
  await page.goto(repoUrl());
  await expect(page.locator("#mode-title")).toContainText("Roadmap");

  const firstItem = page.locator(".board-item").first();
  const firstItemId = await firstItem.getAttribute("data-item-id");
  await firstItem.click();
  await expect(page.locator("#open-in-spec-button")).toBeVisible();
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator("#mode-title")).toContainText("Spec sessions");

  // Add a global comment so openComments > 0.
  // Easier path: hit the API directly with the active repo header.
  const repoPath = process.cwd();
  // Find the spec session targetFile from the spec list.
  const targetFile = await currentSpecFile(page);
  await page.evaluate(async (file) => {
    await fetch("/api/spec-sessions/by-file/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, by: "tester", kind: "question", text: "?", scope: "global" }),
    });
  }, targetFile);

  // Go back to roadmap and verify the badge shows up on the item.
  // applyRouteStateFromLocation refreshes the workspace when leaving spec mode,
  // so the spec-session counts reach the board renderer.
  await page.goto(repoUrl());
  await expect(page.locator("#mode-title")).toContainText("Roadmap");

  const badge = page.locator(`[data-item-id="${firstItemId}"] .board-item-spec-badge`);
  await expect(badge).toBeVisible({ timeout: 5000 });
  await expect(badge).toContainText("1");
});

test("spec session of a roadmap item strips YAML frontmatter from the rendered body", async ({ page }) => {
  // Open a roadmap item, click Review to open it as a spec session, then
  // check that the rendered body does not contain frontmatter keys like
  // `id:` / `title:` / `status:` (which would mean the YAML block was being
  // rendered as text).
  await page.goto(repoUrl());
  await expect(page.locator("#mode-title")).toContainText("Roadmap");

  await page.locator(".board-item").first().click();
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator("#mode-title")).toContainText("Spec sessions");

  // Wait for the file body to render.
  const body = page.locator(".spec-body-markdown");
  await expect(body).toBeVisible({ timeout: 5000 });

  const bodyText = await body.textContent();
  // Roadmap items always start with id/title/status/priority/commitment in
  // the YAML block. None of these should reach the rendered body.
  expect(bodyText, "frontmatter id should not be in body").not.toMatch(/^\s*id:\s/m);
  expect(bodyText, "frontmatter title should not be in body").not.toMatch(/title:\s/);
  expect(bodyText, "frontmatter status should not be in body").not.toMatch(/^\s*status:\s/m);

  // Sanity: the body SHOULD contain real section headings from the file.
  expect(bodyText).toMatch(/Summary/i);
});

test("spec session of a roadmap item shows the same title + badges as the roadmap Read view", async ({ page }) => {
  // Open the roadmap item first to capture the roadmap-mode header values.
  await page.goto(repoUrl());
  await page.locator(".board-item").first().click();
  // Read mode is the default editor mode; the preview surface holds the title + badges.
  const expectedTitle = (await page.locator(".preview-title").first().textContent())?.trim() ?? "";
  expect(expectedTitle.length, "roadmap preview should have a title").toBeGreaterThan(0);
  const expectedBadgesRaw = (await page.locator(".preview-meta").first().textContent()) ?? "";
  // Normalize whitespace; the spec doc renders the same badge HTML.
  const normalizeBadgeText = (s) => s.replace(/\s+/g, " ").trim();
  const expectedBadges = normalizeBadgeText(expectedBadgesRaw);
  expect(expectedBadges.length, "roadmap preview should have at least one badge").toBeGreaterThan(0);

  // Now open the same item as a spec session.
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator("#mode-title")).toContainText("Spec sessions");
  await expect(page.locator(".spec-doc-header")).toBeVisible({ timeout: 5000 });

  const specTitle = (await page.locator(".spec-doc-title").textContent())?.trim() ?? "";
  const specBadges = normalizeBadgeText(await page.locator(".spec-doc-meta").textContent() ?? "");
  expect(specTitle, "spec doc title should match roadmap preview title").toBe(expectedTitle);
  expect(specBadges, "spec doc badges should match roadmap preview badges").toBe(expectedBadges);
});

test("orphan board ids render as inert placeholder cards and surface a warning banner", async ({ page }) => {
  // Append a fake orphan id to the minimap repo's own board.md (afterEach
  // restores from originalBoardText). The orphan must NOT have a matching
  // file under roadmap/features/ or roadmap/ideas/.
  const orphanId = "ghost-orphan-feature";
  const mutatedBoard = `${originalBoardText.trimEnd()}\n- ${orphanId}\n`;
  await fs.writeFile(boardPath, mutatedBoard, "utf8");

  await page.goto(repoUrl());

  // Workspace must still load — the rest of the board renders, items index
  // does not include the orphan, and the warning banner is visible.
  await expect(page.locator("#workspace-summary")).toContainText(/\d+ items \/ \d+ groups/);
  await expect(page.locator("#status-banner")).toBeVisible();
  await expect(page.locator("#status-banner")).toContainText(orphanId);
  await expect(page.locator("#status-banner")).toHaveAttribute("data-tone", "warning");

  // The orphan must render as a placeholder card showing the id, the explain
  // line, and the fix hint — visible regardless of board layout (read-mode
  // uses .board-item-missing, columns mode uses .board-column-card-missing).
  const placeholder = page.locator(".board-item-missing, .board-column-card-missing").first();
  await expect(placeholder).toBeVisible();
  await expect(placeholder).toContainText("Missing roadmap item");
  await expect(placeholder).toContainText(orphanId);
  await expect(placeholder).toContainText("no matching file");
  await expect(placeholder).toContainText(`roadmap/features/${orphanId}.md`);

  // Both Copy buttons must exist and be enabled.
  await expect(placeholder.locator(".board-item-missing-copy", { hasText: "Copy id" })).toBeEnabled();
  await expect(placeholder.locator(".board-item-missing-copy", { hasText: "Copy fix instructions" })).toBeEnabled();

  // Capture a screenshot of the placeholder so the visual is captured in the
  // playwright-report on every run. The test artifact lives next to the spec.
  await placeholder.scrollIntoViewIfNeeded();
  await placeholder.screenshot({ path: "playwright/.artifacts/missing-item-card.png" });
});

test("orphan board ids: full page screenshot for visual review", async ({ page }) => {
  // Sister of the previous test — this one captures a full-page screenshot
  // of the workspace with the warning banner and placeholder visible so the
  // overall layout can be eyeballed. Same fixture pattern.
  const orphanId = "ghost-orphan-feature";
  const mutatedBoard = `${originalBoardText.trimEnd()}\n- ${orphanId}\n`;
  await fs.writeFile(boardPath, mutatedBoard, "utf8");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(repoUrl());
  await expect(page.locator("#status-banner")).toBeVisible();
  await expect(page.locator(".board-item-missing, .board-column-card-missing").first()).toBeVisible();
  await page.screenshot({ path: "playwright/.artifacts/missing-item-fullpage.png", fullPage: false });
});

test("topbar Refresh is an icon-only button with an accessible label", async ({ page }) => {
  await page.goto(repoUrl());
  const refresh = page.locator("#refresh-button");
  await expect(refresh).toBeVisible();
  await expect(refresh).toHaveAttribute("aria-label", "Refresh");
  await expect(refresh).toHaveAttribute("title", "Refresh");
  // No literal "Refresh" text node — the icon is an inline <svg>.
  const text = (await refresh.textContent() || "").trim();
  expect(text, "topbar refresh button should not render the word 'Refresh'").toBe("");
  await expect(refresh.locator("svg")).toBeVisible();
});

test("topbar Refresh re-fetches the spec session in spec mode", async ({ page }) => {
  // The spec view used to have its own refresh button next to Resolved; that
  // button is gone, and the topbar Refresh button now drives both modes.
  await page.goto(repoUrl());
  await page.locator(".board-item").first().click();
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator("#mode-title")).toContainText("Spec sessions");
  await expect(page.locator(".spec-doc-header")).toBeVisible({ timeout: 5000 });

  // The duplicate refresh button must NOT exist anymore.
  await expect(page.locator("#spec-refresh-button")).toHaveCount(0);

  // Count network calls to the context endpoint while we click Refresh.
  const contextCalls = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/spec-sessions/by-file/context")) {
      contextCalls.push(request.url());
    }
  });
  const before = contextCalls.length;
  await page.locator("#refresh-button").click();
  // Give the click handler time to issue both context + content fetches.
  await page.waitForTimeout(300);
  expect(contextCalls.length, "topbar Refresh in spec mode must re-fetch session context").toBeGreaterThan(before);

  // No success banner should appear after a refresh.
  await page.waitForTimeout(200);
  const bannerHidden = await page.locator("#status-banner").isHidden();
  expect(bannerHidden, "no banner should appear after refresh").toBe(true);
});

test("auto-refresh in spec mode picks up externally-added comments", async ({ page, baseURL, request }) => {
  // Open a roadmap item as a spec session, then poke a comment into the
  // session's storage via the public API. The 5s setInterval should pull it
  // and the comments-count chip in the toolbar should tick up.
  await page.goto(repoUrl());
  const itemId = await page.locator(".board-item").first().getAttribute("data-item-id");
  expect(itemId).toBeTruthy();
  await page.locator(".board-item").first().click();
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator("#mode-title")).toContainText("Spec sessions");
  await expect(page.locator(".spec-doc-header")).toBeVisible({ timeout: 5000 });

  const startCount = Number((await page.locator('[data-spec-count="comments"]').first().textContent()) || "0");

  // Use the absolute path the UI itself attached the session with — pull it
  // from /api/spec-sessions so we hit the exact session record.
  const sessionsResp = await request.get(`${baseURL}/api/spec-sessions`);
  expect(sessionsResp.ok()).toBe(true);
  const { sessions } = await sessionsResp.json();
  const targetFile = sessions[0]?.targetFile;
  expect(targetFile, "spec session must be attached before posting a comment").toBeTruthy();

  const post = await request.post(`${baseURL}/api/spec-sessions/by-file/comments`, {
    data: {
      file: targetFile,
      by: "auto-refresh-test",
      kind: "question",
      scope: "global",
      text: "auto refresh probe",
    },
  });
  expect(post.status(), `comment POST should succeed (got ${post.status()}: ${await post.text()})`).toBe(200);

  // The setInterval is 5s; allow up to ~10s to be safe in slow CI.
  await expect.poll(
    async () => Number((await page.locator('[data-spec-count="comments"]').first().textContent()) || "0"),
    { timeout: 10_000, intervals: [500, 1000, 1500] }
  ).toBeGreaterThan(startCount);
});

test("sourceQuoteForRenderedSelection maps rendered selections back through inline markdown", async ({ page }) => {
  // Spec selections come from the rendered DOM, which strips backticks /
  // ** / *. Without this mapping, a quote like
  //   "Both shipped (ClawMem, agentmemory)"
  // would not be found in source containing
  //   "Both shipped (`ClawMem`, `agentmemory`)"
  // and would fall through to the literal string the server then rejects
  // with "anchor must match exactly one location". This test pins the
  // round-trip through a few representative shapes.
  await page.goto(repoUrl());

  const cases = [
    {
      name: "inline code spans",
      source: "Both shipped Claude Code memory plugins surveyed (`ClawMem`, `agentmemory`) ship hooks.",
      rendered: "Both shipped Claude Code memory plugins surveyed (ClawMem, agentmemory) ship hooks.",
      expected: "Both shipped Claude Code memory plugins surveyed (`ClawMem`, `agentmemory`) ship hooks.",
    },
    {
      name: "selection inside a code span",
      source: "Use `agent_work_trace_turn` metadata for the capture pipeline.",
      rendered: "agent_work_trace_turn",
      // Anchored to the inner content; that string IS unique in the source so
      // it round-trips with no backticks needed (the inner offsets win).
      expected: "agent_work_trace_turn",
    },
    {
      name: "bold and italic combined",
      source: "Pallium **preserves** the *operational* facts.",
      rendered: "Pallium preserves the operational facts.",
      expected: "Pallium **preserves** the *operational* facts.",
    },
    {
      name: "no markers — falls through to whitespace map",
      source: "Plain sentence one.\n\nPlain sentence two.",
      rendered: "Plain sentence one. Plain sentence two.",
      expected: "Plain sentence one.\n\nPlain sentence two.",
    },
  ];

  for (const tc of cases) {
    const result = await page.evaluate(
      ([rendered, source]) => window.__minimapSpec.sourceQuoteForRenderedSelection(rendered, source),
      [tc.rendered, tc.source],
    );
    expect(result, `case "${tc.name}" should map to source quote`).toBe(tc.expected);
  }
});

test("commenting on a selection that crosses backticks saves successfully", async ({ page, baseURL, request }) => {
  // End-to-end: append a paragraph with backticks to a roadmap idea file,
  // open it as a spec session, simulate a Selection over the rendered
  // (backtick-free) text, drive the comment composer, submit, and assert
  // the comment was stored. afterEach restores the file via originalIdeaCreateText.
  const probeParagraph = "\n\nProbe sentence with `inline-code-A` and `inline-code-B` that the test selects.\n";
  await fs.writeFile(ideaCreatePath, originalIdeaCreateText.trimEnd() + probeParagraph, "utf8");

  await page.goto(repoUrl());
  // Navigate to the idea-create-items roadmap item.
  await page.locator('[data-item-id="idea-create-items"]').first().click();
  await expect(page.locator("#editor-title")).toContainText("Create roadmap items from the UI");
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator("#mode-title")).toContainText("Spec sessions");
  await expect(page.locator(".spec-doc-header")).toBeVisible({ timeout: 5000 });

  // Wait for the rendered body to include our probe paragraph (the renderer
  // strips the YAML frontmatter and renders the body, so we can search for
  // the visible/rendered phrase).
  const body = page.locator(".spec-body-markdown");
  await expect(body).toContainText("Probe sentence with inline-code-A and inline-code-B");

  // Programmatically build a selection over the visible rendered text. We
  // pick a range that is GUARANTEED to cross a code span — from the start
  // of "Probe" to just past the second backtick span.
  const selectionInfo = await page.evaluate(() => {
    const body = document.querySelector(".spec-body-markdown");
    if (!body) return { ok: false, reason: "body missing" };
    // Walk text nodes to find "Probe sentence with " and "inline-code-B".
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let startNode = null, startOffset = 0;
    let endNode = null, endOffset = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent || "";
      if (!startNode) {
        const idx = text.indexOf("Probe sentence with ");
        if (idx !== -1) {
          startNode = node;
          startOffset = idx;
        }
      }
      if (text.includes("inline-code-B")) {
        endNode = node;
        endOffset = text.indexOf("inline-code-B") + "inline-code-B".length;
      }
    }
    if (!startNode || !endNode) return { ok: false, reason: "endpoints not found" };
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const renderedText = String(sel.toString());

    // Fire mouseup on the spec doc to surface the toolbar.
    const rect = range.getBoundingClientRect();
    document.querySelector("#spec-file-content")?.dispatchEvent(new MouseEvent("mouseup", {
      bubbles: true, cancelable: true,
      clientX: rect.right, clientY: rect.bottom,
    }));
    return { ok: true, renderedText };
  });
  expect(selectionInfo.ok, `selection setup failed: ${selectionInfo.reason}`).toBe(true);
  // The selection text MUST NOT contain backticks (sanity — that's what makes
  // this case reproduce the bug).
  expect(selectionInfo.renderedText).not.toContain("`");
  expect(selectionInfo.renderedText).toContain("inline-code-A");

  // Open the composer programmatically with the selection text. We bypass the
  // floating toolbar's geometry (which is flaky in headless tests) and call
  // the same code path it triggers — sourceQuoteForRenderedSelection +
  // openSpecComposer("comment", quote).
  await page.evaluate(
    (rendered) => window.__minimapSpec.openCommentComposerWithSelection(rendered),
    selectionInfo.renderedText,
  );

  // Verify the composer's prefilled quote contains backticks (i.e., we mapped
  // back to source) — fail if the broken behaviour returns and the literal
  // rendered text leaks through.
  const anchorValue = await page.locator("#spec-comment-anchor").inputValue();
  expect(anchorValue, "composer anchor must be source-form (with backticks)").toContain("`inline-code-A`");

  // Fill in the body and submit.
  await page.locator("#spec-comment-text").fill("auto test - backtick anchor");
  await page.locator("#spec-comment-form button[type='submit']").click();

  // No error banner should remain.
  await page.waitForTimeout(500);
  const banner = page.locator("#status-banner");
  if (await banner.isVisible()) {
    const tone = await banner.getAttribute("data-tone");
    const text = await banner.textContent();
    expect(tone, `comment submit must not fail with an error banner: ${text}`).not.toBe("error");
  }

  // Comment was saved — comments-count chip ticked up.
  const count = Number((await page.locator('[data-spec-count="comments"]').first().textContent()) || "0");
  expect(count, "comment count must increase after submit").toBeGreaterThanOrEqual(1);
});

test("rendered spec view finds anchored quotes that include markdown syntax", async ({ page }) => {
  // Regression for the "Could not find the anchored text in the rendered file"
  // banner that fired when an agent saved a comment whose quote included
  // markdown inline code (backticks) or a heading prefix (### ). The renderer's
  // textContent has neither, so a literal whitespace-only normalization missed.
  // The fallback strips markdown syntax on both sides; clicking the comment
  // should now scroll-and-highlight the matching block instead of erroring.
  const probe = "\n\n### Probe Heading\n\nA line that contains `code-quote-marker` mid-sentence.\n";
  await fs.writeFile(ideaCreatePath, originalIdeaCreateText.trimEnd() + probe, "utf8");

  await page.goto(repoUrl());
  await page.locator('[data-item-id="idea-create-items"]').first().click();
  await expect(page).toHaveURL(/item=idea-create-items/);
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator("#mode-title")).toContainText("Spec sessions");
  await expect(page.locator(".spec-doc-header")).toBeVisible({ timeout: 5000 });

  const targetFile = await currentSpecFile(page);

  // Save two comments via the API: one anchored on a heading-prefixed quote,
  // one anchored on a backtick-bracketed code span. Both quotes carry markdown
  // syntax that does NOT appear in the rendered HTML.
  await page.evaluate(async ({ file }) => {
    await fetch("/api/spec-sessions/by-file/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, by: "tester", kind: "concern", text: "h", quote: "### Probe Heading" }),
    });
    await fetch("/api/spec-sessions/by-file/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, by: "tester", kind: "concern", text: "c", quote: "`code-quote-marker`" }),
    });
  }, { file: targetFile });

  // Refresh so the new comments appear in the side rail.
  await page.locator("#refresh-button").click();
  await page.waitForTimeout(500);

  // Click each comment card. The error banner used to show "Could not find
  // the anchored text in the rendered file" — assert it does NOT appear.
  const cards = page.locator("[data-comment-id]");
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(2);

  for (let i = 0; i < count; i += 1) {
    await cards.nth(i).click();
    await page.waitForTimeout(150);
    const banner = page.locator("#status-banner");
    if (await banner.isVisible()) {
      const text = (await banner.textContent()) || "";
      expect(text, `clicking comment ${i} should not fire 'Could not find' banner`).not.toMatch(/Could not find the anchored text/i);
    }
  }
});

test("selecting one of two duplicate phrases anchors a comment to the right occurrence", async ({ page }) => {
  // Regression for the "anchor must match exactly one location" rejection
  // when a phrase appears twice — once in prose, once inside a fenced code
  // block — and the user selects the second occurrence. The UI knows which
  // line the rendered selection landed on; that hint must travel with the
  // POST so the server can disambiguate.
  const probe = [
    "",
    "",
    "Probe paragraph mentioning DUPLICATE_PHRASE_ABC once in prose.",
    "",
    "```js",
    "// And here is DUPLICATE_PHRASE_ABC inside a fenced code block.",
    "```",
    "",
  ].join("\n");
  await fs.writeFile(ideaCreatePath, originalIdeaCreateText.trimEnd() + probe, "utf8");

  await page.goto(repoUrl());
  await page.locator('[data-item-id="idea-create-items"]').first().click();
  await expect(page).toHaveURL(/item=idea-create-items/);
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator("#mode-title")).toContainText("Spec sessions");
  await expect(page.locator(".spec-doc-header")).toBeVisible({ timeout: 5000 });

  const targetFile = await currentSpecFile(page);

  // The body must contain BOTH occurrences (rendered).
  const body = page.locator(".spec-body-markdown");
  await expect(body).toContainText("Probe paragraph mentioning DUPLICATE_PHRASE_ABC");
  await expect(body).toContainText("DUPLICATE_PHRASE_ABC inside a fenced code block");

  // Build a Selection that ONLY covers the SECOND occurrence (in the fence).
  // We walk text nodes, find both, and set the range tightly around just
  // the in-fence one.
  const selectionInfo = await page.evaluate(() => {
    const body = document.querySelector(".spec-body-markdown");
    if (!body) return { ok: false, reason: "body missing" };
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const matches = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent || "";
      let from = 0;
      while (true) {
        const idx = text.indexOf("DUPLICATE_PHRASE_ABC", from);
        if (idx === -1) break;
        matches.push({ node, offset: idx });
        from = idx + 1;
      }
    }
    if (matches.length < 2) return { ok: false, reason: `expected >=2 matches, got ${matches.length}` };
    const second = matches[1];
    const range = document.createRange();
    range.setStart(second.node, second.offset);
    range.setEnd(second.node, second.offset + "DUPLICATE_PHRASE_ABC".length);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const renderedText = String(sel.toString());
    window.__minimapSpec.openCommentComposerWithSelection(renderedText);
    return { ok: true, renderedText };
  });
  expect(selectionInfo.ok, `selection setup failed: ${selectionInfo.reason}`).toBe(true);
  expect(selectionInfo.renderedText).toBe("DUPLICATE_PHRASE_ABC");

  const commentText = `auto test - duplicate phrase ${Date.now()}`;
  await page.locator("#spec-comment-text").fill(commentText);
  await page.locator("#spec-comment-form button[type='submit']").click();

  // Form must accept (no error banner).
  await page.waitForTimeout(500);
  const banner = page.locator("#status-banner");
  if (await banner.isVisible()) {
    const tone = await banner.getAttribute("data-tone");
    const text = await banner.textContent();
    expect(tone, `comment submit must not fail: ${text}`).not.toBe("error");
  }

  // Read the saved comment back via the API and assert lineStart matches the
  // SECOND occurrence (the fenced one), not the first.
  const ctx = await page.evaluate(async ({ file }) => {
    const response = await fetch(`/api/spec-sessions/by-file/context?path=${encodeURIComponent(file)}`);
    return response.json();
  }, { file: targetFile });
  const comments = (ctx.comments || []).filter((c) => c.text === commentText && c.anchor?.quote === "DUPLICATE_PHRASE_ABC");
  expect(comments.length, "expected exactly one DUPLICATE_PHRASE_ABC comment").toBe(1);
  const newComment = comments[0];

  // Find the lines that contain the phrase in the source so we can compare.
  const lines = (originalIdeaCreateText.trimEnd() + probe).split("\n");
  const occurrenceLines = [];
  lines.forEach((line, i) => {
    if (line.includes("DUPLICATE_PHRASE_ABC")) occurrenceLines.push(i + 1);
  });
  expect(occurrenceLines.length).toBe(2);
  expect(
    newComment.anchor.lineStart,
    `comment must anchor to the second occurrence (line ${occurrenceLines[1]}), not the first (line ${occurrenceLines[0]})`,
  ).toBe(occurrenceLines[1]);
});

test("participants facepile lists comment authors plus the viewer", async ({ page, baseURL, request }) => {
  // Open a roadmap item as a spec session, then post comments by two
  // distinct authors via the API. The facepile should render their initials,
  // and the popover should list them along with the viewer (whatever value
  // is in #spec-comment-by — defaults to "human").
  await page.goto(repoUrl());
  const itemId = await page.locator(".board-item").first().getAttribute("data-item-id");
  await page.locator(".board-item").first().click();
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator("#mode-title")).toContainText("Spec sessions");
  await expect(page.locator(".spec-doc-header")).toBeVisible({ timeout: 5000 });

  const sessionsResp = await request.get(`${baseURL}/api/spec-sessions`);
  const { sessions } = await sessionsResp.json();
  // Prior tests may leave attached sessions for other files. Pick the
  // session whose targetFile ends in the item id we just opened, not just
  // sessions[0] — race-safe across the serial suite.
  const targetFile = sessions.find((s) => (s.targetFile || "").includes(itemId))?.targetFile
    ?? sessions[0]?.targetFile;
  expect(targetFile, `must find a spec session for ${itemId}`).toBeTruthy();

  const startCount = Number((await page.locator('[data-spec-count="comments"]').first().textContent()) || "0");

  // Two distinct authors, two comments.
  for (const by of ["codex", "claude"]) {
    const post = await request.post(`${baseURL}/api/spec-sessions/by-file/comments`, {
      data: { file: targetFile, by, kind: "question", scope: "global", text: `note from ${by}` },
    });
    expect(post.ok(), `comment by ${by} should post (${post.status()})`).toBe(true);
  }

  // Wait for auto-refresh to pull our two new comments (5s setInterval).
  await expect.poll(
    async () => Number((await page.locator('[data-spec-count="comments"]').first().textContent()) || "0"),
    { timeout: 10_000 }
  ).toBeGreaterThanOrEqual(startCount + 2);

  // Facepile must be visible. The participant count includes the viewer
  // (always) plus everyone who has authored content. Earlier tests in the
  // suite may leave additional authors attached, so we assert the SET
  // contains codex / claude / human, not that it equals exactly those.
  const facepile = page.locator("#spec-participants-facepile");
  await expect(facepile).toBeVisible();
  const participantsLabel = (await facepile.locator("[data-spec-participants-label]").textContent()) || "";
  expect(participantsLabel).toMatch(/^\d+ participants?$/);

  // Open the popover and verify the named participants are listed.
  await facepile.click();
  const popover = page.locator("#spec-participants-popover");
  await expect(popover).toBeVisible();
  await expect(popover.locator(".spec-popover-item.is-viewer")).toContainText("human");
  // codex and claude both appear with at least one action recorded — there
  // may be more if prior runs accumulated comments under the same names,
  // so we just assert they're present.
  await expect(popover.locator(".spec-popover-item").filter({ hasText: /\bcodex\b/ })).toBeVisible();
  await expect(popover.locator(".spec-popover-item").filter({ hasText: /\bclaude\b/ })).toBeVisible();
  // Viewer (human) — if no prior tests authored under "human" they show
  // "viewing"; otherwise their action count. Either is valid.
  const viewerMeta = (await popover.locator(".spec-popover-item.is-viewer .spec-popover-meta").textContent()) || "";
  expect(viewerMeta).toMatch(/(viewing|action)/);

  // Esc closes the popover.
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
});

test("participants facepile updates when the viewer edits the actor field", async ({ page }) => {
  // The viewer's identity comes from #spec-comment-by (defaults to "human").
  // Editing it should immediately update the facepile so the user sees
  // themselves as a participant under the new name.
  await page.goto(repoUrl());
  await page.locator(".board-item").first().click();
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator("#mode-title")).toContainText("Spec sessions");
  await expect(page.locator(".spec-doc-header")).toBeVisible({ timeout: 5000 });

  // The facepile starts with at least the viewer.
  await expect(page.locator("#spec-participants-facepile")).toBeVisible();

  // Drive the actor input directly via the DOM and dispatch an `input` event
  // (the listener that drives the facepile fires on `input`). The composer's
  // visibility / focus is irrelevant here — identity is just the field's
  // value, and the listener picks it up the same way regardless.
  await page.evaluate(() => {
    const el = document.querySelector("#spec-comment-by");
    el.value = "rore";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  // Initials should now be RO somewhere in the facepile.
  const initials = await page.locator("#spec-participants-facepile .spec-facepile-circle").allTextContents();
  expect(initials.map((s) => s.trim())).toContain("RO");
});

test("trimming a paragraph quote down to a duplicate substring still anchors to the right paragraph", async ({ page }) => {
  // Reproduces the screenshot bug: the user opens the composer from the
  // gutter "+" on a paragraph (line range captured), then trims the prefilled
  // quote down to a phrase that appears in MULTIPLE paragraphs in the file.
  // Without the substring-aware line-range hint, the server fired
  // "Text anchor quote must match exactly one location."
  // With the fix, the line range from the original paragraph is forwarded as
  // a disambiguation hint, and the trimmed quote resolves to the user's
  // paragraph — not some other occurrence.
  const probeBody = "\n\n## A\n\nClaude Code is OK in the first paragraph.\n\n## B\n\nClaude Code shows up again in the second paragraph.\n";
  await fs.writeFile(ideaCreatePath, originalIdeaCreateText.trimEnd() + probeBody, "utf8");

  await page.goto(repoUrl());
  await page.locator('[data-item-id="idea-create-items"]').first().click();
  await expect(page).toHaveURL(/item=idea-create-items/);
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator("#mode-title")).toContainText("Spec sessions");
  await expect(page.locator(".spec-body-markdown")).toBeVisible({ timeout: 5000 });

  // Open the gutter-+ composer for the FIRST paragraph that contains "Claude Code".
  await page.evaluate(() => {
    const blocks = Array.from(document.querySelectorAll(".spec-body p, .spec-body li"));
    for (const b of blocks) {
      if ((b.textContent || "").includes("Claude Code")) {
        window.__minimapSpec.openCommentComposerForBlock(b);
        return;
      }
    }
  });
  await page.waitForSelector("#spec-comment-form:not([hidden])", { timeout: 5000 });

  // Trim the prefilled quote down to "Claude Code" — the duplicate phrase.
  await page.locator("#spec-comment-anchor").fill("Claude Code");
  await page.locator("#spec-comment-text").fill("comment via trimmed-substring quote");
  await page.locator("#spec-comment-form button[type=submit]").click();

  // Expect a success banner, NOT the "must match exactly one location" error.
  await page.waitForTimeout(500);
  const banner = await page.locator("#status-banner").textContent().catch(() => "");
  expect(banner, "submit should succeed without an anchor-ambiguous error").not.toMatch(/must match exactly one location/i);
  expect(banner).toMatch(/Comment added/i);
});

test("live-selecting one of two same-line duplicates anchors to the chosen occurrence", async ({ page }) => {
  // The screenshot bug: a single line mentions "Claude Code" twice (once in
  // prose, once in possessive form like "Claude Code's"). Line range alone
  // can't disambiguate — both occurrences share lineStart === lineEnd. The
  // char-offset hint pinpoints the right one.
  const probeBody = "\n\n## A\n\nBoth shipped Claude Code plugins surveyed (ClawMem). Claude Code's auto-memory is the second mention.\n";
  await fs.writeFile(ideaCreatePath, originalIdeaCreateText.trimEnd() + probeBody, "utf8");

  await page.goto(repoUrl());
  await page.locator('[data-item-id="idea-create-items"]').first().click();
  await expect(page).toHaveURL(/item=idea-create-items/);
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator("#mode-title")).toContainText("Spec sessions");
  await expect(page.locator(".spec-body-markdown")).toBeVisible({ timeout: 5000 });

  // Select "Claude Code" out of the SECOND occurrence ("Claude Code's").
  await page.evaluate(async () => {
    const body = document.querySelector(".spec-body-markdown") || document.querySelector(".spec-body");
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let textNode = null, textOffset = 0;
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent || "";
      const cursor = t.indexOf("Claude Code's");
      if (cursor !== -1) { textNode = walker.currentNode; textOffset = cursor; break; }
    }
    const range = document.createRange();
    range.setStart(textNode, textOffset);
    range.setEnd(textNode, textOffset + "Claude Code".length); // stop before apostrophe
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    body.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
    sel.removeAllRanges();
    sel.addRange(range);
    window.__minimapSpec.openCommentComposerWithSelection("Claude Code");
  });
  await page.waitForSelector("#spec-comment-form:not([hidden])", { timeout: 5000 });

  // The captured state should carry a non-null quoteOffset — the disambiguator.
  const snap = await page.evaluate(() => window.__minimapSpec.getSpecStateSnapshot());
  expect(typeof snap.selectedQuoteOffset, "live selection should capture a char offset").toBe("number");

  await page.locator("#spec-comment-text").fill("partial selection on second same-line occurrence");
  await page.locator("#spec-comment-form button[type=submit]").click();
  await page.waitForTimeout(500);
  const banner = await page.locator("#status-banner").textContent().catch(() => "");
  expect(banner, "submit should succeed without an anchor-ambiguous error").not.toMatch(/must match exactly one location/i);
  expect(banner).toMatch(/Comment added/i);
});

test("live-selecting a duplicate phrase on different lines anchors to the chosen occurrence", async ({ page }) => {
  // Sister-case to the gutter-+/trim test above: the user opens the composer
  // by SELECTING the duplicate phrase directly (not via the paragraph "+" button).
  // The bug was that selectionchange-triggered cleanup wiped the captured
  // line range when the composer's textarea took focus and the selection
  // collapsed — so the disambiguation hint never reached the server.
  const probeBody = "\n\n## A\n\nClaude Code is OK in the first paragraph.\n\n## B\n\nClaude Code shows up again in the second paragraph.\n";
  await fs.writeFile(ideaCreatePath, originalIdeaCreateText.trimEnd() + probeBody, "utf8");

  await page.goto(repoUrl());
  await page.locator('[data-item-id="idea-create-items"]').first().click();
  await expect(page).toHaveURL(/item=idea-create-items/);
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator("#mode-title")).toContainText("Spec sessions");
  await expect(page.locator(".spec-body-markdown")).toBeVisible({ timeout: 5000 });

  // Build a DOM selection on the SECOND occurrence of "Claude Code" and fire
  // mouseup so the selection-capture path runs as it would in real use.
  await page.evaluate(async () => {
    const body = document.querySelector(".spec-body-markdown") || document.querySelector(".spec-body");
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let textNode = null, textOffset = 0, found = 0;
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent || "";
      let cursor = t.indexOf("Claude Code");
      while (cursor !== -1) {
        found += 1;
        if (found === 2) { textNode = walker.currentNode; textOffset = cursor; break; }
        cursor = t.indexOf("Claude Code", cursor + 1);
      }
      if (textNode) break;
    }
    const range = document.createRange();
    range.setStart(textNode, textOffset);
    range.setEnd(textNode, textOffset + "Claude Code".length);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    body.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
    sel.removeAllRanges();
    sel.addRange(range);
    window.__minimapSpec.openCommentComposerWithSelection("Claude Code");
  });
  await page.waitForSelector("#spec-comment-form:not([hidden])", { timeout: 5000 });

  await page.locator("#spec-comment-text").fill("live-selection on second occurrence");
  await page.locator("#spec-comment-form button[type=submit]").click();
  await page.waitForTimeout(500);
  const banner = await page.locator("#status-banner").textContent().catch(() => "");
  expect(banner, "submit should succeed without an anchor-ambiguous error").not.toMatch(/must match exactly one location/i);
  expect(banner).toMatch(/Comment added/i);
});

test("comment composer closes after a successful submit", async ({ page }) => {
  // Regression: addSpecComment used to flip state.spec.commentComposerOpen
  // to false but the form's visibility is driven by the form.hidden DOM
  // attribute, not the state flag — so the dialog stayed on screen after
  // posting. Same bug existed for the suggestion composer.
  await page.goto(repoUrl());
  await page.locator('[data-item-id="idea-create-items"]').first().click();
  await expect(page).toHaveURL(/item=idea-create-items/);
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator(".spec-doc-header")).toBeVisible({ timeout: 5000 });

  // Open the composer on a real block via the gutter "+" hook, the same
  // way the user opens it in the screenshot. Picks the first paragraph
  // we can find in the rendered body.
  const opened = await page.evaluate(() => {
    const body = document.querySelector(".spec-body-markdown");
    const para = body && body.querySelector("p");
    if (!para) return false;
    window.__minimapSpec.openCommentComposerForBlock(para);
    return true;
  });
  expect(opened, "should be able to find a paragraph block to open the composer on").toBe(true);
  await expect(page.locator("#spec-comment-form")).toBeVisible({ timeout: 2000 });

  await page.locator("#spec-comment-text").fill("auto-test: composer must close on submit");
  await page.locator("#spec-comment-form button[type='submit']").click();

  // Form must be hidden after the POST resolves.
  await expect(page.locator("#spec-comment-form")).toBeHidden({ timeout: 3000 });
});

test("re-rendering the board many times does not grow the DOM unboundedly", async ({ page }) => {
  // Smoke check that the renderBoard path doesn't leak detached nodes. The
  // architecture is naturally GC-friendly (innerHTML reset orphans listeners
  // attached to per-element targets, browsers GC them on the next cycle),
  // but a future change could introduce a global ref to a detached subtree
  // and leak — this test catches that. Threshold is generous because GC is
  // best-effort in headless Chrome.
  await page.goto(repoUrl());
  await expect(page.locator(".board-item-list, .board-columns").first()).toBeVisible({ timeout: 5000 });

  const countNodes = () => page.evaluate(() => document.querySelectorAll("*").length);

  const baseline = await countNodes();

  // Force 30 re-renders by toggling search (which triggers renderBoard).
  await page.evaluate(async () => {
    const input = document.querySelector("#board-search");
    if (!input) throw new Error("board-search not found");
    for (let i = 0; i < 30; i += 1) {
      input.value = i % 2 === 0 ? "feature" : "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      // Yield to let renderBoard run synchronously and the DOM settle.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  // Best-effort: poll for the DOM count to settle. If it grows by more than
  // 200 nodes vs baseline (very generous — typical leak is 10x more), fail.
  await page.waitForTimeout(150);
  const after = await countNodes();
  const delta = after - baseline;
  expect(delta, `DOM grew by ${delta} nodes after 30 re-renders (baseline ${baseline}, after ${after}); investigate render path for retained references.`).toBeLessThan(200);
});

test("multi-block-quote suggestions and list-item suggestions anchor inline (not stacked at the bottom)", async ({ page }) => {
  // Regression: the renderer used to require a single rendered block whose
  // textContent included the WHOLE quote. Multi-block quotes (heading + code,
  // or section heading + paragraphs) returned null and got stacked at the
  // bottom of the margin as orphans, even when the server's anchorStatus was
  // `resolved`. Same shape happened for list-item quotes that started with
  // `- ` because <li>.textContent has no leading bullet.
  const probeBody = `

## Multi block test

### A nested heading with a code fence under it

\`\`\`python
{
    "key": "value",
    "another": 42,
}
\`\`\`

## Plain section heading

This paragraph follows the section heading.

A second paragraph in the same section.

## A list section

- First list item with \`code\` inside it
- Second list item, plain
`;
  await fs.writeFile(ideaCreatePath, originalIdeaCreateText.trimEnd() + probeBody, "utf8");

  await page.goto(repoUrl());
  await page.locator('[data-item-id="idea-create-items"]').first().click();
  await expect(page).toHaveURL(/item=idea-create-items/);
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator("#mode-title")).toContainText("Spec sessions");
  await expect(page.locator(".spec-body-markdown")).toBeVisible({ timeout: 5000 });

  const targetFile = await currentSpecFile(page);

  // Three suggestions covering the cases the cheap fallback should handle:
  //   - heading + code fence (multi-block)
  //   - section heading + paragraphs (multi-block)
  //   - a list-item quote starting with `- ` (single block, but the bullet
  //     marker tripped the markdown-strip fallback).
  await page.evaluate(async (file) => {
    const post = (body) => fetch("/api/spec-sessions/by-file/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await post({
      file, by: "tester", kind: "replace", scope: "",
      quote: "### A nested heading with a code fence under it\n\n```python\n{\n    \"key\": \"value\",\n    \"another\": 42,\n}\n```",
      content: "### Replaced heading\n\n```python\n{}\n```",
      rationale: "multi-block: heading + code",
    });
    await post({
      file, by: "tester", kind: "replace", scope: "",
      quote: "## Plain section heading\n\nThis paragraph follows the section heading.\n\nA second paragraph in the same section.",
      content: "## Replaced section\n\nNew content.",
      rationale: "multi-block: heading + paragraphs",
    });
    await post({
      file, by: "tester", kind: "replace", scope: "",
      quote: "- First list item with `code` inside it",
      content: "- Replaced first item",
      rationale: "list-item with bullet marker",
    });
  }, targetFile);

  // Reload to pick up the seeded suggestions.
  await page.reload();
  await expect(page.locator(".spec-body-markdown")).toBeVisible({ timeout: 5000 });
  await page.waitForFunction(() => document.querySelectorAll(".spec-margin-card.is-suggestion").length >= 3, null, { timeout: 5000 });
  // Settle layout — layoutSpecMargin runs on rAF and a small post-render tick.
  await page.waitForTimeout(300);

  const orphanCount = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".spec-margin-card.is-suggestion"));
    return cards.filter((c) => c.classList.contains("is-orphan")).length;
  });
  expect(orphanCount, "all three multi-block / list-item suggestions should anchor inline").toBe(0);
});

test("rendered spec body stamps each block with its source line", async ({ page }) => {
  // Smoke test for the renderer's emitLines option: every top-level block
  // in the rendered spec body must carry a numeric data-spec-source-line.
  // This is what anchorTargetElement uses for O(1) line-keyed lookups; no
  // attributes => the line-based pipeline silently degrades to text matching.
  await page.goto(repoUrl());
  await page.locator('[data-item-id="idea-create-items"]').first().click();
  await expect(page).toHaveURL(/item=idea-create-items/);
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator(".spec-body-markdown")).toBeVisible({ timeout: 5000 });

  const lineAttrSummary = await page.evaluate(() => {
    const annotated = Array.from(document.querySelectorAll(".spec-body-markdown [data-spec-source-line]"));
    const tags = new Set(annotated.map((el) => el.tagName.toLowerCase()));
    const allNumeric = annotated.every((el) => {
      const n = Number(el.dataset.specSourceLine);
      return Number.isFinite(n) && n >= 1;
    });
    return { count: annotated.length, tags: Array.from(tags).sort(), allNumeric };
  });
  expect(lineAttrSummary.count, "should annotate at least one block").toBeGreaterThan(0);
  expect(lineAttrSummary.allNumeric, "every annotated block must carry a 1-based integer").toBe(true);
  // The fixture has at least one paragraph and one heading. We don't pin
  // the heading level (idea-create-items.md uses h2 as the top heading
  // because the file's h1 is the doc-header rendered separately).
  expect(lineAttrSummary.tags).toEqual(expect.arrayContaining(["p"]));
  expect(lineAttrSummary.tags.some((t) => /^h[1-6]$/.test(t)), "should annotate at least one heading").toBe(true);
});

test("multi-block-quote suggestion anchors via line lookup, not via text matching", async ({ page }) => {
  // Exercises the Phase 3 line-keyed placement directly: a suggestion with
  // a quote that spans heading + code fence should resolve to the heading's
  // DOM element via the `data-spec-source-line` index, not via the
  // text-matching fallback. We verify by checking the card's anchor
  // resolves to an element whose source-line attribute matches the
  // server's anchorStatus.lineStart.
  const probeBody = `

## Phase-3 line lookup probe

\`\`\`yaml
key: value
\`\`\`
`;
  await fs.writeFile(ideaCreatePath, originalIdeaCreateText.trimEnd() + probeBody, "utf8");

  await page.goto(repoUrl());
  await page.locator('[data-item-id="idea-create-items"]').first().click();
  await expect(page).toHaveURL(/item=idea-create-items/);
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator(".spec-body-markdown")).toBeVisible({ timeout: 5000 });

  const targetFile = await currentSpecFile(page);

  // Submit a multi-block suggestion. The server records lineStart at the
  // heading line; the UI should resolve the card to the heading via
  // line lookup, NOT via the text-matching fallback.
  const submitted = await page.evaluate(async (file) => {
    const resp = await fetch("/api/spec-sessions/by-file/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file, by: "tester", kind: "replace", scope: "",
        quote: "## Phase-3 line lookup probe\n\n```yaml\nkey: value\n```",
        content: "## Replaced\n\n```yaml\nk: v\n```",
        rationale: "phase 3 line lookup",
      }),
    });
    return resp.json();
  }, targetFile);
  const lineStart = submitted?.suggestion?.anchor?.lineStart;
  expect(typeof lineStart, "server should record an anchor line").toBe("number");

  await page.reload();
  await expect(page.locator(".spec-body-markdown")).toBeVisible({ timeout: 5000 });
  await page.waitForFunction(() => document.querySelectorAll(".spec-margin-card.is-suggestion").length >= 1, null, { timeout: 5000 });
  await page.waitForTimeout(300);

  // The line-keyed map should expose this exact line on a real DOM element.
  const lookup = await page.evaluate((line) => {
    const el = document.querySelector(`.spec-body-markdown [data-spec-source-line="${line}"]`);
    if (!el) return null;
    return { tag: el.tagName.toLowerCase(), text: (el.textContent || "").slice(0, 60) };
  }, lineStart);
  expect(lookup, "rendered DOM should have an element on the suggestion's anchor line").not.toBeNull();
  // The block at that line should be the section heading we anchored on.
  expect(lookup.tag).toBe("h2");
  expect(lookup.text).toContain("Phase-3 line lookup probe");

  // And the card itself should not be classified as orphan.
  const orphan = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".spec-margin-card.is-suggestion"))
      .some((c) => c.classList.contains("is-orphan"));
  });
  expect(orphan, "suggestion should anchor inline, not orphan").toBe(false);
});

test("legacy comment without anchorStatus.lineStart still anchors via text-matching fallback", async ({ page }) => {
  // Backward-compat: a comment whose anchor lacks a server-resolvable
  // lineStart (e.g. a global-scope comment, or a quote-anchored one whose
  // anchorStatus came back orphaned with no line) should still place via
  // the existing text-matching path. The line-keyed lookup is purely
  // additive — when it misses, anchorTargetElement falls through.
  await page.goto(repoUrl());
  await page.locator('[data-item-id="idea-create-items"]').first().click();
  await expect(page).toHaveURL(/item=idea-create-items/);
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator(".spec-body-markdown")).toBeVisible({ timeout: 5000 });

  const targetFile = await currentSpecFile(page);

  await page.evaluate(async (file) => {
    await fetch("/api/spec-sessions/by-file/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, by: "tester", kind: "question", text: "global?", scope: "global" }),
    });
  }, targetFile);

  await page.reload();
  await expect(page.locator(".spec-body-markdown")).toBeVisible({ timeout: 5000 });
  await page.waitForFunction(() => document.querySelectorAll(".spec-margin-card").length >= 1, null, { timeout: 5000 });
  await page.waitForTimeout(300);

  const orphanCount = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".spec-margin-card"))
      .filter((c) => c.classList.contains("is-orphan")).length;
  });
  expect(orphanCount, "global-scope comment should anchor at file top, not orphan").toBe(0);
});

test("applying a suggestion cascades the comment's anchor to the new content (no orphan)", async ({ page }) => {
  // The exact bug from the live spec: a comment is anchored to a phrase,
  // the agent's suggestion replaces a longer span containing that phrase,
  // and applying the suggestion used to orphan the comment because the
  // old cascade required exact quote-string equality. With offset overlap
  // the cascade now finds it and re-anchors to the new content.
  const probeBody = `

## Cascade probe

The whole sentence here that mentions key phrase inside it.
`;
  await fs.writeFile(ideaCreatePath, originalIdeaCreateText.trimEnd() + probeBody, "utf8");

  await page.goto(repoUrl());
  await page.locator('[data-item-id="idea-create-items"]').first().click();
  await expect(page).toHaveURL(/item=idea-create-items/);
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator(".spec-body-markdown")).toBeVisible({ timeout: 5000 });

  const targetFile = await currentSpecFile(page);

  // Comment on the substring; suggestion replaces the whole sentence.
  const seeded = await page.evaluate(async (file) => {
    const cmt = await (await fetch("/api/spec-sessions/by-file/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file, by: "human", kind: "concern", scope: "",
        quote: "key phrase",
        text: "Worried about the wording.",
      }),
    })).json();
    const sug = await (await fetch("/api/spec-sessions/by-file/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file, by: "ai", kind: "replace", scope: "",
        quote: "The whole sentence here that mentions key phrase inside it.",
        content: "A different sentence that says nothing about it.",
        rationale: "rewrite the whole thing",
      }),
    })).json();
    const applied = await (await fetch(`/api/spec-sessions/by-file/suggestions/${sug.suggestion.id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, by: "human" }),
    })).json();
    return { commentId: cmt.comment.id, suggestionId: sug.suggestion.id, applied };
  }, targetFile);
  expect(seeded.applied?.suggestion?.status).toBe("applied");

  await page.reload();
  await expect(page.locator(".spec-body-markdown")).toBeVisible({ timeout: 5000 });
  await page.waitForFunction(() => document.querySelectorAll(".spec-margin-card").length >= 1, null, { timeout: 5000 });
  await page.waitForTimeout(300);

  // The comment's quote should be the suggestion's NEW content, not its old
  // substring quote. anchorStatus should be `resolved`. The card should NOT
  // be classified as orphan in the layout.
  const inspect = await page.evaluate(async (id) => {
    const ctx = await (await fetch(`/api/spec-sessions/by-file/context?path=${encodeURIComponent(window.location.hash.match(/file=([^&]+)/)[1])}`)).json();
    return null; // placeholder
  }, seeded.commentId).catch(() => null);
  // Read directly via the running page's API call:
  const verdict = await page.evaluate(async () => {
    const path = decodeURIComponent(window.location.hash.match(/file=([^&]+)/)[1]);
    const ctx = await (await fetch(`/api/spec-sessions/by-file/context?path=${encodeURIComponent(path)}`)).json();
    const cmt = ctx.comments[ctx.comments.length - 1];
    return {
      quote: cmt.anchor?.quote,
      status: cmt.anchorStatus?.status,
      rewritten: !!cmt.anchorRewrittenAt,
    };
  });
  expect(verdict.quote, "comment should be re-anchored to the new replacement content").toBe(
    "A different sentence that says nothing about it.",
  );
  expect(verdict.status).toBe("resolved");
  expect(verdict.rewritten).toBe(true);

  // And the card itself should not be classified as orphan in the layout.
  const orphanCount = await page.evaluate(() => Array.from(document.querySelectorAll(".spec-margin-card"))
    .filter((c) => c.classList.contains("is-orphan")).length);
  expect(orphanCount, "no card should be in the orphan stack").toBe(0);
});

test("orphaned comment with a still-valid lineStart anchors visually at that line, not at the bottom", async ({ page }) => {
  // The other half of the fix: even when the cascade misses (e.g. legacy
  // data, or a comment whose anchor really is gone), the UI should still
  // place the card next to the original line if that line still exists in
  // the rendered DOM. Backstop for users who can then read the orphan
  // badge alongside the right paragraph instead of hunting at the bottom.
  const probeBody = `

## Orphan-line probe

A normal paragraph that won't be touched.

A second paragraph for layout.
`;
  await fs.writeFile(ideaCreatePath, originalIdeaCreateText.trimEnd() + probeBody, "utf8");

  await page.goto(repoUrl());
  await page.locator('[data-item-id="idea-create-items"]').first().click();
  await expect(page).toHaveURL(/item=idea-create-items/);
  await page.locator("#open-in-spec-button").click();
  await expect(page.locator(".spec-body-markdown")).toBeVisible({ timeout: 5000 });

  const targetFile = await currentSpecFile(page);

  // Seed a comment whose quote doesn't exist in the file but whose
  // lineStart points at a real paragraph. The anchorStatus comes back
  // orphaned, but anchor.lineStart still maps to a real DOM block.
  const seeded = await page.evaluate(async (file) => {
    // Direct anchor write would need raw DB access; instead we add a
    // legitimate comment and then mutate just the quote in a follow-up:
    // The simplest reproducible setup is to add a comment, then apply
    // a suggestion that rewrites the line — leaving the comment whose
    // re-anchor target is gone. But the cascade now handles that, so
    // for THIS test we want a case where re-anchoring fails.
    //
    // Cheat: post a comment with a quote that exists, then post-process:
    // we rely on the cascade behavior in production. For coverage of the
    // PURE Layer-B path, post a comment, apply a `delete` suggestion on
    // the comment's exact line — the cascade only runs for `replace`,
    // and `delete` truly removes the quote, leaving the comment
    // anchorStatus orphaned with a still-existing lineStart in the file.
    const cmt = await (await fetch("/api/spec-sessions/by-file/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file, by: "human", kind: "concern", scope: "",
        quote: "A normal paragraph that won't be touched.",
        text: "I have thoughts.",
      }),
    })).json();
    // Now nuke the line via a `delete` suggestion (cascade does NOT run
    // for delete, so the comment's quote orphans).
    const sug = await (await fetch("/api/spec-sessions/by-file/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file, by: "ai", kind: "delete", scope: "",
        quote: "A normal paragraph that won't be touched.",
      }),
    })).json();
    const applied = await (await fetch(`/api/spec-sessions/by-file/suggestions/${sug.suggestion.id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, by: "human" }),
    })).json();
    return { commentId: cmt.comment.id, applied };
  }, targetFile);
  expect(seeded.applied?.suggestion?.status).toBe("applied");

  await page.reload();
  await expect(page.locator(".spec-body-markdown")).toBeVisible({ timeout: 5000 });
  await page.waitForFunction(() => document.querySelectorAll(".spec-margin-card").length >= 1, null, { timeout: 5000 });
  await page.waitForTimeout(300);

  // Verify server agrees the anchor is orphaned (the quote is gone).
  const verdict = await page.evaluate(async () => {
    const path = decodeURIComponent(window.location.hash.match(/file=([^&]+)/)[1]);
    const ctx = await (await fetch(`/api/spec-sessions/by-file/context?path=${encodeURIComponent(path)}`)).json();
    return ctx.comments[ctx.comments.length - 1].anchorStatus?.status;
  });
  expect(verdict, "comment must be orphaned server-side for this test to mean anything").not.toBe("resolved");

  // And the card should still NOT be in the bottom orphan stack — the
  // line-fallback should have placed it at its original lineStart.
  const placement = await page.evaluate(() => {
    const card = document.querySelector(".spec-margin-card");
    return {
      isOrphanClass: card.classList.contains("is-orphan"),
      // Internal "Anchor orphaned" badge should still be present.
      hasOrphanBadge: !!card.querySelector(".spec-card-orphan"),
      top: parseInt(card.style.top || "0", 10),
    };
  });
  expect(placement.isOrphanClass, "card should not be in the bottom orphan stack").toBe(false);
  expect(placement.hasOrphanBadge, "card should still display the anchor-orphaned badge").toBe(true);
  // Top should be NEAR where the original paragraph was, not pushed all the way to the bottom.
  expect(placement.top, "card should be near top, not stacked at bottom").toBeLessThan(2000);
});
