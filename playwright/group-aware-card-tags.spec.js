import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
}

async function fixture(defaults = false) {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-group-tags-"));
  const root = path.join(owned, "main");
  const sibling = path.join(owned, "sibling");
  const features = path.join(root, "roadmap", "features");
  await fs.mkdir(features, { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"));
  const ids = Array.from({ length: 60 }, (_, i) => `sample-${String(i + 1).padStart(2, "0")}`);
  const lanes = Array.from({ length: 10 }, (_, i) => `Lane ${i + 1} · long planning workstream`);
  const board = lanes.flatMap((lane, i) => [`# ${lane}`, ...(i === 0 ? ids.slice(0, 15) : ids.slice(15 + (i - 1) * 5, 20 + (i - 1) * 5)).map((id) => `- ${id}`), ""]).join("\n");
  await fs.writeFile(path.join(root, "roadmap", "board.md"), board);
  await fs.writeFile(path.join(root, "roadmap", "scope.md"), "Isolated generic browser fixture.\n");
  for (const [i, id] of ids.entries()) {
    const status = i === 0 ? "blocked" : i % 2 ? "queued" : "done";
    const extras = "board: Visible freeform board tag\n" + (defaults ? "" : `repo: ${i ? "sample-repo" : "sample-main"}\nempty_field: ""\ncustom: Long custom metadata label for visual wrapping\n`);
    const body = `---\nid: ${id}\ntitle: ${id} — a deliberately long feature title for narrow screens\nstatus: ${status}\npriority: ${i % 2 ? "low" : "high"}\ncommitment: ${i % 2 ? "planned" : "committed"}\nmilestone: Milestone ${i % 12 + 1} · a long release planning horizon\nteam_name: ${i % 2 ? "Release Crew" : "Platform Alpha"}\nTeam_Name: ${i % 2 ? "Other Key" : "Exact Key"}\n${extras}---\n\n## Summary\n\nA deliberately long summary for ${id} that remains readable in the complete item view.\n`;
    await fs.writeFile(path.join(i === ids.length - 1 ? path.join(root, "roadmap", "ideas") : features, `${id}.md`), body);
  }
  const config = {
    roadmapPath: "roadmap",
    filters: { fields: ["team_name"] },
    appearance: {
      cardFields: ["repo", "milestone", "priority", "commitment", "status", "team_name", "Team_Name", "board", "custom", "empty_field", "absent_field"],
      tagColors: { repo: { "sample-main": "purple" }, custom: { "Long custom metadata label for visual wrapping": "amber" } },
      cardColorBy: "repo",
    },
  };
  if (defaults) delete config.appearance;
  await fs.writeFile(path.join(root, "roadmap.config.json"), JSON.stringify(config, null, 2));
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.invalid");
  git(root, "config", "core.autocrlf", "false");
  git(root, "add", ".");
  git(root, "commit", "-m", "base");
  git(root, "worktree", "add", "-b", "feature/sibling", sibling);
  const changed = path.join(sibling, "roadmap", "features", `${ids[0]}.md`);
  await fs.writeFile(changed, (await fs.readFile(changed, "utf8")).replace("status: blocked", "status: queued"));
  git(sibling, "add", "roadmap/features");
  git(sibling, "commit", "-m", "different linked checkout status");
  // Competing feature edits retain their statuses; clean historical statuses do not.
  await fs.appendFile(path.join(root, "roadmap", "features", `${ids[0]}.md`), "\n## Notes\n\nIndependent opened-checkout feature context.\n");
  git(root, "add", "roadmap/features");
  git(root, "commit", "-m", "retain independent opened feature context");
  return { owned, root, sibling, ids, config };
}

function card(page, layout, id = "sample-01") {
  return page.locator(layout === "list" ? ".board-item" : ".board-column-card")
    .filter({ has: page.locator(`.board-item-title[title^="${id} —"]`) });
}

async function setLayout(page, layout) {
  const tab = page.locator(`#board-layout-${layout}`);
  if (await tab.getAttribute("aria-selected") !== "true") await tab.click();
}

async function fields(target) {
  return target.locator("[data-metadata-field]").evaluateAll((els) => els.map((el) => el.dataset.metadataField));
}

async function setLens(page, lens) {
  await page.locator("#board-view-toggle").click();
  await page.locator(`[data-lens-key="${lens}"]`).click();
}

async function openCard(page, layout) {
  const current = card(page, layout);
  if (layout === "list") await current.click();
  else await current.locator("[data-item-open]").click();
  await expect(page.locator("#editor-title")).toContainText("sample-01");
  await expect(page.locator("#item-preview")).toBeVisible();
}

async function refreshConfig(page, root, config) {
  await fs.writeFile(path.join(root, "roadmap.config.json"), JSON.stringify(config));
  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return ["/api/workspace", "/api/worktree-workspace"].includes(url.pathname)
        && !url.searchParams.has("openedOnly") && !url.searchParams.has("cached");
    }).then((response) => response.finished()),
    page.locator("#refresh-button").click(),
  ]);
}

