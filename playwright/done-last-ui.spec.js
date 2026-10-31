import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
}

async function fixture() {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-done-last-"));
  const root = path.join(owned, "main");
  const sibling = path.join(owned, "sibling");
  await fs.mkdir(path.join(root, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"));
  await fs.writeFile(path.join(root, "roadmap", "ideas", ".gitkeep"), "");
  const statuses = ["done", "queued", "active", "done", "custom", "DONE", "shipped", "blocked"];
  const items = Array.from({ length: 60 }, (_, i) => ({
    id: `sample-${String(i + 1).padStart(2, "0")}`, status: statuses[i % statuses.length],
    lane: `Lane ${i % 3 + 1}`, milestone: `Milestone ${String(i % 12 + 1).padStart(2, "0")}`,
  }));
  const manual = Array.from({ length: 10 }, (_, i) => ({ name: `Manual ${i + 1}`, ids: items.slice(i * 6, i * 6 + 6).map(({ id }) => id) }));
  await fs.writeFile(path.join(root, "roadmap", "board.md"), manual.map(({ name, ids }) => `# ${name}\n${ids.map((id) => `- ${id}`).join("\n")}\n`).join("\n"));
  await fs.writeFile(path.join(root, "roadmap", "scope.md"), "Disposable generic browser fixture.\n");
  for (const item of items) {
    await fs.writeFile(path.join(root, "roadmap", "features", `${item.id}.md`), `---\nid: ${item.id}\ntitle: ${item.id} — a deliberately long planning title for a realistic narrow viewport\nstatus: ${item.status}\npriority: high\ncommitment: committed\nlane: ${item.lane}\nmilestone: ${item.milestone}\n---\n\n## Summary\n\nA deliberately long generic summary for ${item.id}, explaining the work without relying on private project data.\n`);
  }
  await fs.writeFile(path.join(root, "roadmap.config.json"), JSON.stringify({
    roadmapPath: "roadmap", filters: { fields: ["lane"] },
    lenses: { fields: Object.fromEntries(["lane", "milestone"].map((key) => [key, { order: [...new Set(items.map((item) => item[key]))] }])) },
    appearance: { cardFields: ["status", "priority", "milestone"] },
  }));
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.invalid");
  git(root, "config", "core.autocrlf", "false");
  git(root, "add", ".");
  git(root, "commit", "-m", "generic fixture");
  git(root, "worktree", "add", "-b", "feature/sibling", sibling);
  for (const [index, status] of [[0, "queued"], [3, "blocked"]]) {
    const file = path.join(sibling, "roadmap", "features", `${items[index].id}.md`);
    await fs.writeFile(file, (await fs.readFile(file, "utf8")).replace("status: done", `status: ${status}`));
  }
  git(sibling, "add", ".");
  git(sibling, "commit", "-m", "mixed statuses");
  // Competing saved versions, not an older status superseded by a clean descendant.
  for (const index of [0, 3]) await fs.appendFile(path.join(root, "roadmap", "features", `${items[index].id}.md`), "\n## Notes\n\nIndependent opened-checkout feature context.\n");
  git(root, "add", "roadmap/features");
  git(root, "commit", "-m", "retain independent opened feature context");
  const files = [root, sibling].flatMap((checkout) => ["board.md", ...items.map(({ id }) => `features/${id}.md`)].map((file) => path.join(checkout, "roadmap", file)));
  const before = await Promise.all(files.map((file) => fs.readFile(file)));
  return { owned, root, items, manual, files, before };
}

async function setLens(page, lens) {
  await page.locator("#board-view-toggle").click();
  await page.locator(`[data-lens-key="${lens}"]`).click();
}

async function groups(page, layout) {
  return page.locator(layout === "list" ? ".board-group" : ".board-column").evaluateAll((nodes, list) => nodes.map((node) => ({
    name: node.querySelector(list ? ".group-name" : ".board-column-name").textContent.trim(),
    ids: [...node.querySelectorAll(".board-item-title")].map((title) => title.getAttribute("title").split(" — ")[0]),
  })), layout === "list");
}

for (const source of ["this", "across"]) {
  test(`${source}: derived Done-last stays stable and view-only`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const data = await fixture();
    const { owned, root, items, manual, files, before } = data;
    const captureDir = path.resolve("artifacts", "done-last-captures");
    await fs.mkdir(captureDir, { recursive: true });
    // Only unanimous normalized Done displays Done; shipped and mixed versions do not.
    const done = (item) => item.status.toLowerCase() === "done" && !(source === "across" && ["sample-01", "sample-04"].includes(item.id));
    const expected = (lens, selected = items) => [...new Set(selected.map((item) => item[lens]))].map((name) => {
      const members = selected.filter((item) => item[lens] === name);
      return { name, ids: [...members.filter((item) => !done(item)), ...members.filter(done)].map((item) => item.id) };
    });
    try {
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(`/#repo=${encodeURIComponent(root)}&sources=${source}&lens=board`);
      if (source === "across") await expect(page.locator("#board-source-status-details")).toContainText("2 worktrees loaded");
      for (const layout of ["list", "columns"]) {
        const tab = page.locator(`#board-layout-${layout}`);
        if (await tab.getAttribute("aria-selected") !== "true") await tab.click();
        await setLens(page, "board");
        await expect.poll(() => groups(page, layout)).toEqual(manual);
        for (const lens of ["lane", "milestone"]) {
          await setLens(page, lens);
          await expect.poll(() => groups(page, layout)).toEqual(expected(lens));
          if (lens === "lane") {
            for (const width of [1440, 390]) {
              await page.setViewportSize({ width, height: width === 390 ? 840 : 960 });
              if (width === 390 && layout === "list") await page.locator("#jump-to-board").click();
              const output = path.join(captureDir, `${source}-${layout}-${width}.png`);
              await page.screenshot({ path: output });
              await testInfo.attach(`${source}-${layout}-${width}`, { path: output, contentType: "image/png" });
              expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
            }
            await page.setViewportSize({ width: 1440, height: 960 });
            const firstDone = items.find((item) => item.lane === "Lane 1" && done(item));
            await page.locator(layout === "list" ? ".board-item" : ".board-column-card")
              .filter({ has: page.locator(`.board-item-title[title^="${firstDone.id} —"]`) }).scrollIntoViewIfNeeded();
            const boundaryOutput = path.join(captureDir, `${source}-${layout}-boundary-1440.png`);
            await page.screenshot({ path: boundaryOutput });
            await testInfo.attach(`${source}-${layout}-boundary-1440`, { path: boundaryOutput, contentType: "image/png" });
          }
        }
        await setLens(page, "lane");
        await page.locator("#board-filter-toggle").click();
        await page.locator('[data-filter-key="lane"][data-filter-value="Lane 1"]').click();
        await expect.poll(() => groups(page, layout)).toEqual(expected("lane", items.filter((item) => item.lane === "Lane 1")));
        await page.locator("#board-search").fill("sample-01");
        await expect.poll(() => groups(page, layout)).toEqual([{ name: "Lane 1", ids: ["sample-01"] }]);
        const current = page.locator(layout === "list" ? ".board-item" : ".board-column-card")
          .filter({ has: page.locator('.board-item-title[title^="sample-01 —"]') });
        const target = layout === "list" ? current : current.locator("[data-item-open]");
        if (source === "across") {
          await expect(current.locator(".board-source-conflict")).toHaveAttribute("aria-label", /Statuses differ/);
        }
        await target.click();
        await expect(page.locator("#editor-title")).toContainText("sample-01");
        await expect(page.locator("#item-preview")).toContainText("A deliberately long generic summary for sample-01");
        await expect(page.locator("#item-preview .preview-activity .recorded-status")).toHaveCount(1);
        await page.keyboard.press("Escape");
        await page.locator("#board-search").fill("");
        await page.locator('[data-filter-key="lane"][data-filter-value="Lane 1"]').click();
        await page.locator("#board-filter-toggle").click();
        await expect.poll(() => groups(page, layout)).toEqual(expected("lane"));
        await setLens(page, "board");
        await expect.poll(() => groups(page, layout)).toEqual(manual);
      }
      expect(await Promise.all(files.map((file) => fs.readFile(file)))).toEqual(before);
    } finally {
      await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  });
}
