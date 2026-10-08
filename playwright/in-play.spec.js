import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const batchRoute = /\/api\/board\/observations(?:\?.*)?$/;
const itemId = (index) => `play-${String(index).padStart(3, "0")}`;
const cardSelector = (layout) => layout === "columns" ? ".board-column-card-main[data-item-dblopen]" : ".board-item[data-item-id]";
const card = (page, index, layout = "list") => page.locator(`${cardSelector(layout)}[${layout === "columns" ? "data-item-dblopen" : "data-item-id"}="${itemId(index)}"]`);

async function makeDenseBoard() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-in-play-"));
  const ids = Array.from({ length: 205 }, (_, index) => itemId(index + 1));
  const milestones = Array.from({ length: 35 }, (_, index) => `Milestone ${index + 1} — long cross-team delivery checkpoint`);
  const lanes = Array.from({ length: 41 }, (_, index) => `Lane ${index + 1} — long cross-functional ownership label`);
  await fs.mkdir(path.join(root, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"), { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(root, "roadmap", "scope.md"), "Generic dense In play browser fixture.\n"),
    fs.writeFile(path.join(root, "roadmap", "board.md"), lanes.map((lane, index) => `# ${lane}\n${ids.slice(index * 5, index * 5 + 5).map((id) => `- ${id}`).join("\n")}\n`).join("\n")),
    fs.writeFile(path.join(root, "roadmap.config.json"), JSON.stringify({ roadmapPath: "roadmap", lenses: { fields: { milestone: { values: milestones, order: milestones }, lane: { values: lanes, order: lanes } } } })),
    ...ids.map((id, index) => {
      const number = index + 1;
      const status = [1, 204].includes(number) ? "in-progress" : number === 4 || number % 11 === 0 ? "done" : "queued";
      return fs.writeFile(path.join(root, "roadmap", "features", `${id}.md`), [
        "---", `id: ${id}`, `title: ${[1, 3, 4].includes(number) ? "Beacon" : "Feature"} ${id} with a long readable planning title`,
        `status: ${status}`, `priority: ${number === 3 ? "medium" : "high"}`, "commitment: committed",
        `milestone: ${milestones[index % milestones.length]}`, `lane: ${lanes[Math.floor(index / 5)]}`,
        "---", "", "## Summary", "", `Generic planning description for ${id}.`, "",
      ].join("\n"));
    }),
  ]);
  return { root, ids };
}

function responseCounts(ids, includeCompleted, detached = false) {
  const isCompleted = (_, index) => index + 1 === 4 || (index + 1) % 11 === 0;
  const unfinished = ids.filter((id, index) => !isCompleted(id, index));
  const candidates = includeCompleted ? [...unfinished, ...ids.filter(isCompleted)] : unfinished;
  return candidates.slice(0, 200).map((id) => {
    const number = Number(id.slice(-3));
    const participantCount = !detached && ([2, 3, 4].includes(number) || number % 7 === 0) ? 1 : 0;
    const dormantParticipantCount = number === 3 ? participantCount : 0;
    return { itemId: id, participantCount, recentParticipantCount: participantCount - dormantParticipantCount, dormantParticipantCount };
  });
}

const ok = (counts, includeCompleted = false, partial = false) => ({ status: "ok", counts, partial, ...(includeCompleted ? { includeCompleted: true } : {}), asOf: "2026-09-28T00:00:00Z", recentSeconds: 86400 });
const url = (root, suffix = "") => `/#repo=${encodeURIComponent(root)}${suffix}`;
async function refresh(page, settle = true) {
  if (settle) await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
}
async function expectIds(page, indices, layout = "list") {
  await expect(page.locator(cardSelector(layout))).toHaveCount(indices.length);
  const actual = await page.locator(cardSelector(layout)).evaluateAll((cards, layout) => cards.map((element) => element.dataset[layout === "columns" ? "itemDblopen" : "itemId"]).sort(), layout);
  expect(actual).toEqual(indices.map(itemId).sort());
}
async function expectNoEmptyGroups(page, layout) {
  const groups = await page.locator(`#board-groups ${layout === "columns" ? ".board-column" : ".board-group"}`).all();
  expect(groups.length).toBeGreaterThan(0);
  for (const group of groups) expect(await group.locator(cardSelector(layout)).count()).toBeGreaterThan(0);
}