async function capture(page, testInfo, name) {
  const output = path.resolve("artifacts", "group-aware-card-tags", `${name}.png`);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await page.screenshot({ path: output });
  await testInfo.attach(name, { path: output, contentType: "image/png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
}

test("grouping hides only its exact configured field across layouts and sources", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const { owned, root, ids, config } = await fixture();
  try {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/#repo=${encodeURIComponent(root)}`);
    const expected = config.appearance.cardFields.filter((field) => !["empty_field", "absent_field"].includes(field));
    for (const source of ["this", "across"]) {
      if (source === "across") {
        await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across`);
        await expect(page.locator("#board-source-status-details")).toContainText("2 worktrees loaded");
      }
      for (const layout of ["list", "columns"]) {
        await setLayout(page, layout);
        for (const lens of ["repo", "milestone", "priority", "commitment", "status", "team_name", "Team_Name", "kind"]) {
          await setLens(page, lens);
          const current = card(page, layout);
          if (["repo", "milestone"].includes(lens)) await capture(page, testInfo, `${source}-${layout}-${lens}-1440`);
          const shown = await fields(current);
          expect(shown).toEqual(expected.filter((field) => field !== lens));
          await expect(current).toHaveClass(/board-card-color-purple/);
          await expect(current.locator(".board-item-kind")).toHaveCount(lens === "kind" ? 0 : 1);
          if (source === "across") await expect(current.locator(".board-source-conflict")).toHaveAttribute("aria-label", /Statuses differ/);
          if (["repo", "milestone"].includes(lens)) {
            await page.setViewportSize({ width: 390, height: 840 });
            if (layout === "list") await page.locator("#jump-to-board").click();
            await capture(page, testInfo, `${source}-${layout}-${lens}-390`);
            await page.setViewportSize({ width: 1440, height: 960 });
            await openCard(page, layout);
            await expect.poll(() => fields(page.locator("#item-preview .preview-meta"))).toEqual(expected.filter((field) => field !== "status"));
            await expect(page.locator("#item-preview .preview-activity .recorded-status")).toHaveCount(1);
            if (lens === "repo") {
              await capture(page, testInfo, `${source}-${layout}-read-1440`);
              await page.setViewportSize({ width: 390, height: 840 });
              await capture(page, testInfo, `${source}-${layout}-read-390`);
              await page.setViewportSize({ width: 1440, height: 960 });
            }
            await page.keyboard.press("Escape");
          }
          await setLens(page, "board");
          expect(await fields(card(page, layout))).toEqual(expected);
        }
        await page.locator("#board-view-toggle").click();
        await page.locator('[data-lens-key="team_name"]').click();
        expect(await fields(card(page, layout))).toContain("Team_Name");
        await page.locator("#board-view-toggle").click();
        await page.locator('[data-lens-key="board"]').click();
        expect(await fields(card(page, layout))).toEqual(expected);
        await page.setViewportSize({ width: 1440, height: 960 });
        await capture(page, testInfo, `${source}-${layout}-1440`);
        await page.setViewportSize({ width: 390, height: 840 });
        if (layout === "list") await page.locator("#jump-to-board").click();
        await capture(page, testInfo, `${source}-${layout}-390`);
        await page.setViewportSize({ width: 1440, height: 960 });
      }
    }
    await page.locator("#board-view-toggle").click();
    await page.locator('[data-lens-key="status"]').click();
    await setLayout(page, "list");
    expect(await fields(card(page, "list"))).not.toContain("status");
    await card(page, "list").click();
    await expect(page.locator("#item-preview .preview-activity .recorded-status")).toHaveCount(1);
    await expect.poll(() => fields(page.locator("#item-preview .preview-meta"))).toEqual(expected.filter((field) => field !== "status"));
    await capture(page, testInfo, "read-status-1440");
    await page.setViewportSize({ width: 390, height: 840 });
    await capture(page, testInfo, "read-status-390");
    await page.setViewportSize({ width: 1440, height: 960 });
    const confirmation = page.waitForEvent("dialog");
    const editClick = page.locator("#tab-structured").click();
    const dialog = await confirmation;
    expect(dialog.message()).toMatch(/^Edit only /);
    await dialog.accept();
    await editClick;
    await expect(page.locator("#tab-structured")).toHaveAttribute("aria-selected", "true");
    if (await page.locator(".metadata-details").getAttribute("open") === null) await page.locator("#metadata-toggle").click();
    await expect(page.locator("#field-commitment")).toHaveValue("committed");
    await expect(page.locator("#field-milestone")).toHaveValue("Milestone 1 · a long release planning horizon");
    await page.locator("#tab-raw").click();
    await expect(page.locator("#raw-text")).toHaveValue(/Team_Name: Exact Key/);
    await expect(page.locator("#raw-text")).toHaveValue(/custom: Long custom metadata/);

    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1440, height: 960 });
    await refreshConfig(page, root, { roadmapPath: "roadmap", appearance: { cardFields: [] } });
    await setLayout(page, "columns");
    await page.locator("#board-view-toggle").click();
    await page.locator('[data-lens-key="milestone"]').click();
    await expect(card(page, "columns").locator("[data-metadata-field]")).toHaveCount(0);
    await expect(card(page, "columns").locator(".recorded-status")).toHaveCount(0);
    expect(ids).toHaveLength(60);
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("default grouped status and exact custom fields preserve Read and dense defaults", async ({ page }) => {
  test.setTimeout(90_000);
  const { owned, root } = await fixture(true);
  try {
    await page.setViewportSize({ width: 1440, height: 960 });
    for (const source of ["this", "across"]) {
      await page.goto(`/#repo=${encodeURIComponent(root)}&sources=${source}&lens=board`);
      if (source === "across") await expect(page.locator("#board-source-status-details")).toContainText("2 worktrees loaded");
      for (const layout of ["list", "columns"]) {
        await setLayout(page, layout);
        await setLens(page, "board");
        const current = card(page, layout);
        await expect(current.locator('[data-metadata-field="board"]')).toHaveCount(1);
        await expect(current.locator('[data-metadata-field="milestone"]')).toHaveCount(1);
        if (layout === "columns") {
          await expect(current.locator('..')).toHaveClass(/board-column-list/);
          await expect(current.locator('[data-metadata-field="milestone"]')).toBeHidden();
          await expect(current.locator('[data-metadata-field="priority"]')).toBeVisible();
        } else await expect(current.locator('[data-metadata-field="milestone"]')).toBeVisible();
        for (const lens of ["team_name", "Team_Name"]) {
          await setLens(page, lens);
          await expect(current.locator(`[data-metadata-field="${lens}"]`)).toHaveCount(0);
          await expect(current.locator(`[data-metadata-field="${lens === "team_name" ? "Team_Name" : "team_name"}"]`)).toHaveCount(1);
        }
        await setLens(page, "status");
        await expect(current.locator(".recorded-status")).toHaveCount(0);
        if (source === "across") await expect(current.locator(".board-source-conflict")).toHaveAttribute("aria-label", /Statuses differ/);
        await openCard(page, layout);
        await expect(page.locator("#item-preview .preview-activity .recorded-status")).toHaveCount(1);
        await expect(page.locator('#item-preview .preview-meta [data-metadata-field="milestone"]')).toHaveCount(1);
        await page.keyboard.press("Escape");
        await setLens(page, "milestone");
        await expect(current.locator('[data-metadata-field="milestone"]')).toHaveCount(0);
        await expect(current.locator('[data-metadata-field="priority"]')).toBeVisible();
      }
    }
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("grouped and disabled badges never inject fields or remove border colors", async ({ page }) => {
  test.setTimeout(90_000);
  const { owned, root, config } = await fixture();
  try {
    await page.setViewportSize({ width: 1440, height: 960 });
    for (const source of ["this", "across"]) {
      await page.goto(`/#repo=${encodeURIComponent(root)}&sources=${source}&lens=repo`);
      if (source === "across") await expect(page.locator("#board-source-status-details")).toContainText("2 worktrees loaded");
      for (const enabled of [["priority", "repo", "empty_field", "absent_field"], []]) {
        const changed = structuredClone(config);
        changed.appearance.colorTags = false;
        changed.appearance.cardFields = enabled;
        await refreshConfig(page, root, changed);
        for (const layout of ["list", "columns"]) {
          await setLayout(page, layout);
          await setLens(page, "repo");
          const current = card(page, layout);
          await expect.poll(() => fields(current)).toEqual(enabled.length ? ["priority"] : []);
          await expect(current).toHaveClass(/board-card-color-purple/);
          expect(await current.evaluate((element) => getComputedStyle(element).borderLeftColor)).toBe("rgb(105, 64, 164)");
          await expect(current.locator(".badge-appearance")).toHaveCount(0);
          await openCard(page, layout);
          if (enabled.length) {
            await expect.poll(() => fields(page.locator("#item-preview .preview-meta"))).toEqual(["priority", "repo"]);
            await expect(page.locator("#item-preview .badge-appearance")).toHaveCount(0);
          } else await expect(page.locator("#item-preview .preview-meta")).toHaveCount(0);
          await expect(page.locator("#item-preview .preview-activity .recorded-status")).toHaveCount(1);
          await page.keyboard.press("Escape");
        }
      }
    }
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
