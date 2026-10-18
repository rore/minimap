import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("List layout makes one immediate board rebuild and retains selection", async ({ page }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-list-render-"));
  const features = path.join(root, "roadmap", "features");
  const ids = Array.from({ length: 24 }, (_, index) => `item-${String(index + 1).padStart(2, "0")}`);
  try {
    await fs.mkdir(features, { recursive: true });
    await fs.mkdir(path.join(root, "roadmap", "ideas"), { recursive: true });
    await fs.writeFile(path.join(root, "roadmap", "board.md"), `# Delivery\n${ids.map((id) => `- ${id}`).join("\n")}\n`);
    await fs.writeFile(path.join(root, "roadmap", "scope.md"), "List render regression fixture.\n");
    await fs.writeFile(path.join(root, "roadmap.config.json"), JSON.stringify({ roadmapPath: "roadmap" }));
    await Promise.all(ids.map((id) => fs.writeFile(path.join(features, `${id}.md`),
      `---\nid: ${id}\ntitle: Feature ${id}\nstatus: queued\npriority: medium\ncommitment: committed\n---\n\n## Summary\n\nFeature ${id}.\n`)));

    await page.addInitScript(() => {
      window.__boardRebuilds = 0;
      const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
      Object.defineProperty(Element.prototype, "innerHTML", {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        get() { return descriptor.get.call(this); },
        set(value) {
          if (this.id === "board-groups") window.__boardRebuilds += 1;
          return descriptor.set.call(this, value);
        },
      });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/#repo=${encodeURIComponent(root)}&layout=columns`);
    await expect(page.locator("#board-groups .board-column-card-main")).toHaveCount(ids.length);

    const immediateRebuilds = await page.evaluate(() => {
      window.__boardRebuilds = 0;
      document.querySelector("#board-layout-list").click();
      return window.__boardRebuilds;
    });
    expect(immediateRebuilds).toBe(1);
    await expect(page.locator("#board-layout-list")).toHaveClass(/is-active/);
    await expect(page.locator("#board-groups .board-item")).toHaveCount(ids.length);
    await expect(page.locator("#item-preview .preview-title")).toHaveText("Feature item-01");
    await expect(page).toHaveURL(/boardView=1&item=item-01/);
    await page.screenshot({ path: test.info().outputPath("list-desktop.png"), fullPage: true });

    const search = page.locator("#board-search");
    await search.fill("Featur");
    await expect(page.locator("#board-groups .board-item")).toHaveCount(ids.length);
    await page.locator("#board-groups").evaluate((root) => { root.scrollTop = 220; });
    const scrollBefore = await page.locator("#board-groups").evaluate((root) => root.scrollTop);
    const originalCard = await page.locator('[data-item-id="item-01"]').first().elementHandle();
    const sameResultRebuilds = await page.evaluate(() => {
      window.__boardRebuilds = 0;
      const input = document.querySelector("#board-search");
      input.value = "Feature";
      input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "e" }));
      return window.__boardRebuilds;
    });
    expect(sameResultRebuilds).toBe(0);
    expect(await originalCard.evaluate((element) => element.isConnected)).toBe(true);
    expect(await page.locator("#board-groups").evaluate((root) => root.scrollTop)).toBe(scrollBefore);
    await expect(page).toHaveURL(/q=feature/);
    await expect(page.locator("#item-preview .preview-title")).toHaveText("Feature item-01");
    await originalCard.dispose();

    await page.locator("#tab-structured").click();
    if (await page.locator(".metadata-details").getAttribute("open") === null) await page.locator("#metadata-toggle").click();
    await page.locator("#field-title").fill("Unsaved performance draft");
    await search.fill("Featur");
    await expect(page.locator("#field-title")).toHaveValue("Unsaved performance draft");
    await expect(page).toHaveURL(/q=featur/);
    await search.fill("Feature item-01");
    await expect(page.locator("#board-groups .board-item")).toHaveCount(1);
    await expect(page.locator("#field-title")).toHaveValue("Unsaved performance draft");
    await search.fill("");
    await expect(page.locator("#board-groups .board-item")).toHaveCount(ids.length);
    await page.locator("#editor-cancel-button").click();

    await page.locator("#board-layout-columns").click();
    await expect(page.locator("#board-groups .board-column-card-main")).toHaveCount(ids.length);
    await page.screenshot({ path: test.info().outputPath("columns-desktop.png"), fullPage: true });
    await search.fill("Featur");
    await expect(page.locator("#board-groups .board-column-card-main")).toHaveCount(ids.length);
    await page.locator(".board-column-list").first().evaluate((list) => { list.scrollTop = 220; });
    const columnScrollBefore = await page.locator(".board-column-list").first().evaluate((list) => list.scrollTop);
    const originalColumnCard = await page.locator('[data-item-dblopen="item-01"]').first().elementHandle();
    const sameColumnRebuilds = await page.evaluate(() => {
      window.__boardRebuilds = 0;
      const input = document.querySelector("#board-search");
      input.value = "Feature";
      input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "e" }));
      return window.__boardRebuilds;
    });
    expect(sameColumnRebuilds).toBe(0);
    expect(await originalColumnCard.evaluate((element) => element.isConnected)).toBe(true);
    expect(await page.locator(".board-column-list").first().evaluate((list) => list.scrollTop)).toBe(columnScrollBefore);
    await originalColumnCard.dispose();
    await search.fill("");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: test.info().outputPath("columns-narrow.png") });
    await page.locator("#board-layout-list").click();
    await expect(page.locator("#board-groups .board-item")).toHaveCount(ids.length);
    await page.screenshot({ path: test.info().outputPath("list-narrow.png") });
  } finally {
    await page.goto("about:blank");
    await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("Across redraws a matching card when its versions narrow but its primary source stays", async ({ page }) => {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-search-versions-"));
  const root = path.join(owned, "main");
  const sibling = path.join(owned, "blue");
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  try {
    await fs.mkdir(path.join(root, "roadmap", "features"), { recursive: true });
    await fs.mkdir(path.join(root, "roadmap", "ideas"), { recursive: true });
    await fs.writeFile(path.join(root, "roadmap", "ideas", ".gitkeep"), "");
    await fs.writeFile(path.join(root, "roadmap", "board.md"), "# Delivery\n- shared\n");
    await fs.writeFile(path.join(root, "roadmap", "scope.md"), "Across search version fixture.\n");
    await fs.writeFile(path.join(root, "roadmap.config.json"), JSON.stringify({ roadmapPath: "roadmap" }));
    const item = path.join("roadmap", "features", "shared.md");
    await fs.writeFile(path.join(root, item), "---\nid: shared\ntitle: Shared common title\nstatus: queued\npriority: medium\ncommitment: committed\n---\n\n## Summary\n\nShared work.\n");
    git("init", "-b", "main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.invalid");
    git("config", "core.autocrlf", "false");
    git("add", ".");
    git("commit", "-m", "base");
    git("worktree", "add", "-b", "feature/blue", sibling);
    await fs.writeFile(path.join(sibling, item), "---\nid: shared\ntitle: Shared alternative title\nstatus: queued\npriority: medium\ncommitment: committed\n---\n\n## Summary\n\nShared work.\n");

    await page.goto(`/#repo=${encodeURIComponent(root)}`);
    await page.locator("#board-source-toggle").click();
    await page.locator('#board-source-menu [data-source-choice="across"]').click();
    await expect(page.locator("#board-source-status-details")).toContainText("2 roadmap checkouts loaded");
    const search = page.locator("#board-search");
    await search.fill("shared");
    const card = page.locator("#board-groups .board-item").filter({ hasText: "Shared common title" });
    await expect(card.locator(".board-source-badge").first()).toHaveText("2 checkouts");
    await search.fill("common");
    await expect(card).toBeVisible();
    await expect(card.locator(".board-source-badge").first()).not.toHaveText("2 checkouts");
    await expect(page.locator("#board-groups .board-item")).toHaveCount(1);
  } finally {
    await page.goto("about:blank");
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
