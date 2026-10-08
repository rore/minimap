import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadWorkspace } from "../package/minimap/src/roadmap.js";
import { loadWorktreeAggregate } from "../package/minimap/src/worktree-aggregate.js";

const owned = [];
const releases = [];
function responseHold() {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  releases.push(release);
  return { pending, release };
}

async function fixture(page, mode, layout, beforeOpen) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-snapshot-ui-"));
  owned.push(root);
  await fs.mkdir(path.join(root, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"));
  await fs.writeFile(path.join(root, "roadmap", "ideas", ".keep"), "");
  await fs.writeFile(path.join(root, "roadmap", "board.md"), "# Now\n- alpha\n");
  await fs.writeFile(path.join(root, "roadmap", "scope.md"), "Generic scope.\n");
  await fs.writeFile(path.join(root, "roadmap", "features", "alpha.md"), "---\nid: alpha\ntitle: Alpha\nstatus: queued\npriority: medium\ncommitment: committed\n---\n\n## Summary\n\nGeneric feature.\n");
  const git = (...args) => execFileSync("git", args, { cwd: root, windowsHide: true, stdio: "pipe" });
  git("init", "-b", "main"); git("config", "user.name", "Test"); git("config", "user.email", "test@example.invalid");
  git("add", "."); git("commit", "-m", "fixture");
  const payload = mode === "across" ? await loadWorktreeAggregate(root) : await loadWorkspace(root);
  payload.snapshot = { id: "fixture-snapshot", validatedAt: new Date().toISOString(), stale: false, refreshing: false };
  let recent = 1, fail = false, observations = 0, reads = 0;
  const requests = [];
  const counts = () => ({ status: "ok", counts: [{ [mode === "across" ? "featureKey" : "itemId"]: mode === "across" ? payload.features[0].key : "alpha", participantCount: recent, recentParticipantCount: recent, dormantParticipantCount: 0 }], partial: false, asOf: new Date().toISOString(), recentSeconds: 86400, includeCompleted: true });
  if (mode === "across") payload.participantCounts = counts();
  await page.route(mode === "across" ? "**/api/worktree-workspace**" : "**/api/workspace**", async (route) => {
    reads++;
    requests.push(new URL(route.request().url()));
    if (!requests.at(-1).searchParams.has("cached")) payload.snapshot = { ...payload.snapshot, stale: false, validatedAt: new Date().toISOString() };
    await route.fulfill({ json: payload });
  });
  await page.route("**/api/board/participant-counts**", (route) => route.fulfill({ json: counts() }));
  await page.route("**/api/board/observations**", async (route) => {
    observations++;
    await route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: { code: "unavailable", message: "Temporary failure" } } : counts() });
  });
  await page.addInitScript(() => {
    const interval = window.setInterval;
    window.__refreshTicks = [];
    window.setInterval = (callback, delay, ...args) => delay === 30_000
      ? (window.__refreshTicks.push(callback), interval(() => {}, 3_600_000))
      : interval(callback, delay, ...args);
  });
  if (beforeOpen) await beforeOpen({ root, payload });
  await page.goto(`/#repo=${encodeURIComponent(root)}&sources=${mode}&layout=${layout}`);
  await expect(page.locator("#board-groups")).toContainText("Alpha");
  return { root, payload, setRecent: (value) => { recent = value; }, fail: () => { fail = true; }, observations: () => observations, reads: () => reads, requests,
    setSpec: () => {
      const link = { sessionId: "fixture-session", targetFile: path.join(root, "roadmap", "features", "alpha.md"), openComments: 2, pendingSuggestions: 1 };
      if (mode === "across") for (const version of payload.features[0].versions) version.summary.specSession = link;
      else payload.specSessionsByItemId = { alpha: link };
    },
    expire: () => { payload.snapshot = { ...payload.snapshot, stale: true, validatedAt: new Date(Date.now() - 31_000).toISOString() }; } };
}

