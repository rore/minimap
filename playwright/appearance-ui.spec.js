import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
}

async function fixture() {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-appearance-ui-"));
  const root = path.join(owned, "main");
  const sibling = path.join(owned, "blue");
  const features = path.join(root, "roadmap", "features");
  await fs.mkdir(features, { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"));
  await fs.writeFile(path.join(root, "roadmap", "ideas", ".gitkeep"), "");

  const ids = Array.from({ length: 60 }, (_, index) => `appearance-${String(index + 1).padStart(2, "0")}`);
  const lanes = Array.from({ length: 10 }, (_, index) => `Lane ${String(index + 1).padStart(2, "0")} · long release workstream`);
  const board = [
    `# ${lanes[0]}`,
    ...ids.slice(0, 15).map((id) => `- ${id}`),
    ...lanes.slice(1).flatMap((lane, laneIndex) => [
      `# ${lane}`,
      ...ids.slice(15 + laneIndex * 5, 20 + laneIndex * 5).map((id) => `- ${id}`),
      "",
    ]),
  ].join("\n");
  await fs.writeFile(path.join(root, "roadmap", "board.md"), `${board}\n`);
  await fs.writeFile(path.join(root, "roadmap", "scope.md"), "Isolated board appearance fixture.\n");
  for (const [index, id] of ids.entries()) {
    const status = index === 0 ? "blocked" : index === 1 ? "in-progress" : index % 3 === 0 ? "done" : "queued";
    const team = index === 2 ? "Unmapped Team" : index % 2 ? "Release Crew" : "Platform Alpha";
    const body = `---\nid: ${id}\ntitle: ${id} — a deliberately long feature title\nstatus: ${status}\npriority: ${index % 2 ? "medium" : "high"}\ncommitment: committed\nmilestone: Milestone ${String(index % 12 + 1).padStart(2, "0")} · long horizon\nteam_name: ${team}\nregion: Regional Coordination Team with an intentionally long label\n${index === 0 ? "Team_Name: Exact Key\n" : ""}---\n\n## Summary\n\nFull metadata remains available in details for ${id}.\n`;
    await fs.writeFile(path.join(features, `${id}.md`), body);
  }
  const config = {
    roadmapPath: "roadmap",
    filters: { fields: ["team_name"] },
    appearance: {
      cardFields: ["team_name", "priority", "status", "milestone", "Team_Name", "region"],
      tagColors: {
        team_name: { "Platform Alpha": "purple", "Release Crew": "teal" },
        Team_Name: { "Exact Key": "amber" },
        region: { "Regional Coordination Team with an intentionally long label": "amber" },
      },
      cardColorBy: "team_name",
    },
  };
  await fs.writeFile(path.join(root, "roadmap.config.json"), `${JSON.stringify(config, null, 2)}\n`);

  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.invalid");
  git(root, "config", "core.autocrlf", "false");
  git(root, "add", ".");
  git(root, "commit", "-m", "base");
  git(root, "worktree", "add", "-b", "feature/appearance-sibling", sibling);
  const siblingConfig = structuredClone(config);
  siblingConfig.appearance = {
    cardFields: [],
    tagColors: { team_name: { "Platform Alpha": "red" } },
    cardColorBy: "milestone",
  };
  await fs.writeFile(path.join(sibling, "roadmap.config.json"), `${JSON.stringify(siblingConfig, null, 2)}\n`);
  const changed = path.join(sibling, "roadmap", "features", `${ids[0]}.md`);
  await fs.writeFile(changed, (await fs.readFile(changed, "utf8")).replace("status: blocked", "status: in-progress"));
  git(sibling, "add", "roadmap.config.json", "roadmap/features");
  git(sibling, "commit", "-m", "contradictory sibling appearance");
  return { owned, root, sibling, config, ids };
}

async function capture(page, name, testInfo) {
  const output = path.resolve(process.cwd(), "artifacts", "board-appearance", name);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await page.screenshot({ path: output });
  await testInfo.attach(name, { path: output, contentType: "image/png" });
}

test("appearance follows the opened board in This and Across, in both layouts", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const { owned, root, sibling, config } = await fixture();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/#repo=${encodeURIComponent(root)}`);
    const boardCard = (layout, id) => page.locator(layout === "list"
      ? `.board-item[data-item-id="${id}"]`
      : `.board-column-card:has(.board-column-card-main[data-item-dblopen="${id}"])`);
    const boardCardByTitle = (layout, id) => page.locator(layout === "list" ? ".board-item" : ".board-column-card")
      .filter({ has: page.locator(`.board-item-title[title^="${id} —"]`) });
    const setLayout = async (layout) => {
      const button = page.locator(`#board-layout-${layout}`);
      await expect(button).toBeVisible();
      if (await button.getAttribute("aria-selected") !== "true") await button.click();
    };
    const first = "appearance-01";
    for (const layout of ["list", "columns"]) {
      await setLayout(layout);
      const card = boardCard(layout, first);
      await expect(card).toHaveClass(/board-card-custom-color/);
      await expect(card).toHaveClass(/board-card-color-purple/);
      await expect(card.locator('[data-metadata-field="team_name"]')).toHaveClass(/badge-tone-appearance-purple/);
      await expect(card.locator('[data-metadata-field="status"]')).toHaveClass(/badge-tone-status-blocked/);
      expect(await card.locator(".badge-row[data-card-metadata] [data-metadata-field]").evaluateAll((badges) => badges.map((badge) => badge.dataset.metadataField)))
        .toEqual(["team_name", "priority", "status", "milestone", "Team_Name", "region"]);
      await expect(card.locator('[data-metadata-field="status"]')).toHaveText("Blocked");
      await expect(card.locator('[data-metadata-field="priority"]')).toHaveText("high");
      await expect(card.locator('[data-metadata-field="Team_Name"]')).toHaveClass(/badge-tone-appearance-amber/);
      await expect(card.locator('[data-metadata-field="region"]')).toHaveClass(/badge-tone-appearance-amber/);
      await expect(card.locator('[data-metadata-field="status"]')).toHaveClass(/badge-tone-status-blocked/);
      if (layout === "columns") await expect(page.locator(".board-column").first()).toHaveClass(/board-column-dense/);

      const progressCard = boardCard(layout, "appearance-02");
      await expect(progressCard.locator('[data-metadata-field="status"]')).toHaveClass(/badge-tone-status-progress/);
      const progressStyle = await progressCard.evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, border: style.borderLeftColor };
      });
      expect(progressStyle).toEqual({ background: "rgb(255, 255, 255)", border: "rgb(17, 100, 103)" });
      await progressCard.hover();
      await expect.poll(() => progressCard.evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, border: style.borderLeftColor };
      })).toEqual(progressStyle);

      const appearanceStyle = () => card.evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, border: style.borderLeftColor };
      });
      const mappedStyle = { background: "rgb(255, 255, 255)", border: "rgb(105, 64, 164)" };
      await expect.poll(appearanceStyle).toEqual(mappedStyle);
      await card.hover();
      await expect.poll(appearanceStyle).toEqual(mappedStyle);
      await page.getByRole("button", { name: /Open appearance-01/ }).focus();
      await expect.poll(appearanceStyle).toEqual(mappedStyle);

      if (layout === "list") {
        await page.getByRole("button", { name: /Open appearance-01/ }).click();
        await expect.poll(appearanceStyle).toEqual(mappedStyle);
        await expect(page.locator("#item-preview .preview-meta")).toContainText("Team Name: Platform Alpha");
        await expect(page.locator('#item-preview [data-metadata-field="team_name"]')).toHaveClass(/badge-tone-appearance-purple/);
        await page.keyboard.press("Escape");
      }
      await capture(page, `opened-main-${layout}-1440.png`, testInfo);
      await page.setViewportSize({ width: 390, height: 840 });
      if (layout === "list") {
        await page.locator("#jump-to-board").click();
        await expect(page.locator("#board-groups")).toBeVisible();
      }
      await capture(page, `opened-main-${layout}-390.png`, testInfo);
      await page.setViewportSize({ width: 1440, height: 960 });
    }

    let releaseFull;
    const fullGate = new Promise((resolve) => { releaseFull = resolve; });
    await page.route("**/api/worktree-workspace**", async (route) => {
      if (!new URL(route.request().url()).searchParams.has("openedOnly")) await fullGate;
      await route.continue();
    });
    await page.locator("#board-source-toggle").click();
    await page.locator('#board-source-menu [data-source-choice="across"]').click();
    await expect(page.locator("#board-source-status-summary")).toContainText("Loading worktrees");
    await setLayout("list");
    const provisional = boardCardByTitle("list", first);
    await expect(provisional.locator('[data-metadata-field="team_name"]')).toHaveClass(/badge-tone-appearance-purple/);
    releaseFull();
    await expect(page.locator("#board-source-status-details")).toContainText("2 worktrees loaded");
    for (const layout of ["list", "columns"]) {
      await setLayout(layout);
      const card = boardCardByTitle(layout, first);
      await expect(card).toHaveClass(/board-card-custom-color/);
      await expect(card.locator('[data-metadata-field="team_name"]')).toHaveClass(/badge-tone-appearance-purple/);
      await expect(card.locator('[data-metadata-field="team_name"]')).not.toHaveClass(/badge-tone-appearance-red/);
      await expect(card.locator('[data-metadata-field="status"]')).toHaveText("Active · Blocked");
      await expect(card.locator('[data-metadata-field="status"]')).toHaveClass(/badge-tone-status-blocked/);
      await capture(page, `opened-across-${layout}-1440.png`, testInfo);
      await page.setViewportSize({ width: 390, height: 840 });
      if (layout === "list") {
        await page.locator("#jump-to-board").click();
        await expect(page.locator("#board-groups")).toBeVisible();
      }
      await capture(page, `opened-across-${layout}-390.png`, testInfo);
      await page.setViewportSize({ width: 1440, height: 960 });
    }

    const hiddenAcross = structuredClone(config);
    hiddenAcross.appearance.cardFields = [];
    await fs.writeFile(path.join(root, "roadmap.config.json"), `${JSON.stringify(hiddenAcross, null, 2)}\n`);
    await page.locator("#refresh-button").click();
    for (const layout of ["list", "columns"]) {
      await setLayout(layout);
      const card = boardCardByTitle(layout, first);
      await expect(card.locator('[data-metadata-field="status"]')).toHaveCount(0);
      await expect(card.locator(".board-source-badge:not(.board-source-conflict)")).toContainText("Statuses differ");
    }
    await fs.writeFile(path.join(root, "roadmap.config.json"), `${JSON.stringify(config, null, 2)}\n`);
    await page.locator("#refresh-button").click();
    await setLayout("list");
    const unmapped = boardCardByTitle("list", "appearance-03");
    await expect(unmapped).toHaveClass(/board-card-custom-color/);
    await expect(unmapped).not.toHaveClass(/board-card-color-/);
    await expect(unmapped.locator('[data-metadata-field="team_name"]')).not.toHaveClass(/badge-tone-appearance-/);

    await page.goto(`/#repo=${encodeURIComponent(sibling)}`);
    await expect(page.locator("#board-groups .board-item, #board-groups .board-column-card").first()).toBeVisible();
    for (const layout of ["list", "columns"]) {
      await setLayout(layout);
      const card = boardCard(layout, first);
      await expect(card.locator(".badge-row[data-card-metadata] [data-metadata-field]")).toHaveCount(0);
      await expect(card).toHaveClass(/board-card-custom-color/);
      await expect(card).not.toHaveClass(/board-card-color-/);
      await capture(page, `opened-sibling-${layout}-1440.png`, testInfo);
      await page.setViewportSize({ width: 390, height: 840 });
      if (layout === "list") {
        await page.locator("#jump-to-board").click();
        await expect(page.locator("#board-groups")).toBeVisible();
      }
      await capture(page, `opened-sibling-${layout}-390.png`, testInfo);
      await page.setViewportSize({ width: 1440, height: 960 });
    }
    await setLayout("list");
    const siblingConfigPath = path.join(sibling, "roadmap.config.json");
    const defaultConfig = JSON.parse(await fs.readFile(siblingConfigPath, "utf8"));
    delete defaultConfig.appearance;
    await fs.writeFile(siblingConfigPath, `${JSON.stringify(defaultConfig, null, 2)}\n`);
    await page.locator("#refresh-button").click();
    const defaultCard = boardCard("list", first);
    await expect(defaultCard).not.toHaveClass(/board-card-custom-color/);
    await expect(defaultCard.locator(".recorded-status:visible")).toHaveCount(1);
    expect(pageErrors).toEqual([]);
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("refresh applies config-only changes, preserves full metadata, and invalid entries fall back safely", async ({ page }, testInfo) => {
  const { owned, root, config, ids } = await fixture();
  const requests = [];
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/api/")) requests.push({ method: request.method(), url: request.url() });
  });
  try {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/#repo=${encodeURIComponent(root)}`);
    const card = page.locator(`.board-item[data-item-id="${ids[1]}"]`);
    await expect(card.locator('[data-metadata-field="team_name"]')).toHaveClass(/badge-tone-appearance-teal/);
    await expect(card.locator('[data-metadata-field="Team_Name"]')).toHaveCount(0);
    await expect(card).toHaveClass(/board-card-color-teal/);
    const requestsAfterLoad = requests.length;
    await card.hover();
    await page.keyboard.press("Tab");
    expect(requests).toHaveLength(requestsAfterLoad);

    await page.getByRole("button", { name: /Open appearance-02/ }).click();
    await expect(page.locator("#item-preview .preview-meta")).toContainText("Milestone 02 · long horizon");
    await expect(page.locator("#item-preview .preview-meta")).toContainText("Team Name: Release Crew");
    await expect(page.locator('#item-preview [data-metadata-field="team_name"]')).toHaveClass(/badge-tone-appearance-teal/);

    const tagOnly = structuredClone(config);
    delete tagOnly.appearance.cardColorBy;
    tagOnly.appearance.colorTags = true;
    tagOnly.appearance.cardFields = ["status", "priority", "team_name"];
    await fs.writeFile(path.join(root, "roadmap.config.json"), `${JSON.stringify(tagOnly, null, 2)}\n`);
    await page.locator("#refresh-button").click();
    await expect(card.locator('[data-metadata-field="team_name"]')).toHaveClass(/badge-tone-appearance-teal/);
    await expect(card).not.toHaveClass(/board-card-custom-color/);
    await expect(page.locator('#item-preview [data-metadata-field="team_name"]')).toHaveClass(/badge-tone-appearance-teal/);
    await capture(page, "tag-only-detail-1440.png", testInfo);
    await page.setViewportSize({ width: 390, height: 840 });
    await capture(page, "tag-only-detail-390.png", testInfo);
    await page.setViewportSize({ width: 1440, height: 960 });

    const borderOnly = structuredClone(config);
    borderOnly.appearance.colorTags = false;
    borderOnly.appearance.cardFields = ["status", "priority", "team_name"];
    await fs.writeFile(path.join(root, "roadmap.config.json"), `${JSON.stringify(borderOnly, null, 2)}\n`);
    await page.locator("#refresh-button").click();
    await expect(card).toHaveClass(/board-card-custom-color/);
    await expect(card).toHaveClass(/board-card-color-teal/);
    await expect(card.locator('[data-metadata-field="team_name"]')).toHaveClass(/badge-tone-neutral/);
    await expect.poll(() => card.evaluate((element) => getComputedStyle(element).borderLeftColor)).toBe("rgb(17, 100, 103)");
    await expect(page.locator('#item-preview [data-metadata-field="team_name"]')).toHaveClass(/badge-tone-neutral/);
    await capture(page, "border-only-detail-1440.png", testInfo);
    await page.setViewportSize({ width: 390, height: 840 });
    await capture(page, "border-only-detail-390.png", testInfo);
    await page.setViewportSize({ width: 1440, height: 960 });

    const both = structuredClone(config);
    both.appearance.colorTags = true;
    await fs.writeFile(path.join(root, "roadmap.config.json"), `${JSON.stringify(both, null, 2)}\n`);
    await page.locator("#refresh-button").click();
    await expect(card).toHaveClass(/board-card-color-teal/);
    await expect(card.locator('[data-metadata-field="team_name"]')).toHaveClass(/badge-tone-appearance-teal/);
    await expect(page.locator('#item-preview [data-metadata-field="team_name"]')).toHaveClass(/badge-tone-appearance-teal/);
    await page.keyboard.press("Escape");

    const hidden = structuredClone(config);
    hidden.appearance.cardFields = [];
    await fs.writeFile(path.join(root, "roadmap.config.json"), `${JSON.stringify(hidden, null, 2)}\n`);
    await page.locator("#refresh-button").click();
    await expect(card.locator(".badge-row[data-card-metadata] [data-metadata-field]")).toHaveCount(0);
    await expect(card.locator(".recorded-status")).toHaveCount(0);
    await expect(page.locator(".board-group")).toHaveCount(10);
    await page.locator("#board-filter-toggle").click();
    await expect(page.locator("[data-filter-key='team_name']").first()).toBeVisible();
    await page.locator("[data-filter-key='team_name'][data-filter-value='Platform Alpha']").click();
    await expect(card).toBeHidden();
    await page.locator("#board-clear-filters").click();
    await expect(card).toBeVisible();
    expect(await fs.readFile(path.join(root, "roadmap", "features", `${ids[1]}.md`), "utf8")).toContain("team_name: Release Crew");
    expect(requests.filter(({ method }) => method !== "GET")).toEqual([]);

    const invalid = structuredClone(config);
    invalid.appearance.cardFields = ["team_name", "__proto__", "title", "priority"];
    invalid.appearance.colorTags = "false";
    invalid.appearance.tagColors.team_name = { "Release Crew": "not-a-color", "Platform Alpha": "red" };
    invalid.appearance.tagColors.status = { blocked: "red" };
    await fs.writeFile(path.join(root, "roadmap.config.json"), `${JSON.stringify(invalid, null, 2)}\n`);
    await page.locator("#refresh-button").click();
    await expect(page.locator("#status-banner")).toBeVisible();
    await expect(page.locator("#status-banner .status-banner-message")).toContainText(/appearance/i);
    await expect(card.locator('[data-metadata-field="team_name"]')).toHaveClass(/badge-tone-neutral/);
    await expect(page.locator('.board-item[data-item-id="appearance-01"] [data-metadata-field="team_name"]')).toHaveClass(/badge-tone-appearance-red/);
    await expect(page.locator('.board-item[data-item-id="appearance-01"]')).toHaveClass(/board-card-color-red/);
    expect(pageErrors).toEqual([]);
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
