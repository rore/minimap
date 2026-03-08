import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const boardPath = path.join(process.cwd(), "roadmap", "board.md");
const featurePath = path.join(process.cwd(), "roadmap", "features", "feature-create-items.md");

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

async function openMetadataDetails(page) {
  const details = page.locator(".metadata-details");
  if ((await details.getAttribute("open")) === null) {
    await page.locator("#metadata-toggle").click();
  }
}

test.describe.configure({ mode: "serial" });

let originalBoardText = "";
let originalFeatureText = "";

test.beforeEach(async ({ page }) => {
  originalBoardText = await fs.readFile(boardPath, "utf8");
  originalFeatureText = await fs.readFile(featurePath, "utf8");
  await page.addInitScript(() => window.localStorage.removeItem("roadmap-ui.scope-collapsed"));
});

test.afterEach(async () => {
  await fs.writeFile(boardPath, originalBoardText, "utf8");
  await fs.writeFile(featurePath, originalFeatureText, "utf8");
});

test("shows repo name and ASCII workspace summary in the header", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/minimap Roadmap/);
  await expect(page.locator("h1")).toContainText("minimap Roadmap");
  await expect(page.locator("#workspace-summary")).toContainText(/\d+ items \/ \d+ groups/);
  await expect(page.locator("#workspace-summary")).not.toContainText("?");
});

test("keeps scope on the right side of the editor and narrower on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");

  const editorBox = await page.locator(".editor-panel").boundingBox();
  const scopeBox = await page.locator(".scope-panel").boundingBox();

  expect(editorBox).not.toBeNull();
  expect(scopeBox).not.toBeNull();
  expect(scopeBox.x).toBeGreaterThan(editorBox.x + 80);
  expect(editorBox.width).toBeGreaterThan(scopeBox.width + 220);
});

test("renders a denser board rail on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");

  const firstCard = page.locator(".board-item").first();
  const box = await firstCard.boundingBox();

  expect(box).not.toBeNull();
  expect(box.height).toBeLessThan(210);
});

test("renders compact board group controls that stay on one row", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");

  const firstHeader = page.locator(".board-group-header").first();
  const toggle = firstHeader.locator(".collapse-toggle");
  const actions = firstHeader.locator(".group-actions");
  const upButton = actions.locator('[data-move-group="up"]');
  const downButton = actions.locator('[data-move-group="down"]');

  await expect(upButton).toContainText("Up");
  await expect(downButton).toContainText("Down");

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
  await page.goto("/");

  const editorPanel = page.locator(".editor-panel");
  const scopePanel = page.locator(".scope-panel");
  const scopeToggle = page.locator("#scope-toggle");
  const scopeContent = page.locator("#scope-content");

  const expandedEditorBox = await editorPanel.boundingBox();
  const expandedScopeBox = await scopePanel.boundingBox();

  await scopeToggle.click();

  await expect(scopePanel).toHaveClass(/scope-collapsed/);
  await expect(scopeToggle).toContainText("Expand");
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
  await page.goto("/");

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
  await page.goto("/");

  await expect(page.locator("#editor-mode-pill")).toHaveCount(0);
  await expect(page.locator("#editor-mode-description")).toHaveCount(0);
  await expect(page.locator('#tab-preview')).toHaveClass(/is-active/);

  await page.locator('#tab-structured').click();
  await expect(page.locator('#tab-structured')).toHaveClass(/is-active/);

  await page.locator('#tab-raw').click();
  await expect(page.locator('#tab-raw')).toHaveClass(/is-active/);
});

test("edit mode starts with details collapsed so content shows earlier", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-editor-mode="structured"]').click();

  const details = page.locator(".metadata-details");
  await expect(details).not.toHaveAttribute("open", "open");
  await expect(page.locator("#metadata-toggle")).toBeVisible();
  await expect(page.locator("#field-title")).toBeHidden();
  await expect(page.locator("#section-summary")).toBeVisible();

  await page.locator("#metadata-toggle").click();
  await expect(details).toHaveAttribute("open", "");
  await expect(page.locator("#field-title")).toBeVisible();
});

test("edit mode stacks sections in one clean column and autosizes long content", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-editor-mode="structured"]').click();

  const whyLabel = page.locator('label:has(#section-why)');
  const inScopeLabel = page.locator('label:has(#section-in-scope)');
  const whyBox = await whyLabel.boundingBox();
  const inScopeBox = await inScopeLabel.boundingBox();

  expect(whyBox).not.toBeNull();
  expect(inScopeBox).not.toBeNull();
  expect(inScopeBox.y).toBeGreaterThan(whyBox.y + whyBox.height - 10);

  const size = await page.locator('#section-in-scope').evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));

  expect(size.scrollHeight).toBeLessThanOrEqual(size.clientHeight + 2);
});

