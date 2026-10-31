import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const git = (root, ...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true, stdio: "pipe" }).trim();
const text = (index, status, current = false) => `---\nid: plan-${index}\ntitle: Plan ${index} ${current ? "current" : "historical"} — a long real-world planning title\nstatus: ${status}\npriority: high\ncommitment: committed\nlane: Lane ${Number(index) % 8 + 1} — a long planning stream name\nmilestone: Milestone ${Number(index) % 12 + 1}\n---\n\n## Summary\n\nA detailed ${current ? "current" : "historical"} feature description for plan ${index}, with enough text to test narrow and dense board layouts.\n`;
async function fixture() {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-status-ui-"));
  const main = path.join(owned, "main"), old = path.join(owned, "historical");
  await fs.mkdir(path.join(main, "roadmap/features"), { recursive: true });
  await fs.mkdir(path.join(main, "roadmap/ideas"));
  await fs.writeFile(path.join(main, "roadmap/ideas/.keep"), "");
  const ids = Array.from({ length: 64 }, (_, index) => String(index).padStart(2, "0"));
  await fs.writeFile(path.join(main, "roadmap/board.md"), Array.from({ length: 8 }, (_, index) => `# Planning section ${index + 1}\n${ids.slice(index * 8, index * 8 + 8).map((id) => `- plan-${id}`).join("\n")}\n`).join("\n"));
  await fs.writeFile(path.join(main, "roadmap/scope.md"), "Generic large-board qualification.\n");
  await fs.writeFile(path.join(main, "roadmap.config.json"), JSON.stringify({ roadmapPath: "roadmap",
    lenses: { fields: { lane: { draggable: true }, milestone: {} } }, appearance: { cardFields: ["status", "priority", "milestone"] } }));
  for (const id of ids) await fs.writeFile(path.join(main, `roadmap/features/plan-${id}.md`), text(id, Number(id) % 3 ? "queued" : "active"));
  git(main, "init", "-b", "main"); git(main, "config", "user.name", "Test"); git(main, "config", "user.email", "test@example.invalid");
  git(main, "config", "core.autocrlf", "false"); git(main, "add", "."); git(main, "commit", "-m", "generic large board");
  git(main, "worktree", "add", "-b", "topic/historical", old);
  for (const id of ids.filter((id) => Number(id) % 2 === 0)) await fs.writeFile(path.join(main, `roadmap/features/plan-${id}.md`), text(id, "done", true));
  git(main, "add", "."); git(main, "commit", "-m", "complete even features");
  await fs.writeFile(path.join(old, "unrelated.txt"), "Unrelated branch work.\n"); git(old, "add", "."); git(old, "commit", "-m", "advance unrelated branch");
  const files = [main, old].flatMap((root) => ["board.md", ...ids.map((id) => `features/plan-${id}.md`)].map((file) => path.join(root, "roadmap", file)));
  return { owned, old, files, before: await Promise.all(files.map((file) => fs.readFile(file))) };
}

async function lens(page, key) {
  await page.locator("#board-view-toggle").click(); await page.locator(`[data-lens-key="${key}"]`).click();
}

