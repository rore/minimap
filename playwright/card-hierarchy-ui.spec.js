import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Private visual examples stay outside version control; CI uses the generic fixture.
const example = process.env.MINIMAP_CARD_EXAMPLE_JSON
  ? JSON.parse(await fs.readFile(process.env.MINIMAP_CARD_EXAMPLE_JSON, "utf8"))
  : {
    id: "portable-task-hook",
    title: "Run a read-only task hook in two supported runtimes",
    summary: "Build a portable read-only action that checks a task, classifies its current status, and returns a typed result. Execute the same artifact in two supported runtimes and verify that both sample hosts consume the classification.",
    repo: "sample-core",
  };
const { title, summary, repo } = example;
const featuredId = example.id;
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim();

async function fixture(page, dense = true) {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-card-hierarchy-"));
  const root = path.join(owned, "main");
  const features = path.join(root, "roadmap", "features");
  await fs.mkdir(features, { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"));
  await fs.writeFile(path.join(root, "roadmap", "ideas", ".gitkeep"), "");
  const ids = [featuredId, ...Array.from({ length: 59 }, (_, i) => `card-${i + 2}`)];
  const lanes = Array.from({ length: 10 }, (_, i) => `Lane ${i + 1} · long real-world release workstream`);
  await fs.writeFile(path.join(root, "roadmap", "board.md"), lanes.flatMap((lane, i) => [
    `# ${lane}`, ...(dense ? (i === 0 ? ids.slice(0, 15) : ids.slice(15 + (i - 1) * 5, 20 + (i - 1) * 5)) : ids.slice(i * 6, (i + 1) * 6)).map((id) => `- ${id}`), "",
  ]).join("\n"));
  await fs.writeFile(path.join(root, "roadmap", "scope.md"), "Disposable card hierarchy fixture.\n");
  for (const [i, id] of ids.entries()) {
    await fs.writeFile(path.join(features, `${id}.md`), `---\nid: ${id}\ntitle: ${i === 0 ? title : `${id} — long feature title covering substantial project work`}\nstatus: ${i === 0 ? "active" : "queued"}\npriority: high\ncommitment: committed\nmilestone: Milestone ${i % 12 + 1} · a long planning horizon\nrepo: ${repo}\n${i === 1 ? "area: A long cross-team release coordination label with an unbroken-token-abcdefghijklmnopqrstuvwxyz0123456789\n" : ""}---\n\n## Summary\n\n${i === 0 ? summary : "A realistic description of the work, constraints and expected result, long enough to exercise the card's available reading width."}\n`);
  }
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.invalid");
  git(root, "config", "core.autocrlf", "false");
  git(root, "add", ".");
  git(root, "commit", "-m", "shared feature history");
  for (const [i, status] of ["in-progress", "queued", "active"].entries()) {
    const sibling = path.join(owned, `worktree-${i + 1}`);
    git(root, "worktree", "add", "-b", `feature/worktree-${i + 1}`, sibling);
    const item = path.join(sibling, "roadmap", "features", `${featuredId}.md`);
    await fs.writeFile(item, (await fs.readFile(item, "utf8")).replace("status: active", `status: ${status}`));
    if (i === 2) await fs.appendFile(item, "\n## Notes\n\nA body-only difference in the fourth checkout.\n");
  }
  let count = 2;
  let key;
  await page.route("**/api/worktree-workspace**", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    key = payload.features?.find((feature) => feature.id === featuredId)?.key || key;
    await route.fulfill({ response, json: payload });
  });
  await page.route("**/api/board/observations**", (route) => route.fulfill({ json: {
    status: "ok", partial: false, asOf: new Date().toISOString(), recentSeconds: 86400,
    counts: [{ ...(key ? { featureKey: key } : { itemId: featuredId }), participantCount: count, recentParticipantCount: count, dormantParticipantCount: 0 }],
  } }));
  return { owned, root, setCount: (value) => { count = value; } };
}

function card(page, layout) {
  return page.locator(layout === "list" ? ".board-item" : ".board-column-card")
    .filter({ has: page.locator(`.board-item-title[title="${title}"]`) });
}

async function setLayout(page, layout) {
  const tab = page.locator(`#board-layout-${layout}`);
  if (await tab.getAttribute("aria-selected") !== "true") await tab.click();
}

async function expectConfiguredCard(page, layout) {
  const current = card(page, layout);
  await expect(current).toHaveClass(/board-card-configured-fields/);
  await expect(current.locator('[data-metadata-field="repo"]')).toHaveClass(/badge-tone-appearance-blue/);
  await expect(current.locator('[data-metadata-field]')).toHaveCount(3);
  expect(await current.locator('[data-metadata-field]').evaluateAll((elements) => elements.map((element) => element.dataset.metadataField)))
    .toEqual(["status", "priority", "repo"]);
}

async function capture(page, name, testInfo, subject = page) {
  const output = path.resolve("artifacts", "card-hierarchy", process.env.CARD_HIERARCHY_PHASE || "final", `${name}.png`);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await subject.screenshot({ path: output });
  await testInfo.attach(name, { path: output, contentType: "image/png" });
}

for (const density of ["dense", "normal"]) test(`realistic card hierarchy visual matrix ${density}`, async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const { owned, root } = await fixture(page, density === "dense");
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across&layout=columns`);
    await expect(page.locator("#board-source-status-details")).toContainText("4 worktrees loaded");
    for (const configured of [false, true]) {
      if (configured) {
        await fs.writeFile(path.join(root, "roadmap.config.json"), JSON.stringify({ roadmapPath: "roadmap", appearance: {
          cardFields: ["status", "priority", "repo"], tagColors: { repo: { [repo]: "blue" } },
        } }));
        await Promise.all([
          page.waitForResponse((response) => {
            const url = new URL(response.url());
            return url.pathname === "/api/worktree-workspace" && !url.searchParams.has("openedOnly") && !url.searchParams.has("cached");
          }).then((response) => response.finished()),
          page.locator("#refresh-button").click(),
        ]);
        await expect(page.locator("#board-source-status-details")).toContainText("4 worktrees loaded");
      }
      for (const layout of ["columns", "list"]) {
        await setLayout(page, layout);
        if (configured) await expectConfiguredCard(page, layout);
        await expect(card(page, layout).locator(".board-item-participants:visible")).toHaveText("2 linked sessions");
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: width === 390 ? 840 : 960 });
          if (layout === "list" && width === 390) await page.locator("#jump-to-board").click();
          await expect(card(page, layout)).toBeVisible();
          if (!configured && (layout === "list" || density === "normal")) {
            const longBadge = page.locator(layout === "list" ? '.board-item .badge-field-area' : '.board-column-card .badge-field-area').first();
            await expect(longBadge).toBeVisible();
            expect(await longBadge.evaluate((element) => element.getBoundingClientRect().right <= element.closest('.board-item, .board-column-card').getBoundingClientRect().right)).toBe(true);
          }
          if (configured) await expectConfiguredCard(page, layout);
          await expect(page.locator("#board-source-status-summary")).not.toContainText("Loading worktrees");
          await capture(page, `${density}-${configured ? "configured" : "default"}-${layout}-${width}`, testInfo);
          if (density === "normal" && configured && layout === "columns" && width === 1440) {
            await capture(page, "featured-card", testInfo, card(page, layout));
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
        }
        await page.setViewportSize({ width: 1440, height: 960 });
        if (layout === "columns") {
          for (const toggle of await page.locator('.board-column:not(:first-child) [data-group-toggle]').all()) await toggle.click();
          await expect(card(page, layout).locator(".board-item-overview")).toBeVisible();
          if (configured) await expectConfiguredCard(page, layout);
          await capture(page, `${density}-${configured ? "configured" : "default"}-columns-focused-1440`, testInfo);
          const collapsedCount = await page.locator('.board-column-collapsed').count();
          for (let i = 0; i < collapsedCount; i++) await page.locator('.board-column-collapsed [data-group-toggle]').first().click();
        }
      }
    }
    expect(errors).toEqual([]);
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("Read tags follow configured fields while primary status and Edit/Raw metadata stay complete", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const { owned, root } = await fixture(page, false);
  const configPath = path.join(root, "roadmap.config.json");
  const selectedConfig = { roadmapPath: "roadmap", appearance: {
    cardFields: ["repo", "status", "priority"], tagColors: { repo: { [repo]: "blue" } },
  } };
  const assertReadTags = async () => {
    await expect(page.locator('#item-preview .preview-meta [data-metadata-field]')).toHaveCount(2);
    expect(await page.locator('#item-preview .preview-meta [data-metadata-field]').evaluateAll((elements) => elements.map((element) => element.dataset.metadataField)))
      .toEqual(["repo", "priority"]);
    await expect(page.locator('#item-preview .preview-meta [data-metadata-field="repo"]')).toHaveClass(/badge-tone-appearance-blue/);
    await expect(page.locator('#item-preview .preview-activity .recorded-status')).toHaveCount(1);
    await expect(page.locator('#item-preview .preview-meta [data-metadata-field="status"]')).toHaveCount(0);
  };
  try {
    for (const mode of ["this", "across"]) {
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(`/#repo=${encodeURIComponent(root)}&layout=list${mode === "across" ? "&sources=across" : ""}`);
      if (mode === "across") await expect(page.locator("#board-source-status-details")).toContainText("4 worktrees loaded");
      await card(page, "list").click();
      await expect(page.locator("#editor-title")).toHaveText(title);
      await expect(page.locator("#item-preview .preview-meta")).toContainText("committed");
      await expect(page.locator("#item-preview .preview-meta")).toContainText("Milestone 1");
      await fs.writeFile(configPath, JSON.stringify(selectedConfig));
      await page.locator("#refresh-button").click();
      await assertReadTags();
      await expect(page.locator("#related-work > summary")).not.toContainText("Loading");
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 840 : 960 });
        await expect(page.locator("#item-preview")).toBeVisible();
        await capture(page, `read-${mode}-${width}`, testInfo);
      }
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.locator("#tab-structured").click();
      if (await page.locator(".metadata-details").getAttribute("open") === null) await page.locator("#metadata-toggle").click();
      await expect(page.locator("#field-id")).toHaveValue(featuredId);
      await expect(page.locator("#field-commitment")).toHaveValue("committed");
      await expect(page.locator("#field-milestone")).toHaveValue("Milestone 1 · a long planning horizon");
      await page.locator("#tab-raw").click();
      await expect(page.locator("#raw-text")).toHaveValue(/commitment: committed/);
      await expect(page.locator("#raw-text")).toHaveValue(/milestone: Milestone 1/);
      await page.locator("#tab-preview").click();
      await assertReadTags();
      if (mode === "across") {
        await page.locator("#editor-source-summary").click();
        const choice = page.locator('#editor-source-label [data-editor-source][aria-pressed="false"]').first();
        const expectedStatus = await choice.locator('.badge-field-status').textContent();
        await choice.click();
        await expect(page.locator("#field-status")).toHaveValue(expectedStatus);
        await assertReadTags();
        await expect(page.locator(".preview-selected-version")).toBeVisible();
      }
      await page.getByRole("button", { name: /^Open card-2 —/ }).click();
      await expect(page.locator("#editor-title")).toContainText("card-2");
      await card(page, "list").click();
      await expect(page.locator("#editor-title")).toHaveText(title);
      await assertReadTags();
      await fs.writeFile(configPath, JSON.stringify({ roadmapPath: "roadmap", appearance: { cardFields: [] } }));
      await page.locator("#refresh-button").click();
      await expect(page.locator("#item-preview .preview-meta")).toHaveCount(0);
      await expect(page.locator("#item-preview .preview-activity .recorded-status")).toHaveCount(1);
      await fs.rm(configPath);
      await page.locator("#refresh-button").click();
      await expect(page.locator("#item-preview .preview-meta")).toContainText("committed");
      await expect(page.locator("#item-preview .preview-meta")).toContainText("Milestone 1");
    }
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("card hierarchy keeps one full-width context footer through live refresh and field hiding", async ({ page }) => {
  const { owned, root, setCount } = await fixture(page);
  try {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across&layout=columns`);
    await expect(page.locator("#board-source-status-details")).toContainText("4 worktrees loaded");
    for (const layout of ["columns", "list"]) {
      await setLayout(page, layout);
      const current = card(page, layout);
      await expect(current.locator(".board-item-id")).toHaveCount(0);
      await expect(current.locator(".board-card-signals")).toHaveCount(0);
      await expect(current.locator(".recorded-status")).toHaveCount(1);
      await expect(current.locator(".board-card-footer")).toHaveCount(1);
      await expect(current.locator(".board-source-conflict")).toHaveText("Differences");
      await expect(current.locator(".board-source-conflict")).toHaveAttribute("aria-label", /Statuses differ/);
      await expect(layout === "list" ? current : current.locator("[data-item-open]")).toHaveAttribute("aria-description", /Statuses differ/);
      await expect(current.locator(".board-source-badge:not(.board-source-conflict)")).toHaveText("4 worktrees");
      await expect(current.locator(".board-item-participants")).toHaveCount(1);
      await expect(current.locator(".board-item-participants")).toHaveText("2 linked sessions");
      if (layout === "columns") {
        for (const toggle of await page.locator('.board-column:not(:first-child) [data-group-toggle]').all()) await toggle.click();
        await expect(current.locator(".board-item-overview")).toBeVisible();
        expect(await current.locator(".board-item-overview").evaluate((element) => element.getBoundingClientRect().width))
          .toBeGreaterThan((await current.boundingBox()).width - 30);
        await current.locator("[data-item-open]").dispatchEvent("dblclick");
        await expect(page.locator("#editor-overlay")).toBeHidden();
        await current.locator(".board-item-title").dblclick();
        await expect(page.locator("#editor-overlay")).toBeVisible();
        await expect(page.locator("#editor-title")).toHaveText(title);
        await page.keyboard.press("Escape");
        await expect(page.locator("#editor-overlay")).toBeHidden();
      } else {
        await expect(current.locator("button, a, input, select")).toHaveCount(0);
        await expect(current.locator(".board-item-overview")).toContainText(summary.slice(0, 40));
      }
      await current.evaluate((element) => { window.hierarchyCard = element; });
      setCount(3);
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await expect(current.locator(".board-item-participants")).toHaveText("3 linked sessions");
      expect(await current.evaluate((element) => element === window.hierarchyCard)).toBe(true);
      await expect(current.locator(".board-item-participants")).toHaveCount(1);
      setCount(2);
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await expect(current.locator(".board-item-participants")).toHaveText("2 linked sessions");
    }
    await fs.writeFile(path.join(root, "roadmap.config.json"), JSON.stringify({ roadmapPath: "roadmap", appearance: { cardFields: [] } }));
    await page.locator("#refresh-button").click();
    await expect(card(page, "list").locator("[data-metadata-field]")).toHaveCount(0);
    await expect(card(page, "list").locator(".board-source-conflict")).toHaveAttribute("aria-label", /Statuses differ/);
    await page.locator("#board-search").fill(featuredId);
    await expect(card(page, "list")).toBeVisible();
    await card(page, "list").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#editor-source-summary")).toContainText("Statuses differ");
    await page.locator("#editor-source-summary").click();
    await expect(page.locator("#editor-source-label [data-editor-source]")).toHaveCount(4);
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("empty card footer updates without replacing cards, losing focus or scrolling", async ({ page }) => {
  const { owned, root, setCount } = await fixture(page);
  setCount(0);
  try {
    await fs.writeFile(path.join(root, "roadmap.config.json"), JSON.stringify({ roadmapPath: "roadmap", appearance: { cardFields: [] } }));
    await fs.appendFile(path.join(root, "roadmap", "board.md"), "\n- missing-card\n");
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/#repo=${encodeURIComponent(root)}&lens=kind&layout=list`);
    for (const layout of ["list", "columns"]) {
      await setLayout(page, layout);
      const current = card(page, layout);
      const footer = current.locator(".board-card-footer");
      await expect(current.locator(".board-card-metadata")).toHaveCount(0);
      await expect(footer).toBeHidden();
      await expect(current.locator(".board-item-participants")).toHaveCount(0);
      const focusable = layout === "list" ? current : current.locator("[data-item-open]");
      await focusable.focus();
      const scroller = layout === "list" ? page.locator("#board-groups") : page.locator(".board-column-list").first();
      await scroller.evaluate((element) => { element.scrollTop = 40; });
      const scrollBefore = await scroller.evaluate((element) => element.scrollTop);
      await current.evaluate((element) => { window.hierarchyEmptyCard = element; });
      for (const count of [2, 0]) {
        setCount(count);
        await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
        await expect(current.locator(".board-item-participants")).toHaveCount(count ? 1 : 0);
        if (count) await expect(footer).toHaveText("2 linked sessions");
        else await expect(footer).toBeHidden();
        expect(await current.evaluate((element) => element === window.hierarchyEmptyCard)).toBe(true);
        await expect(focusable).toBeFocused();
        expect(await scroller.evaluate((element) => element.scrollTop)).toBe(scrollBefore);
      }
    }
    await page.locator("#board-view-toggle").click();
    await page.locator('[data-lens-key="board"]').click();
    await expect(page.locator(".board-item-missing-id")).toHaveText("missing-card");
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
