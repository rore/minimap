import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function makeDenseBoard() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-presence-dense-"));
  const featureDir = path.join(root, "roadmap", "features");
  await fs.mkdir(featureDir, { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"), { recursive: true });
  const ids = Array.from({ length: 205 }, (_, index) => "dense-" + String(index + 1).padStart(3, "0"));
  const milestones = ids.map((id) => "Milestone " + id + " — long real-world planning label");
  await Promise.all([
    fs.writeFile(path.join(root, "roadmap", "board.md"), "# Delivery\n" + ids.map((id) => "- " + id).join("\n") + "\n"),
    fs.writeFile(path.join(root, "roadmap", "scope.md"), "Dense board performance fixture.\n"),
    fs.writeFile(path.join(root, "roadmap.config.json"), JSON.stringify({
      roadmapPath: "roadmap",
      defaultLens: "milestone",
      lenses: { fields: { milestone: { order: milestones, values: milestones } } },
    })),
    ...ids.map((id, index) => fs.writeFile(path.join(featureDir, id + ".md"), [
      "---",
      "id: " + id,
      "title: Feature " + id + " with a long title that stays usable",
      "status: queued",
      "priority: high",
      "commitment: committed",
      "milestone: " + milestones[index],
      "---",
      "",
      "## Summary",
      "",
      "Description for " + id + " that should remain readable in both board layouts.",
      "",
    ].join("\n"))),
  ]);
  return { root, ids };
}

test("dense board keeps one bounded batch in flight, recovers from timeout, and never refetches on layout", async ({ page }) => {
  test.setTimeout(90_000);
  const { root, ids } = await makeDenseBoard();
  let requests = 0;
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  let releaseSecond;
  const secondGate = new Promise((resolve) => { releaseSecond = resolve; });
  const counts = ids.slice(0, 200).map((itemId, index) => ({ itemId, participantCount: index === 0 ? 3 : 0 }));
  await page.route(/\/api\/board\/participant-counts$/, async (route) => {
    requests += 1;
    const current = requests;
    if (current === 1) {
      await firstGate;
    }
    if (current === 2) await secondGate;
    try {
      await route.fulfill({ json: { status: "ok", counts, partial: true, refreshedAt: null } });
    } catch {
      // The second request is deliberately aborted by the client timeout.
    }
  });

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    const startedAt = Date.now();
    await page.goto("/#repo=" + encodeURIComponent(root) + "&layout=columns");
    await expect.poll(() => requests).toBe(1);
    await expect(page.locator("#board-groups .board-column")).toHaveCount(205);
    const columnsMs = Date.now() - startedAt;
    const firstCard = page.locator('.board-column-card-main[data-item-dblopen="dense-001"]');
    await expect(firstCard).toBeVisible();
    expect(requests).toBe(1);

    const listStartedAt = Date.now();
    await page.locator("#board-layout-list").click();
    await expect(page.locator("#board-groups .board-group")).toHaveCount(205);
    const listMs = Date.now() - listStartedAt;
    const listCard = page.locator('.board-item[data-item-id="dense-001"]');
    await listCard.focus();
    const originalCard = await listCard.elementHandle();
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(requests).toBe(1);
    releaseFirst();
    await expect(listCard.locator(".board-item-participants:visible")).toHaveText("3 attached");
    await expect(page.locator("#board-participant-status")).toHaveText("Session badges limited to 200 items");
    await expect(page.locator('.board-item[data-item-id="dense-201"] .board-item-participants')).toHaveCount(0);
    expect(await originalCard.evaluate((element) => element.isConnected && document.activeElement === element)).toBe(true);
    expect(requests).toBe(1);
    await originalCard.dispose();

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator(".board-item-participants")).toHaveCount(0);
    expect(requests).toBe(1);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(() => requests).toBe(2);
    await expect(page.locator("#board-participant-status"), { timeout: 10_000 }).toHaveText("Session badges unavailable");
    releaseSecond();

    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect.poll(() => requests).toBe(3);
    await expect(listCard.locator(".board-item-participants:visible")).toHaveText("3 attached");
    await page.locator("#board-layout-columns").click();
    await expect(page.locator("#board-groups .board-column")).toHaveCount(205);
    await expect(page.locator('.board-column-card-main[data-item-dblopen="dense-001"] .board-item-participants:visible')).toHaveText("3 attached");
    expect(requests).toBe(3);
    console.log("dense-board measured render: Columns " + columnsMs + "ms, List " + listMs + "ms; 205 groups, 200-count partial batch");
  } finally {
    releaseFirst();
    releaseSecond();
    await fs.rm(root, { recursive: true, force: true });
  }
});