test.afterEach(async () => {
  for (const release of releases.splice(0)) release();
  for (const root of owned.splice(0)) {
    expect(path.dirname(root)).toBe(os.tmpdir());
    expect(path.basename(root)).toMatch(/^minimap-snapshot-ui-/);
    await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

for (const mode of ["this", "across"]) for (const layout of ["list", "columns"]) {
  test(`${mode} ${layout} refreshes observations without a full scan and pauses while hidden`, async ({ page }, testInfo) => {
    const data = await fixture(page, mode, layout);
    await expect.poll(data.observations).toBeGreaterThan(0);
    await expect(page.locator("#board-groups .board-item-participants:visible").first()).toHaveText("Recent 1");
    const reads = data.reads();
    data.setRecent(2);
    await page.evaluate(() => window.__refreshTicks.forEach((tick) => tick()));
    await expect(page.locator("#board-groups .board-item-participants:visible").first()).toHaveText("Recent 2");
    expect(data.reads()).toBe(reads);
    const calls = data.observations();
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
      window.__refreshTicks.forEach((tick) => tick());
    });
    expect(data.observations()).toBe(calls);
    data.setRecent(3);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator("#board-groups .board-item-participants:visible").first()).toHaveText("Recent 3");
    await page.screenshot({ path: testInfo.outputPath(`${mode}-${layout}-desktop.png`) });
    await page.setViewportSize({ width: 390, height: 840 });
    await page.locator("#board-groups").scrollIntoViewIfNeeded();
    await expect(page.locator("#board-groups .board-item-participants:visible").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: testInfo.outputPath(`${mode}-${layout}-narrow.png`) });
  });
}

test("temporary observation failure retains badges with an explicit stale state", async ({ page }, testInfo) => {
  const data = await fixture(page, "across", "columns");
  await expect.poll(data.observations).toBeGreaterThan(0);
  await expect(page.locator("#board-groups .board-item-participants:visible").first()).toHaveText("Recent 1");
  data.fail();
  await page.evaluate(() => window.__refreshTicks.forEach((tick) => tick()));
  await expect(page.locator("#board-participant-status")).toContainText("last-known");
  await expect(page.locator("#board-groups .board-item-participants:visible").first()).toHaveText("Recent 1");
  await page.screenshot({ path: testInfo.outputPath("stale-desktop.png") });
  await page.setViewportSize({ width: 390, height: 840 });
  await expect(page.locator("#board-participant-status")).toHaveClass(/is-incomplete/);
  await expect(page.locator("#board-participant-status")).not.toHaveCSS("color", "rgba(0, 0, 0, 0)");
  await page.screenshot({ path: testInfo.outputPath("stale-narrow.png") });
});

test("hash entry to Spec cancels a workspace read and retains badges on unchanged return", async ({ page }) => {
  const data = await fixture(page, "this", "columns");
  await expect(page.locator("#board-groups .board-item-participants:visible").first()).toHaveText("Recent 1");
  const roadmapHash = await page.evaluate(() => location.hash);
  const hold = responseHold();
  let started = false, cancelled = false;
  page.on("requestfailed", (request) => { if (/\/api\/workspace(?:\?|$)/.test(request.url())) cancelled = true; });
  const late = structuredClone(data.payload);
  late.items.alpha.title = "Late Alpha";
  await page.route("**/api/workspace**", async (route) => {
    if (started) return route.fallback();
    started = true;
    await hold.pending;
    // Cancellation is expected while this synthetic response is held.
    await route.fulfill({ json: late }).catch(() => {});
  });
  await page.locator("#refresh-button").click();
  await expect.poll(() => started).toBe(true);
  await page.evaluate(() => {
    const route = new URLSearchParams(location.hash.slice(1));
    route.set("view", "spec");
    location.hash = route.toString();
  });
  await expect(page.locator("#spec-workbench")).toBeVisible();
  await expect.poll(() => cancelled).toBe(true);
  hold.release();
  data.fail();
  await page.evaluate((hash) => { location.hash = hash; }, roadmapHash);
  await expect(page.locator("#board-participant-status")).toContainText("last-known");
  await expect(page.locator("#board-groups .board-item-participants:visible").first()).toHaveText("Recent 1");
  await expect(page.locator("#board-groups")).not.toContainText("Late Alpha");
});

test("a provisional snapshot defers observations and resumes its cancelled full read on return", async ({ page }, testInfo) => {
  const hold = responseHold();
  let fullReads = 0, cancelled = false;
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/worktree-workspace" && !url.searchParams.has("openedOnly")) cancelled = true;
  });
  const data = await fixture(page, "across", "columns", async ({ payload }) => {
    const opened = structuredClone(payload);
    opened.provisional = true;
    opened.partial = true;
    opened.coverage = { ...opened.coverage, pending: true };
    opened.snapshot = { ...opened.snapshot, id: "provisional-snapshot" };
    await page.route("**/api/worktree-workspace**", async (route) => {
      if (new URL(route.request().url()).searchParams.has("openedOnly")) return route.fulfill({ json: opened });
      fullReads++;
      await hold.pending;
      await route.fulfill({ json: payload }).catch(() => {});
    });
  });
  await expect(page.locator("#board-source-status-summary")).toContainText("Opened checkout only");
  expect(fullReads).toBe(1);
  // Cross the provisional render turn; identity is still unresolved while full read is held.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(data.observations()).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("provisional-desktop.png") });
  await page.setViewportSize({ width: 390, height: 840 });
  await page.screenshot({ path: testInfo.outputPath("provisional-narrow.png") });
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => cancelled).toBe(true);
  hold.release();
  await page.evaluate(() => {
    const now = Date.now();
    Date.now = () => now + 1_500; // Permit retry without expiring the fresh provisional snapshot.
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => fullReads).toBe(2);
  await expect(page.locator("#board-source-status-summary")).not.toContainText("Opened checkout only");
  await expect.poll(data.observations).toBeGreaterThan(0);
});