test("loads another board item into the editor when selected", async ({ page }) => {
  await page.goto("/");

  await page.locator('[data-item-id="feature-edit-board-and-scope"]').click();
  await page.locator('[data-editor-mode="structured"]').click();
  await openMetadataDetails(page);

  await expect(page.locator("#field-id")).toHaveValue("feature-edit-board-and-scope");
  await expect(page.locator("#field-title")).toHaveValue("Edit board and scope from the UI");
  await expect(page.locator("#editor-subtitle")).toContainText("feature-edit-board-and-scope.md");
});

test("collapses and expands a board section", async ({ page }) => {
  await page.goto("/");

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

  await page.goto("/");

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
  await page.goto("/");
  await page.locator('[data-editor-mode="structured"]').click();
  await openMetadataDetails(page);

  await page.locator("#field-milestone").fill("P2");
  await page.locator("#save-button").click();

  await expect(page.locator("#status-banner")).toContainText("Saved.");
  await expect(page.locator('[data-item-id="feature-create-items"]')).toContainText("P2");

  const updatedFeatureText = await fs.readFile(featurePath, "utf8");
  expect(updatedFeatureText).toContain("milestone: P2");
});

test("renders extra sections from the item file in the structured editor", async ({ page }) => {
  const nextText = addExtraSection(addMilestone(originalFeatureText, "P3"), "Decision Locks", "- keep the file contract thin");
  await fs.writeFile(featurePath, nextText, "utf8");

  await page.goto("/");
  await page.locator("#refresh-button").click();
  await page.locator('[data-editor-mode="structured"]').click();
  await openMetadataDetails(page);

  await expect(page.locator('[data-extra-section="Decision Locks"]')).toHaveValue("- keep the file contract thin");
  await expect(page.locator("#field-milestone")).toHaveValue("P3");
});

test("preview mode renders markdown from the edit form", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-editor-mode="structured"]').click();

  await page.locator("#section-summary").fill("- keep planning in the repo\n- show `board.md` changes clearly");
  await page.locator('[data-editor-mode="preview"]').click();

  await expect(page.locator("#item-preview ul li").first()).toContainText("keep planning in the repo");
  await expect(page.locator("#item-preview code")).toContainText("board.md");
});

test("raw mode saves full-file edits", async ({ page }) => {
  await page.goto("/");

  await page.locator('[data-editor-mode="raw"]').click();
  await page.locator("#raw-text").fill(replaceTitle(originalFeatureText, "Create roadmap items through raw mode"));
  await page.locator("#save-button").click();

  await expect(page.locator("#status-banner")).toContainText("Saved.");
  await page.locator('[data-editor-mode="structured"]').click();
  await openMetadataDetails(page);
  await expect(page.locator("#field-title")).toHaveValue("Create roadmap items through raw mode");

  const updatedFeatureText = await fs.readFile(featurePath, "utf8");
  expect(updatedFeatureText).toContain('title: "Create roadmap items through raw mode"');
});

test("refresh reloads the workspace after an external file edit", async ({ page }) => {
  await page.goto("/");

  const changedTitle = "Create roadmap items with guided setup";
  await fs.writeFile(featurePath, replaceTitle(originalFeatureText, changedTitle), "utf8");

  await page.locator("#refresh-button").click();
  await page.locator('[data-editor-mode="structured"]').click();
  await openMetadataDetails(page);

  await expect(page.locator("#field-title")).toHaveValue(changedTitle);
  await expect(page.locator('[data-item-id="feature-create-items"]')).toContainText(changedTitle);
});

test("prioritizes the selected item before the board on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 540, height: 1100 });
  await page.goto("/");

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
  await page.goto("/");

  const scopePanel = page.locator(".scope-panel");
  const scopeToggle = page.locator("#scope-toggle");
  const scopeContent = page.locator("#scope-content");

  await scopePanel.scrollIntoViewIfNeeded();
  await expect(scopeContent).toBeVisible();

  await scopeToggle.click();
  await expect(scopePanel).toHaveClass(/scope-collapsed/);
  await expect(scopeToggle).toContainText("Expand");
  await expect(scopeContent).toBeHidden();

  await scopeToggle.click();
  await expect(scopeToggle).toContainText("Collapse");
  await expect(scopeContent).toBeVisible();
});

test("stacked layout provides working jumps between board and item", async ({ page }) => {
  await page.setViewportSize({ width: 540, height: 1100 });
  await page.goto("/");

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
  await page.goto("/");

  await page.locator(".board-panel").scrollIntoViewIfNeeded();
  await page.locator('[data-item-id="feature-edit-board-and-scope"]').click();
  await page.waitForTimeout(250);

  await expect(page.locator("#editor-title")).toHaveText("Edit board and scope from the UI");
  const editorTop = await page.locator(".editor-panel").evaluate((element) => Math.round(element.getBoundingClientRect().top));
  expect(editorTop).toBeLessThan(40);
});