test("In play combines status or attached sessions with every existing filter and persists routes", async ({ page }) => {
  test.setTimeout(90_000);
  const { root, ids } = await makeDenseBoard();
  const batches = [];
  const writes = [];
  let detached = false;
  let changedCount = false;
  let delayReplacement = false;
  let replacementStarted;
  let releaseReplacement;
  const started = new Promise((resolve) => { replacementStarted = resolve; });
  const replacementGate = new Promise((resolve) => { releaseReplacement = resolve; });
  await page.route(/\/api\/items\/play-001$/, async (route) => {
    if (delayReplacement) {
      replacementStarted();
      await replacementGate;
    }
    await route.continue();
  });
  await page.route(batchRoute, async (route) => {
    const includeCompleted = new URL(route.request().url()).searchParams.get("includeCompleted") === "1";
    batches.push(includeCompleted);
    const counts = responseCounts(ids, includeCompleted, detached);
    if (changedCount && !detached) Object.assign(counts.find((row) => row.itemId === itemId(7)), { participantCount: 2, recentParticipantCount: 2 });
    await route.fulfill({ json: ok(counts, includeCompleted, includeCompleted) });
  });
  page.on("request", (request) => {
    if (request.url().includes("/api/") && request.method() !== "GET") writes.push(`${request.method()} ${request.url()}`);
  });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url(root));
    await expect(page.locator(cardSelector("list"))).toHaveCount(205);
    await expect.poll(() => batches.length).toBe(1);
    await expect(page.locator("#board-focus-in-play")).toHaveAttribute("aria-pressed", "false");
    await page.locator("#board-focus-in-play").focus();
    await page.keyboard.press("Space");
    await expect(page.locator("#board-focus-in-play")).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => batches).toEqual([false, true]);
    await expect(card(page, 1)).toBeVisible(); // Status branch, confirmed zero.
    await expect(card(page, 2)).toBeVisible(); // Recent participant branch.
    await expect(card(page, 3).locator(".board-item-participants:visible")).toHaveText("Dormant 1");
    await expect(card(page, 4)).toBeVisible(); // Completed but still attached.
    await expect(card(page, 5)).toHaveCount(0); // Confirmed zero, not in progress.
    await expect(card(page, 205)).toHaveCount(0); // Unobserved, not assumed zero or attached.
    await expect(card(page, 204)).toBeVisible(); // Unobserved in-progress survives partial counts.
    await expect(page).toHaveURL(/inPlay=1/);
    await expect(page.locator("#board-participant-status")).toContainText(/200|partial|limited/i);

    await card(page, 1).focus();
    const scrollTop = await page.locator("#board-groups").evaluate((board) => { board.scrollTop = 200; return board.scrollTop; });
    changedCount = true;
    await refresh(page);
    await expect.poll(() => batches.length).toBe(3);
    await expect(card(page, 7).locator(".board-item-participants:visible")).toHaveText("Recent 2");
    await expect(card(page, 1)).toBeFocused();
    expect(await page.locator("#board-groups").evaluate((board) => board.scrollTop)).toBe(scrollTop);

    let initialBatchCount = batches.length;
    await page.locator("#board-view-toggle").click();
    const lenses = await page.locator("[data-lens-key]").evaluateAll((buttons) => buttons.map((button) => button.dataset.lensKey));
    await page.keyboard.press("Escape");
    expect(lenses).toEqual(expect.arrayContaining(["lane", "milestone", "status"]));
    for (const layout of ["list", "columns"]) {
      if (await page.locator(`#board-layout-${layout}`).isEnabled()) await page.locator(`#board-layout-${layout}`).click();
      for (const lens of lenses) {
        await page.locator("#board-view-toggle").click();
        await page.locator(`[data-lens-key="${lens}"]`).click();
        await expectNoEmptyGroups(page, layout);
        await expect(card(page, 5, layout)).toHaveCount(0);
        await expect(card(page, 204, layout)).toHaveCount(1);
      }
      if (layout === "columns") {
        const openButton = page.locator(`[data-item-open="${itemId(1)}"]`);
        await openButton.focus();
        await refresh(page);
        initialBatchCount += 1;
        await expect.poll(() => batches.length).toBe(initialBatchCount);
        await expect(openButton).toBeFocused();
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({ path: test.info().outputPath(`in-play-${layout}-desktop.png`) });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: test.info().outputPath(`in-play-${layout}-narrow.png`) });
      expect(await page.locator(".board-toolbar-row").evaluate((row) => row.scrollWidth - row.clientWidth)).toBeLessThanOrEqual(2);
      await expect(page.locator("#board-participant-status")).toBeVisible();
      expect(await page.locator("#board-participant-status").evaluate((warning) => warning.scrollWidth - warning.clientWidth)).toBeLessThanOrEqual(2);
      expect((await page.locator(".board-toolbar-row").boundingBox()).height).toBeLessThanOrEqual(120);
      const unfinishedBox = await page.locator("#board-focus-unfinished").boundingBox();
      const inPlayBox = await page.locator("#board-focus-in-play").boundingBox();
      expect(Math.abs(unfinishedBox.y - inPlayBox.y)).toBeLessThanOrEqual(2);
      if (layout === "columns") await expect(page.locator(cardSelector(layout)).first()).toBeInViewport();
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator("#board-layout-list").click();
    await page.locator("#board-search").fill("beacon");
    await expectIds(page, [1, 3, 4]);
    await page.locator("#board-filter-toggle").click();
    await page.locator('[data-filter-key="priority"][data-filter-value="high"]').click();
    await expectIds(page, [1, 4]);
    expect(batches.length).toBe(initialBatchCount);
    const priorityChip = page.locator('[data-filter-key="priority"][data-filter-value="high"]');
    await priorityChip.focus();
    await refresh(page);
    initialBatchCount += 1;
    await expect.poll(() => batches.length).toBe(initialBatchCount);
    await expect(priorityChip).toBeFocused();
    await page.locator("#board-focus-unfinished").click();
    await expect(page.locator("#board-focus-unfinished")).toHaveAttribute("aria-pressed", "true");
    await expectIds(page, [1]);
    await expect.poll(() => batches.at(-1)).toBe(false);
    await page.reload();
    await expect(page.locator("#board-focus-in-play")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#board-focus-unfinished")).toHaveAttribute("aria-pressed", "true");
    await expectIds(page, [1]);
    await page.locator("#board-clear-filters").click();
    await expect(page.locator("#board-focus-in-play")).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(cardSelector("list"))).toHaveCount(205);
    await expect(page).not.toHaveURL(/inPlay=1/);
    await page.evaluate(() => { const params = new URLSearchParams(location.hash.slice(1)); params.set("inPlay", "1"); location.hash = params.toString(); });
    await expect(page.locator("#board-focus-in-play")).toHaveAttribute("aria-pressed", "true");
    await expect(card(page, 3)).toBeVisible();
    await card(page, 3).click();
    await page.locator("#tab-structured").click();
    if ((await page.locator(".metadata-details").getAttribute("open")) === null) await page.locator("#metadata-toggle").click();
    await page.locator("#field-title").fill("Unsaved attached item draft");
    detached = true; // Simulate detach/close in the next read-only presence snapshot.
    const beforeRefresh = batches.length;
    await refresh(page);
    await expect.poll(() => batches.length).toBe(beforeRefresh + 1);
    await expectIds(page, [1, 204]);
    await expect(page.locator("#field-title")).toHaveValue("Unsaved attached item draft");
    // A clean disappearing selection may start a replacement GET while its old form is still live.
    await page.locator("#editor-cancel-button").click();
    detached = false;
    await refresh(page);
    await expect(card(page, 3)).toBeVisible();
    await page.locator("#tab-structured").click();
    if ((await page.locator(".metadata-details").getAttribute("open")) === null) await page.locator("#metadata-toggle").click();
    delayReplacement = true;
    detached = true;
    await refresh(page);
    await started;
    await page.locator("#field-title").fill("Draft typed while replacement GET is pending");
    releaseReplacement();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#field-title")).toHaveValue("Draft typed while replacement GET is pending");
    await expect(page.locator("#field-id")).toHaveValue(itemId(3));
    expect(writes).toEqual([]);
  } finally {
    releaseReplacement();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("In play makes loading, disabled, unsupported, unavailable and partial observations explicit", async ({ page }) => {
  const { root, ids } = await makeDenseBoard();
  let result = ok(responseCounts(ids, true), true, true);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let requests = 0;
  await page.route(batchRoute, async (route) => {
    requests += 1;
    if (requests === 1) await gate;
    await route.fulfill({ json: result });
  });
  try {
    await page.goto(url(root, `&inPlay=1&item=${itemId(3)}`));
    await expect(page.locator("#board-participant-status")).toContainText(/loading|updating|checking/i);
    await expectIds(page, [1, 204]);
    release();
    await expect(page.locator("#item-preview .preview-title")).toHaveText(`Beacon ${itemId(3)} with a long readable planning title`);
    for (const status of ["disabled", "unsupported", "unavailable"]) {
      result = { status, counts: [] };
      await page.reload();
      await expect(page.locator("#board-participant-status")).toContainText(status === "unsupported" ? /newer|unsupported/i : status === "disabled" ? /disabled|not configured/i : /unavailable/i);
      await expectIds(page, [1, 204]);
    }
    result = ok(responseCounts(ids, true), true, true);
    delete result.includeCompleted; // An older server silently ignoring the query is not a complete answer.
    await page.reload();
    await expect(page.locator("#board-participant-status")).toContainText(/newer Minimap/i);
    await expectIds(page, [1, 204]);
    result = ok(responseCounts(ids, true), true, true);
    await page.reload();
    await expect(card(page, 3)).toBeVisible();
    await expect(page.locator("#board-participant-status")).toContainText(/200|partial|limited/i);
    await page.locator("#board-search").fill("unmatched-in-play-search");
    await expect(page.locator("#board-groups .empty-state")).toBeVisible();
    await expect(page.locator("#board-participant-status")).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: test.info().outputPath("in-play-partial-empty-warning.png") });
    await page.locator("#board-clear-filters").click();
    await expect(page.locator("#board-focus-in-play")).toHaveAttribute("aria-pressed", "false");
  } finally {
    release();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("In play keeps one bounded batch in flight and rejects stale eligibility results", async ({ page }) => {
  const { root, ids } = await makeDenseBoard();
  const batches = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route(batchRoute, async (route) => {
    const includeCompleted = new URL(route.request().url()).searchParams.get("includeCompleted") === "1";
    batches.push(includeCompleted);
    if (batches.length === 1) await gate;
    try { await route.fulfill({ json: ok(responseCounts(ids, includeCompleted), includeCompleted) }); } catch { /* The invalidated request may already be aborted. */ }
  });
  try {
    await page.goto(url(root, "&inPlay=1"));
    await expect.poll(() => batches.length).toBe(1);
    await page.locator("#board-layout-columns").click();
    await page.locator("#board-view-toggle").click();
    await page.locator('[data-lens-key="milestone"]').click();
    await page.locator("#board-search").fill("beacon");
    await refresh(page, false);
    await refresh(page, false);
    expect(batches).toEqual([true]);
    await page.locator("#board-focus-unfinished").click();
    await expect.poll(() => batches).toEqual([true, false]);
    await expectIds(page, [1, 3], "columns");
    release();
    await expect(card(page, 4, "columns")).toHaveCount(0);
    await expect(page.locator("#board-participant-status")).not.toContainText(/limited|partial/i);
    await page.locator("#board-focus-unfinished").click();
    await expect.poll(() => batches).toEqual([true, false, true]);
    await expectIds(page, [1, 3, 4], "columns");
  } finally {
    release();
    await fs.rm(root, { recursive: true, force: true });
  }
});