test("a newly ambiguous feature cannot retain its formerly confirmed participant badge", async ({ page }) => {
  const data = await fixture(page, "across", "columns");
  await expect(page.locator("#board-groups .board-item-participants:visible").first()).toHaveText("Recent 1");
  const original = data.payload.features[0];
  const independent = structuredClone(original);
  independent.key = "independent-alpha";
  for (const version of independent.versions) {
    version.sourceKey = "independent-source";
    version.summary.title = "Independent Alpha";
  }
  data.payload.features.push(independent);
  data.payload.groups[0].items.push({ key: independent.key, id: independent.id, versions: independent.versions, conflicts: [] });
  data.payload.snapshot = { ...data.payload.snapshot, id: "ambiguous-snapshot" };
  await page.route("**/api/board/observations**", (route) => route.fulfill({ json: {
    status: "ok", counts: [], partial: true, includeCompleted: true,
    asOf: new Date().toISOString(), recentSeconds: 86400,
    ambiguous: [{ reference: "alpha", keys: [original.key, independent.key] }],
  } }));
  await page.locator("#refresh-button").click();
  await expect(page.locator("#board-groups")).toContainText("Independent Alpha");
  await expect(page.locator("#board-participant-status")).toContainText("partial");
  await expect(page.locator("#board-groups .board-item-participants:visible")).toHaveCount(0);
});

for (const mode of ["this", "across"]) {
  test(`${mode} manual Refresh validates while a fresh automatic tick reuses its snapshot`, async ({ page }) => {
    const data = await fixture(page, mode, "columns");
    await expect.poll(data.observations).toBeGreaterThan(0);
    const reads = data.reads();
    await page.evaluate(() => window.__refreshTicks.forEach((tick) => tick()));
    await expect.poll(data.observations).toBeGreaterThan(1);
    expect(data.reads()).toBe(reads);
    await page.locator("#refresh-button").click();
    await expect.poll(data.reads).toBeGreaterThan(reads);
    expect(data.requests.at(-1).searchParams.has("cached")).toBe(false);
  });

  test(`${mode} expired snapshot is shown while fresh validation follows`, async ({ page }) => {
    const data = await fixture(page, mode, "columns");
    await expect.poll(data.observations).toBeGreaterThan(0);
    const reads = data.reads();
    data.expire();
    await page.evaluate(() => {
      const now = Date.now();
      Date.now = () => now + 31_000;
      window.__refreshTicks.forEach((tick) => tick());
    });
    await expect.poll(data.reads).toBe(reads + 2);
    expect(data.requests.at(-2).searchParams.get("cached")).toBe("1");
    expect(data.requests.at(-1).searchParams.has("cached")).toBe(false);
    await expect(page.locator("#board-groups")).toContainText("Alpha");
  });
}

for (const via of ["toolbar", "hash"]) test(`Spec mutation reconciles source-specific badges on ${via} return`, async ({ page }) => {
  const data = await fixture(page, "across", "columns");
  await expect.poll(data.observations).toBeGreaterThan(0);
  const roadmapHash = await page.evaluate(() => location.hash);
  await page.locator("#spec-mode-button").click();
  await expect(page.locator("#spec-workbench")).toBeVisible();
  await page.locator("#spec-attach-path").fill(path.join(data.root, "roadmap", "features", "alpha.md"));
  const attached = page.waitForResponse((response) => response.url().endsWith("/spec-sessions/attach") && response.request().method() === "POST");
  await page.locator("#spec-attach-form button").click();
  expect((await attached).ok()).toBe(true);
  await expect(page.locator("#spec-file-content")).toContainText("Generic feature.");
  data.setSpec();
  const reads = data.reads();
  if (via === "toolbar") await page.locator("#roadmap-mode-button").click();
  else await page.evaluate((hash) => { location.hash = hash; }, roadmapHash);
  await expect.poll(data.reads).toBeGreaterThan(reads);
  expect(data.requests.at(-1).searchParams.has("cached")).toBe(false);
  await expect(page.locator("#board-groups .board-item-spec-badge").first()).toContainText("2");
});