for (const mode of ["this", "across"]) {
  test(`${mode}: dense board preserves historical documents while resolving only proven status`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const { owned, old, files, before } = await fixture();
    const captures = path.resolve("artifacts", "status-captures"); await fs.mkdir(captures, { recursive: true });
    try {
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(`/#repo=${encodeURIComponent(old)}&sources=${mode}&layout=columns&lens=lane`);
      if (mode === "across") await expect(page.locator("#board-source-status-details")).toContainText("2 worktrees loaded");
      await expect(page.locator(".board-item-title")).toHaveCount(64);
      for (const layout of ["columns", "list"]) {
        const tab = page.locator(`#board-layout-${layout}`);
        if (await tab.getAttribute("aria-selected") !== "true") await tab.click();
        await lens(page, "lane");
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: width === 390 ? 840 : 960 });
          if (width === 390 && layout === "list") {
            await expect(page.locator("#jump-to-board")).toBeVisible();
            await page.locator("#jump-to-board").click();
            await expect.poll(() => page.locator("#board-panel").evaluate((node) => Math.abs(Math.round(node.getBoundingClientRect().top)))).toBeLessThanOrEqual(2);
          }
          await expect(page.locator(".board-item-title")).toHaveCount(64);
          expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
          const capture = path.join(captures, `${mode}-${layout}-${width}.png`);
          await page.screenshot({ path: capture }); await testInfo.attach(`${mode}-${layout}-${width}`, { path: capture, contentType: "image/png" });
        }
        await page.setViewportSize({ width: 1440, height: 960 });
        await page.locator("#board-search").fill("plan 00 historical");
        const card = page.locator(layout === "list" ? ".board-item" : ".board-column-card").filter({ has: page.locator('.board-item-title[title^="Plan 00 historical"]') });
        await expect(card).toHaveCount(1);
        await expect(card.locator(".recorded-status")).toHaveText(mode === "across" ? "Done" : "Active");
        if (mode === "across") {
          await page.locator("#board-filter-toggle").click();
          await page.locator('[data-filter-key="status"][data-filter-value="active"]').click();
          await expect(page.locator(".board-item-title")).toHaveCount(0);
          await page.locator('[data-filter-key="status"][data-filter-value="active"]').click();
          await page.locator('[data-filter-key="status"][data-filter-value="done"]').click();
          await expect(card).toHaveCount(1);
          await page.locator("#board-filter-toggle").click();
          await lens(page, "status");
          await expect(page.locator(layout === "list" ? ".group-name" : ".board-column-name")).toHaveText(["done"]);
          await lens(page, "lane");
        }
        await (layout === "list" ? card : card.locator("[data-item-open]")).click();
        await expect(page.locator("#editor-title")).toContainText("Plan 00 historical");
        await expect(page.locator("#item-preview .preview-activity .recorded-status")).toHaveText(mode === "across" ? "Done" : "Active");
        if (mode === "across") {
          await page.locator("#editor-source-summary").click();
          const historical = page.locator("[data-editor-source]").filter({ hasText: "topic/historical" });
          await expect(historical).toContainText("Historical status"); await historical.click();
          await expect(page).toHaveURL(/source=/);
          await page.reload();
          await expect(page.locator("#board-source-status-details")).toContainText("2 worktrees loaded");
          await expect(page.locator("#editor-title")).toContainText("Plan 00 historical");
          await expect(page.locator("#item-preview .preview-activity .recorded-status")).toHaveText("Done");
          if (layout === "columns") await page.keyboard.press("Escape");
          await page.locator("#board-search").fill("plan 00 current");
          await expect(page.locator('.board-item-title[title^="Plan 00 current"]')).toHaveCount(1);
          if (layout === "list") await expect(page.locator("#editor-title")).toContainText("Plan 00 historical");
          await Promise.all([
            page.waitForResponse((response) => response.url().includes("/api/worktree-workspace") && !response.url().includes("openedOnly=1") && response.status() === 200),
            page.locator("#refresh-button").click(),
          ]);
          if (layout === "columns") await page.locator(".board-column-card")
            .filter({ has: page.locator('.board-item-title[title^="Plan 00 current"]') }).locator("[data-item-open]").click();
          await expect(page.locator("#editor-title")).toContainText("Plan 00 historical");
          await expect(page.locator("#item-preview .preview-activity .recorded-status")).toHaveText("Done");
          await page.locator("#editor-source-summary").click();
          const filteredHistorical = page.locator("[data-editor-source]").filter({ hasText: "topic/historical" });
          await expect(filteredHistorical).toHaveAttribute("aria-pressed", "true");
          await expect(filteredHistorical).toContainText("filtered out");
          await page.locator("#editor-source-summary").click();
          await page.locator(".preview-selected-version summary").click();
          await expect(page.locator('.preview-selected-version [data-metadata-field="status"]')).toHaveText("active");
          const detail = path.join(captures, `${mode}-${layout}-pinned.png`); await page.screenshot({ path: detail });
          let confirmation = "";
          page.once("dialog", async (dialog) => { confirmation = dialog.message(); await dialog.dismiss(); });
          await page.locator("#tab-structured").click();
          expect(confirmation).toContain("Edit only"); expect(confirmation.toLowerCase()).toContain(path.resolve(old).toLowerCase());
          await expect(page.locator("#editor-title")).toContainText("Plan 00 historical");
        }
        await page.keyboard.press("Escape");
        if (mode === "across") {
          await page.locator("#board-clear-filters").click();
        }
        await page.locator("#board-search").fill("");
        await lens(page, "milestone"); await expect(page.locator(".board-item-title")).toHaveCount(64);
      }
      expect(await Promise.all(files.map((file) => fs.readFile(file)))).toEqual(before);
    } finally {
      expect(path.dirname(owned)).toBe(os.tmpdir()); expect(path.basename(owned)).toMatch(/^minimap-status-ui-/);
      await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  });
}
