import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadWorktreeAggregate } from "../package/minimap/src/worktree-aggregate.js";

async function recoveryFixture(page) {
  const created = await fixture(2);
  const file = path.join(created.owned, "blue", "roadmap", "features", "async-02.md");
  await fs.writeFile(file, (await fs.readFile(file, "utf8")).replace("status: queued", "status: blocked"));
  const opened = await loadWorktreeAggregate(created.root, { openedOnly: true });
  const full = await loadWorktreeAggregate(created.root);
  expect(full.workspace).not.toBeNull();
  const featureKey = full.features.find((feature) => feature.id === "async-02").key;
  full.snapshot = { id: "recovery-fixture", validatedAt: new Date().toISOString(), stale: false, refreshing: false };
  await page.route("**/api/board/observations**", (route) => {
    if (new URL(route.request().url()).searchParams.get("snapshot") !== full.snapshot.id) return route.continue();
    return route.fulfill({ json: { status: "ok", counts: [{ featureKey, participantCount: 1, recentParticipantCount: 1, dormantParticipantCount: 0 }], partial: false, includeCompleted: true, asOf: new Date().toISOString(), recentSeconds: 86400 } });
  });
  return { ...created, opened, full };
}

const inconsistentSnapshot = { workspace: null, unavailable: { reason: "source-changed-during-read", message: "A checkout changed while the combined board loaded." } };

for (const interruption of ["visibility", "Spec toolbar", "Spec hash"]) test(`snapshot recovery retains complete cards, badges and drafts through a quiet retry (${interruption})`, async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const data = await recoveryFixture(page);
  let reads = 0;
  let resumedUrl;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  await page.route("**/api/worktree-workspace**", async (route) => {
    if (new URL(route.request().url()).searchParams.has("openedOnly")) return route.fulfill({ json: data.opened });
    reads += 1;
    if (reads === 4) resumedUrl = new URL(route.request().url());
    if (reads === 2) return route.fulfill({ json: inconsistentSnapshot });
    if (reads >= 3) await pending;
    return route.fulfill({ json: data.full });
  });
  try {
    await page.goto(`/#repo=${encodeURIComponent(data.root)}&sources=across`);
    await expect(page.locator(".board-item-participants:visible")).toHaveText(["Recent 1"]);
    await page.locator("#refresh-button").click();
    await expect.poll(() => reads).toBe(3);
    await expect(page.locator("#board-source-status-summary")).toContainText("Updating");
    await expect(page.locator("#board-source-status-summary")).not.toContainText("Partial coverage");
    await expect(page.locator("#status-banner")).not.toContainText("consistent");
    for (const width of interruption === "visibility" ? [1440, 390] : []) {
      await page.setViewportSize({ width, height: 900 });
      for (const layout of ["list", "columns"]) {
        const button = page.locator(`#board-layout-${layout}`);
        if (await button.isEnabled()) await button.click();
        await expect(page.locator(".board-item-participants:visible")).toHaveText(["Recent 1"]);
        await expect(page.locator(".board-source-badge:visible").filter({ hasText: "2 checkouts" })).toHaveCount(2);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
        await page.screenshot({ path: testInfo.outputPath(`snapshot-retry-${layout}-${width}.png`), fullPage: true });
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    if (await page.locator("#board-layout-list").getAttribute("aria-selected") !== "true") await page.locator("#board-layout-list").click();
    if (interruption === "visibility") {
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
    } else {
      if (interruption === "Spec toolbar") await page.locator("#spec-mode-button").click();
      else await page.evaluate(() => {
        const route = new URLSearchParams(location.hash.slice(1));
        route.set("view", "spec");
        location.hash = route.toString();
      });
      await expect(page.locator("#spec-workbench")).toBeVisible();
      if (interruption === "Spec toolbar") await page.locator("#roadmap-mode-button").click();
      else await page.evaluate(() => {
        const route = new URLSearchParams(location.hash.slice(1));
        route.delete("view");
        location.hash = route.toString();
      });
      await expect(page.locator("#spec-workbench")).toBeHidden();
    }
    await expect(page.locator(".board-item-participants:visible")).toHaveText(["Recent 1"]);
    await expect.poll(() => reads).toBe(4);
    expect(resumedUrl.searchParams.has("cached")).toBe(false);
    await page.getByRole("button", { name: /Open async-02/i }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#tab-structured").click();
    await page.locator("#metadata-toggle").click();
    await page.locator("#field-title").fill("Unsaved retry draft");
    release();
    await expect(page.locator("#board-source-status-summary")).not.toContainText("Updating");
    await expect(page.locator("#field-title")).toHaveValue("Unsaved retry draft");
    await expect(page.locator(".board-item-participants:visible")).toHaveText(["Recent 1"]);
    await expect(page.locator("#status-banner")).not.toContainText("consistent");
    expect(reads).toBe(4);
  } finally {
    release();
    await fs.rm(data.owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

for (const kind of ["consistency", "other"]) test(`snapshot recovery bounds ${kind} failures and retains the complete snapshot`, async ({ page }) => {
  test.setTimeout(60_000);
  const data = await recoveryFixture(page);
  let reads = 0;
  let fail = false;
  await page.route("**/api/worktree-workspace**", async (route) => {
    if (new URL(route.request().url()).searchParams.has("openedOnly")) return route.fulfill({ json: data.opened });
    reads += 1;
    if (fail) return kind === "consistency"
      ? route.fulfill({ json: inconsistentSnapshot })
      : route.fulfill({ status: 503, json: { error: { message: "unrelated failure" } } });
    return route.fulfill({ json: data.full });
  });
  try {
    await page.goto(`/#repo=${encodeURIComponent(data.root)}&sources=across`);
    await expect(page.locator(".board-item-participants:visible")).toHaveText(["Recent 1"]);
    fail = true;
    await page.locator("#refresh-button").click();
    await expect(page.locator("#status-banner")).toContainText(kind === "consistency" ? "Could not read a consistent worktree snapshot" : "unrelated failure");
    await expect(page.locator("#board-source-status-summary")).toContainText("Last-known view");
    await expect(page.locator(".board-item-participants:visible")).toHaveText(["Recent 1"]);
    await expect(page.locator(".board-source-badge:visible").filter({ hasText: "2 checkouts" })).toHaveCount(2);
    await page.waitForTimeout(800);
    expect(reads).toBe(kind === "consistency" ? 4 : 2);
    fail = false;
    await page.locator("#refresh-button").click();
    await expect(page.locator("#board-source-status-summary")).not.toContainText("Last-known view");
    await expect(page.locator("#status-banner")).not.toContainText("failure");
    expect(reads).toBe(kind === "consistency" ? 5 : 3);
  } finally { await fs.rm(data.owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
});

test("snapshot recovery leaves the provisional board honest until a consistent full response", async ({ page }) => {
  test.setTimeout(60_000);
  const data = await recoveryFixture(page);
  let reads = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  await page.route("**/api/worktree-workspace**", async (route) => {
    if (new URL(route.request().url()).searchParams.has("openedOnly")) return route.fulfill({ json: data.opened });
    reads += 1;
    if (reads === 1) return route.fulfill({ json: inconsistentSnapshot });
    await pending;
    return route.fulfill({ json: data.full });
  });
  try {
    await page.goto(`/#repo=${encodeURIComponent(data.root)}&sources=across`);
    await expect.poll(() => reads).toBe(2);
    await expect(page.locator("#board-source-status-summary")).toContainText("Opened checkout only");
    await expect(page.locator("#board-source-status-summary")).toContainText("Updating");
    await expect(page.locator(".board-item-participants:visible")).toHaveCount(0);
    await expect(page.locator("#status-banner")).not.toContainText("consistent");
    release();
    await expect(page.locator("#board-source-status-summary")).not.toContainText("Opened checkout only");
    await expect(page.locator(".board-item-participants:visible")).toHaveText(["Recent 1"]);
  } finally {
    release();
    await fs.rm(data.owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("snapshot recovery ignores a late retry after switching checkout mode", async ({ page }) => {
  test.setTimeout(60_000);
  const data = await recoveryFixture(page);
  let reads = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  await page.route("**/api/worktree-workspace**", async (route) => {
    if (new URL(route.request().url()).searchParams.has("openedOnly")) return route.fulfill({ json: data.opened });
    reads += 1;
    if (reads === 2) return route.fulfill({ json: inconsistentSnapshot });
    if (reads === 3) await pending;
    return route.fulfill({ json: data.full });
  });
  try {
    await page.goto(`/#repo=${encodeURIComponent(data.root)}&sources=across`);
    await expect(page.locator(".board-item-participants:visible")).toHaveText(["Recent 1"]);
    await page.locator("#refresh-button").click();
    await expect.poll(() => reads).toBe(3);
    await page.evaluate((hash) => { location.hash = hash; }, `repo=${encodeURIComponent(data.root)}&sources=this`);
    await expect(page.locator("#board-source-toggle")).toContainText("This checkout");
    release();
    await expect(page.locator(".board-source-badge")).toHaveCount(0);
    await expect(page.locator(".board-item-participants:visible")).toHaveCount(0);
    await expect(page.locator("#board-source-status-summary")).not.toContainText("Updating");
    await page.waitForTimeout(800);
    expect(reads).toBe(3);
    await expect(page.locator("#board-source-toggle")).toContainText("This checkout");
  } finally {
    release();
    await fs.rm(data.owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
}

async function fixture(count = 32) {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-async-worktree-"));
  const root = path.join(owned, "main");
  const sibling = path.join(owned, "blue");
  const features = path.join(root, "roadmap", "features");
  await fs.mkdir(features, { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"));
  await fs.writeFile(path.join(root, "roadmap", "ideas", ".gitkeep"), "");
  const ids = Array.from({ length: count }, (_, i) => `async-${String(i + 1).padStart(2, "0")}`);
  const lanes = Array.from({ length: 8 }, (_, i) => `Async lane ${String(i + 1).padStart(2, "0")} · long workstream`);
  const board = lanes.map((lane, i) => `# ${lane}\n${ids.filter((_, n) => n % lanes.length === i).map((id) => `- ${id}`).join("\n")}`).join("\n\n");
  await fs.writeFile(path.join(root, "roadmap", "board.md"), `${board}\n`);
  await fs.writeFile(path.join(root, "roadmap", "scope.md"), "Async worktree regression fixture.\n");
  for (const [i, id] of ids.entries()) await fs.writeFile(path.join(features, `${id}.md`), `---\nid: ${id}\ntitle: ${id} — deliberately long async board regression title\nstatus: ${i ? "queued" : "done"}\npriority: ${i % 2 ? "medium" : "high"}\ncommitment: committed\nmilestone: Async milestone ${i % 8 + 1}\n---\n\n## Summary\n\nLong description for ${id}.\n`);
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.invalid");
  git(root, "config", "core.autocrlf", "false");
  git(root, "add", ".");
  git(root, "commit", "-m", "base");
  git(root, "worktree", "add", "-b", "feature/blue", sibling);
  await fs.writeFile(path.join(sibling, "roadmap", "features", "async-01.md"), (await fs.readFile(path.join(sibling, "roadmap", "features", "async-01.md"), "utf8")).replace("status: done", "status: in-progress"));
  await fs.writeFile(path.join(sibling, "roadmap", "features", "blue-only.md"), "---\nid: blue-only\ntitle: Blue-only checkout feature\nstatus: queued\npriority: high\ncommitment: committed\n---\n\n## Summary\n\nSibling-only item.\n");
  return { owned, root };
}

async function fixtureSiblingOnlyMilestone(count = 8) {
  const created = await fixture(count);
  const sibling = path.join(created.owned, "blue");
  for (let i = 1; i <= count; i += 1) {
    const file = path.join(created.root, "roadmap", "features", `async-${String(i).padStart(2, "0")}.md`);
    const raw = await fs.readFile(file, "utf8");
    await fs.writeFile(file, raw.replace(/^milestone:[^\r\n]*\r?\n/gm, ""));
  }
  return { ...created, sibling };
}

function gate() {
  let release;
  let started;
  let released = false;
  return {
    started: new Promise((resolve) => { started = resolve; }),
    hold(route) { started(); return new Promise((resolve) => { release = () => { if (!released) { released = true; resolve(route.continue()); } }; }); },
    release() { release?.(); },
  };
}

async function holdFullRoute(page, behavior = "continue") {
  const held = gate();
  let fullRequests = 0;
  await page.route("**/api/worktree-workspace**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("openedOnly") === "1") return route.continue();
    fullRequests += 1;
    if (behavior === "fail" && fullRequests === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "full worktree load failed" } }) });
    if (fullRequests === 1) return held.hold(route);
    return route.continue();
  });
  return { ...held, get fullRequests() { return fullRequests; } };
}

async function statusFiltersInHash(page) {
  return page.evaluate(() => new URLSearchParams(location.hash.slice(1)).getAll("f")
    .filter((token) => token.startsWith("status:")).map((token) => token.slice("status:".length)));
}

test("opened-only board is interactive while the full worktree request is pending", async ({ page }, testInfo) => {
  const { owned, root } = await fixture(64);
  const full = await holdFullRoute(page);
  const reads = [];
  const participantRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/source/")) reads.push(request.method());
    if (/\/api\/(board\/(?:participant-counts|observations)|items\/.*\/participants)/.test(request.url())) participantRequests.push(request.url());
  });
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across`);
    await full.started;
    await expect(page.getByRole("button", { name: /Open async-01/i })).toBeVisible();
    await expect(page.locator("#board-source-status")).toContainText("Opened checkout only");
    await expect(page.locator("#board-source-status")).toContainText("Loading other worktrees");
    await expect(page.locator("#board-view-toggle")).toBeEnabled();
    await expect(page.locator("#board-layout-list")).toBeVisible();
    await expect(page.locator("#board-layout-columns")).toBeEnabled();
    await page.locator("#board-view-toggle").click();
    await page.locator('[data-lens-key="milestone"]').click();
    await page.getByRole("button", { name: "Unfinished" }).click();
    await expect(page.getByRole("button", { name: "Unfinished" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /Open async-02/i }).click();
    await expect(page.locator("#editor-title")).toContainText("async-02");
    await page.screenshot({ path: testInfo.outputPath("opened-only-pending-list-desktop.png"), fullPage: true });
    await page.locator("#board-layout-columns").click();
    await expect(page.locator(".board-columns")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("opened-only-pending-columns-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    const metrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.width);
    await page.screenshot({ path: testInfo.outputPath("opened-only-pending-columns-390.png"), fullPage: true });
    await page.locator("#board-layout-list").click();
    await page.screenshot({ path: testInfo.outputPath("opened-only-pending-list-390.png"), fullPage: true });
    await page.locator("#board-layout-columns").click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator("#board-layout-list").click();
    await page.getByRole("button", { name: /Open async-02/i }).click();
    await expect(page.locator("#editor-title")).toContainText("async-02");
    await page.locator("#board-view-toggle").click();
    const statusLens = page.locator('[data-lens-key="status"]');
    await statusLens.focus();
    full.release();
    expect(participantRequests).toEqual([]);
    await expect(page.locator("#board-source-status")).not.toContainText("Opened checkout only");
    await expect(page.locator("#board-source-status")).not.toContainText("Loading other worktrees");
    await expect(page.locator("#workspace-summary")).toContainText("65 features");
    await expect(page.locator("#editor-title")).toContainText("async-02");
    await expect(statusLens).toBeFocused();
    await expect(page.getByRole("button", { name: "Unfinished" })).toHaveAttribute("aria-pressed", "true");
    const unlisted = page.locator('[data-group-toggle="unlisted:Not on a board"]');
    if (await unlisted.count()) await unlisted.click();
    await expect(page.getByRole("button", { name: /Open blue-only/i })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("opened-only-settled-list-desktop.png"), fullPage: true });
    await page.locator("#board-layout-columns").click();
    await page.screenshot({ path: testInfo.outputPath("opened-only-settled-columns-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#board-layout-list").click();
    await page.screenshot({ path: testInfo.outputPath("opened-only-settled-list-390.png"), fullPage: true });
    await page.locator("#board-layout-columns").click();
    await page.screenshot({ path: testInfo.outputPath("opened-only-settled-columns-390.png"), fullPage: true });
    await page.locator("#board-layout-list").click();
    expect(reads).not.toContain("POST");
  } finally {
    full.release();
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("Columns scroll and control focus survive full-worktree reconciliation", async ({ page }) => {
  const { owned, root } = await fixture(64);
  const full = await holdFullRoute(page);
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across`);
    await full.started;
    await page.locator("#board-view-toggle").click();
    await page.locator('[data-lens-key="milestone"]').click();
    await page.locator("#board-layout-columns").click();
    const columns = page.locator(".board-columns");
    const list = page.locator(".board-column-list").first();
    const groupToggle = page.locator("[data-group-toggle]").first();
    const groupKey = await groupToggle.getAttribute("data-group-toggle");
    await groupToggle.focus();
    await expect(groupToggle).toBeFocused();
    await columns.evaluate((board) => {
      const lane = board.querySelector(".board-column-list");
      board.scrollLeft = Math.round((board.scrollWidth - board.clientWidth) / 2);
      lane.scrollTop = Math.round((lane.scrollHeight - lane.clientHeight) / 2);
    });
    const pendingScroll = await columns.evaluate((board) => {
      const lane = board.querySelector(".board-column-list");
      return { horizontal: board.scrollLeft, vertical: lane.scrollTop };
    });
    expect(pendingScroll.horizontal).toBeGreaterThan(0);
    expect(pendingScroll.vertical).toBeGreaterThan(0);
    full.release();
    await expect(page.locator("#board-source-status")).not.toContainText("Loading other worktrees");
    await expect(page.locator(`[data-group-toggle="${groupKey}"]`)).toBeFocused();
    const finalHorizontal = await columns.evaluate((board) => ({ actual: board.scrollLeft, max: board.scrollWidth - board.clientWidth }));
    const finalVertical = await list.evaluate((lane) => ({ actual: lane.scrollTop, max: lane.scrollHeight - lane.clientHeight }));
    expect(finalHorizontal.actual, JSON.stringify({ pending: pendingScroll.horizontal, final: finalHorizontal })).toBeCloseTo(Math.min(pendingScroll.horizontal, finalHorizontal.max), 0);
    expect(finalVertical.actual, JSON.stringify({ pending: pendingScroll.vertical, final: finalVertical })).toBeCloseTo(Math.min(pendingScroll.vertical, finalVertical.max), 0);
  } finally {
    full.release();
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("In play keeps its intent while a provisional board has no matching source items", async ({ page }) => {
  const { owned, root } = await fixture(8);
  const full = await holdFullRoute(page);
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across`);
    await full.started;
    await page.getByRole("button", { name: "In play" }).click();
    await expect(page.getByRole("button", { name: "In play" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#board-source-status")).toContainText("Opened checkout only");
    await expect(page.getByRole("button", { name: /Open async-01/i })).toHaveCount(0);
    full.release();
    await expect(page.getByRole("button", { name: /Open async-01/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "In play" })).toHaveAttribute("aria-pressed", "true");
  } finally {
    full.release();
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

for (const [bootCase, hash, layout] of [
  ["Columns at 1024x850", "layout=columns", "columns"],
  ["List from an explicit milestone-lens deep-link", "lens=milestone", "list"],
]) test(`Unfinished intent survives across startup reconciliation in ${bootCase}`, async ({ page }) => {
  const { owned, root } = await fixture(8);
  const full = await holdFullRoute(page);
  try {
    await page.setViewportSize({ width: 1024, height: 850 });
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across&${hash}`);
    await full.started;
    await expect(page.locator(`#board-layout-${layout}`)).toHaveAttribute("aria-selected", "true");
    if (hash.includes("lens=")) {
      await expect(page).toHaveURL(/lens=milestone/);
      await expect(page.locator("#board-view-toggle")).toContainText("By milestone");
    }
    const unfinished = page.getByRole("button", { name: "Unfinished" });
    await unfinished.click();
    await expect(unfinished).toHaveAttribute("aria-pressed", "true");
    full.release();
    await expect(unfinished).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /Open async-01/i })).toBeVisible();
    expect(await statusFiltersInHash(page)).toContain("in-progress");

    await page.reload();
    await expect(unfinished).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /Open async-01/i })).toBeVisible();
    expect(await statusFiltersInHash(page)).toContain("in-progress");
  } finally {
    full.release();
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("turning Unfinished off before the full response leaves no status filter", async ({ page }) => {
  const { owned, root } = await fixture(8);
  const full = await holdFullRoute(page);
  try {
    await page.setViewportSize({ width: 1024, height: 850 });
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across&layout=columns`);
    await full.started;
    const unfinished = page.getByRole("button", { name: "Unfinished" });
    await unfinished.click();
    await expect(unfinished).toHaveAttribute("aria-pressed", "true");
    await unfinished.click();
    await expect(unfinished).toHaveAttribute("aria-pressed", "false");
    expect(await statusFiltersInHash(page)).toEqual([]);
    full.release();
    await expect(page.locator("#board-source-status")).not.toContainText("Loading other worktrees");
    await expect(unfinished).toHaveAttribute("aria-pressed", "false");
    expect(await statusFiltersInHash(page)).toEqual([]);
  } finally {
    full.release();
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("a full-first load opens a deep-linked non-first derived feature in its requested checkout", async ({ page }) => {
  const { owned, root } = await fixture(8);
  await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across`);
  await expect(page.locator("#workspace-summary")).toContainText("9 features");
  await page.locator("#board-view-toggle").click();
  await page.locator('[data-lens-key="milestone"]').click();
  await page.getByRole("button", { name: /Open async-02/i }).click();
  await expect(page.locator("#editor-title")).toContainText("async-02");
  await page.locator("#editor-source-label").evaluate((details) => { details.open = true; });
  const selectedVersion = page.locator('#editor-source-select [data-editor-source]').filter({ hasText: "feature/blue" });
  await selectedVersion.click();
  await expect(selectedVersion).toHaveAttribute("aria-pressed", "true");
  const selectedSource = await selectedVersion.getAttribute("data-editor-source");
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get("source"))).toBe(selectedSource);
  const deepLink = page.url();
  const selectedRoute = await page.evaluate(() => Object.fromEntries(new URLSearchParams(location.hash.slice(1))));
  expect(selectedRoute.source).toBe(selectedSource);

  let resolveOpenedFailure;
  let openedStartedResolve;
  const openedFailureGate = new Promise((resolve) => { resolveOpenedFailure = resolve; });
  const openedStarted = new Promise((resolve) => { openedStartedResolve = resolve; });
  await page.route("**/api/worktree-workspace**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("openedOnly") === "1") {
      openedStartedResolve();
      await openedFailureGate;
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "late opened-only failure" } }) });
    }
    await openedStarted;
    return route.continue();
  });
  try {
    await page.reload();
    expect(page.url()).toBe(deepLink);
    await openedStarted;
    await expect(page.locator("#workspace-summary")).toContainText("9 features");
    await expect(page.locator("#editor-title")).toContainText("async-02");
    await page.locator("#editor-source-label").evaluate((details) => { details.open = true; });
    await expect(page.locator(`#editor-source-select [data-editor-source="${selectedSource}"]`)).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get("source"))).toBe(selectedSource);

    const failedOpenedResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("openedOnly") === "1");
    resolveOpenedFailure();
    expect((await failedOpenedResponse).status()).toBe(503);
    await expect(page.locator("#editor-title")).toContainText("async-02");
    await expect(page.locator(`#editor-source-select [data-editor-source="${selectedSource}"]`)).toHaveAttribute("aria-pressed", "true");
  } finally {
    resolveOpenedFailure();
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

for (const [scenario, userLens] of [["preserves the sibling-only milestone deep-link", "milestone"], ["keeps the user's newer status grouping", "status"]]) {
  test(scenario, async ({ page }) => {
    const { owned, root } = await fixtureSiblingOnlyMilestone();
    const full = await holdFullRoute(page);
    try {
      await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across&lens=milestone`);
      await full.started;
      await expect(page.locator("#board-source-status")).toContainText("Opened checkout only");
      if (userLens === "status") {
        await page.locator("#board-view-toggle").click();
        await page.locator('[data-lens-key="status"]').click();
        await expect(page.locator("#board-view-toggle")).toContainText("By status");
      }
      full.release();
      await expect(page.locator("#board-source-status")).not.toContainText("Loading other worktrees");
      await expect(page.locator("#board-view-toggle")).toContainText(`By ${userLens}`);
      await expect(page).toHaveURL(new RegExp(`lens=${userLens}`));
      if (userLens === "milestone") await expect(page.locator(".board-group .group-name").first()).toContainText("Async milestone");
    } finally {
      full.release();
      await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  });
}

test("an older initial load cannot rewrite a newer pending repository deep-link", async ({ page }) => {
  const older = await fixture(4);
  const newer = await fixture(5);
  const gates = new Map([older, newer].map(({ root }) => [root, { opened: gate(), full: gate() }]));
  await page.route("**/api/worktree-workspace**", async (route) => {
    const repo = route.request().headers()["x-minimap-repo"];
    const pair = gates.get(repo);
    if (!pair) return route.continue();
    const kind = new URL(route.request().url()).searchParams.get("openedOnly") === "1" ? "opened" : "full";
    return pair[kind].hold(route);
  });
  const oldSettled = new Set();
  const recordSettlement = (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/worktree-workspace" && request.headers()["x-minimap-repo"] === older.root)
      oldSettled.add(url.searchParams.get("openedOnly") === "1" ? "opened" : "full");
  };
  page.on("requestfailed", recordSettlement);
  page.on("requestfinished", recordSettlement);
  try {
    await page.goto(`/#repo=${encodeURIComponent(older.root)}&sources=across`);
    await Promise.all([gates.get(older.root).opened.started, gates.get(older.root).full.started]);
    const target = new URLSearchParams({ repo: newer.root, sources: "across", lens: "status", layout: "columns" }).toString();
    await page.evaluate((hash) => { window.location.hash = hash; }, target);
    await Promise.all([gates.get(newer.root).opened.started, gates.get(newer.root).full.started]);

    gates.get(older.root).opened.release();
    gates.get(older.root).full.release();
    await expect.poll(() => oldSettled.size).toBe(2);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const current = await page.evaluate(() => Object.fromEntries(new URLSearchParams(location.hash.slice(1))));
    expect(current).toMatchObject({ repo: newer.root, sources: "across", lens: "status", layout: "columns" });

    gates.get(newer.root).opened.release();
    gates.get(newer.root).full.release();
    await expect(page.locator("#workspace-summary")).toContainText("6 features");
    await expect(page.locator("#board-view-toggle")).toContainText("By status");
  } finally {
    for (const pair of gates.values()) { pair.opened.release(); pair.full.release(); }
    await fs.rm(older.owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    await fs.rm(newer.owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

for (const [scenario, response] of [["request failure", null], ["unavailable workspace", {
  sources: [], excluded: [], partial: true, unavailable: { reason: "not-git-or-unavailable" }, workspace: null,
  features: [], groups: [], coverage: { loaded: 0, excluded: 0, missingBoardRefs: [], identityUncertain: [] }, provisional: true,
}]]) test(`opened-only ${scenario} does not prevent the full worktree board from loading`, async ({ page }) => {
  const { owned, root } = await fixture(8);
  let partialRequests = 0;
  let releaseFull;
  const openedFinished = new Promise((resolve) => { releaseFull = resolve; });
  await page.route("**/api/worktree-workspace**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("openedOnly") === "1") {
      partialRequests += 1;
      await (response
        ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(response) })
        : route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "opened-only request failed" } }) }));
      releaseFull();
      return;
    }
    await openedFinished;
    return route.continue();
  });
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across`);
    await expect(page.locator("#workspace-summary")).toContainText("9 features");
    await page.locator('[data-group-toggle="unlisted:Not on a board"]').click();
    await expect(page.getByRole("button", { name: /Open blue-only/i })).toBeVisible();
    expect(partialRequests).toBeGreaterThan(0);
    await expect(page.locator("#board-source-status")).not.toContainText("Loading other worktrees");
  } finally { releaseFull(); await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
});

test("same-scope refresh preserves cards until the replacement settles and retries after failure", async ({ page }) => {
  const { owned, root } = await fixture(8);
  let attempt = 0;
  const held = gate();
  await page.route("**/api/worktree-workspace**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("openedOnly") === "1") return route.continue();
    attempt += 1;
    if (attempt === 1) return route.continue();
    if (attempt === 2) return held.hold(route);
    if (attempt === 3) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "refresh failed" } }) });
    return route.continue();
  });
  try {
    const completed = page.waitForResponse(async (response) => new URL(response.url()).pathname === "/api/worktree-workspace"
      && new URL(response.url()).searchParams.get("openedOnly") !== "1" && Boolean((await response.json()).workspace));
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across`);
    await completed;
    await expect(page.locator("#workspace-summary")).toContainText("9 features");
    await expect(page.getByRole("button", { name: /Open async-01/i })).toBeVisible();
    await page.locator("#refresh-button").click();
    await held.started;
    await expect(page.getByRole("button", { name: /Open async-01/i })).toBeVisible();
    await expect(page.locator("#board-source-status-summary")).toContainText("Updating");
    held.release();
    await expect(page.locator("#board-source-status-summary")).not.toContainText("Updating");
    await expect(page.locator("#workspace-summary")).toContainText("9 features");
    await expect(page.getByRole("button", { name: /Open async-01/i })).toBeVisible();
    await page.locator("#refresh-button").click();
    await expect(page.locator("#status-banner")).toContainText("refresh failed");
    await expect(page.getByRole("button", { name: /Open async-01/i })).toBeVisible();
    await page.locator("#refresh-button").click();
    await expect(page.getByRole("button", { name: /Open async-01/i })).toBeVisible();
    await expect.poll(() => attempt).toBe(4);
  } finally {
    held.release();
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("full failure keeps the provisional board and Refresh retries it", async ({ page }) => {
  const { owned, root } = await fixture(8);
  let fullRequests = 0;
  await page.route("**/api/worktree-workspace**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("openedOnly") === "1") return route.continue();
    fullRequests += 1;
    if (fullRequests === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "full request failed" } }) });
    return route.continue();
  });
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across`);
    await expect(page.getByRole("button", { name: /Open async-01/i })).toBeVisible();
    await expect(page.locator("#status-banner")).toContainText("full request failed");
    await expect(page.locator("#board-source-status")).toContainText("Opened checkout only");
    await expect(page.locator("#board-participant-status")).toContainText("Session badges unavailable");
    await expect(page.locator("#board-participant-status")).not.toContainText("Updating session badges");
    await page.locator("#refresh-button").click();
    await expect(page.locator("#workspace-summary")).toContainText("9 features");
    await page.locator('[data-group-toggle="unlisted:Not on a board"]').click();
    await expect(page.getByRole("button", { name: /Open blue-only/i })).toBeVisible();
  } finally { await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
});

test("switching to This ignores a late full-worktree response", async ({ page }) => {
  const { owned, root } = await fixture(8);
  const full = await holdFullRoute(page);
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across`);
    await full.started;
    await page.locator("#board-source-toggle").click();
    await page.locator('#board-source-menu [data-source-choice="this"]').click();
    await expect(page.locator("#board-source-toggle")).toContainText("This checkout");
    full.release();
    await expect(page.locator("#board-source-toggle")).toContainText("This checkout");
    await expect(page.getByRole("button", { name: /Open blue-only/i })).toHaveCount(0);
  } finally { full.release(); await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
});

test("This to Across shows the opened checkout before the pending full response", async ({ page }) => {
  const { owned, root } = await fixture(8);
  const full = await holdFullRoute(page);
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}`);
    await page.locator("#board-source-toggle").click();
    await page.locator('#board-source-menu [data-source-choice="across"]').click();
    await full.started;
    await expect(page.locator("#board-source-status")).toContainText("Opened checkout only");
    await expect(page.locator("#board-source-status")).toContainText("Loading other worktrees");
    await expect(page.getByRole("button", { name: /Open async-01/i })).toBeVisible();
  } finally { full.release(); await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
});

test("consecutive saves in Across mode keep the latest item revision", async ({ page }) => {
  const { owned, root } = await fixture(8);
  try {
    const fullResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/worktree-workspace"
      && new URL(response.url()).searchParams.get("openedOnly") !== "1");
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across`);
    await fullResponse;
    await expect(page.locator("#board-source-status-summary")).not.toContainText("Loading other worktrees");
    await page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#tab-structured").click();
    await page.locator("#metadata-toggle").click();
    const title = page.locator("#field-title");
    await expect(title).toBeVisible();
    await title.fill("Across first saved title");
    await page.locator("#save-button").click();
    await expect(page.locator("#status-banner")).toContainText("Saved.", { timeout: 15_000 });
    await title.fill("Across second saved title");
    await page.locator("#save-button").click();
    await expect(page.locator("#status-banner")).toContainText("Saved.", { timeout: 15_000 });
    await expect(title).toHaveValue("Across second saved title");
    await expect.poll(() => fs.readFile(path.join(root, "roadmap", "features", "async-01.md"), "utf8"))
      .toContain('title: "Across second saved title"');
  } finally { await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
});

test("refresh completing after a dirty source switch preserves the chosen source", async ({ page }, testInfo) => {
  const { owned, root } = await fixture(8);
  const held = gate();
  let fullRequests = 0;
  await page.route("**/api/worktree-workspace**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("openedOnly") === "1") return route.continue();
    fullRequests += 1;
    if (fullRequests === 2) return held.hold(route);
    return route.continue();
  });
  try {
    const initialFullResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/worktree-workspace"
      && new URL(response.url()).searchParams.get("openedOnly") !== "1");
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across`);
    await initialFullResponse;
    await expect(page.locator("#board-source-status-summary")).not.toContainText("Loading other worktrees");
    await page.locator("#editor-source-summary").click();
    const blue = page.locator('#editor-source-label [data-editor-source]').filter({ hasText: "blue" });
    await blue.click();
    await expect(page.locator("#field-status")).toHaveValue("in-progress");
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#tab-structured").click();
    await page.locator("#metadata-toggle").click();
    await expect(page.locator("#field-title")).toBeVisible();
    await page.locator("#field-title").fill("Discard this blue checkout draft");
    await page.locator("#refresh-button").click();
    await held.started;
    await page.locator("#editor-source-summary").click();
    const main = page.locator('#editor-source-label [data-editor-source]').filter({ hasText: /main/ });
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator("#editor-source-label").evaluate((details) => { details.open = true; });
      await page.screenshot({ path: testInfo.outputPath(`source-picker-${width}.png`) });
      const bounds = await page.locator("#editor-source-select").evaluate((menu) => {
        const menuBounds = menu.getBoundingClientRect();
        const panelBounds = document.querySelector("#editor-panel").getBoundingClientRect();
        return { menuLeft: menuBounds.left, menuRight: menuBounds.right, panelLeft: panelBounds.left, panelRight: panelBounds.right };
      });
      expect(bounds.menuLeft).toBeGreaterThanOrEqual(bounds.panelLeft);
      expect(bounds.menuRight).toBeLessThanOrEqual(bounds.panelRight);
    }
    page.once("dialog", (dialog) => dialog.accept());
    await main.click();
    await expect(page.locator("#field-status")).toHaveValue("done");
    await expect(page.locator("#field-title")).toHaveValue("async-01 — deliberately long async board regression title");
    held.release();
    await expect(page.locator("#board-source-status-summary")).not.toContainText("Loading other worktrees");
    await expect(page.locator("#field-status")).toHaveValue("done");
    await page.locator("#editor-source-summary").click();
    await expect(page.locator('#editor-source-label [data-editor-source][aria-pressed="true"]')).toContainText("main");
  } finally {
    held.release();
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("Refresh does not reopen an item explicitly closed while its response is pending", async ({ page }) => {
  const { owned, root } = await fixture(8);
  const full = await holdFullRoute(page);
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across`);
    await full.started;
    await page.getByRole("button", { name: /Open async-02/i }).click();
    await expect(page.locator("#editor-title")).toContainText("async-02");
    await page.locator("#board-layout-columns").click();
    await expect(page.locator("#editor-title")).toHaveText("Item");
    full.release();
    await expect(page.locator("#board-source-status-summary")).not.toContainText("Loading other worktrees");
    await expect(page.locator("#editor-title")).toHaveText("Item");
  } finally { full.release(); await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
});

test("Unfinished stays active when refresh leaves no unfinished features", async ({ page }) => {
  const { owned, root } = await fixture(4);
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across`);
    await expect(page.locator("#board-source-status-summary")).not.toContainText("Loading other worktrees");
    await page.getByRole("button", { name: "Unfinished" }).click();
    for (const checkout of [root, path.join(owned, "blue")]) {
      const directory = path.join(checkout, "roadmap", "features");
      for (const name of await fs.readdir(directory)) {
        const file = path.join(directory, name);
        await fs.writeFile(file, (await fs.readFile(file, "utf8")).replace(/^status: .+$/m, "status: done"));
      }
    }
    const refreshed = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/worktree-workspace"
      && new URL(response.url()).searchParams.get("openedOnly") !== "1");
    await page.locator("#refresh-button").click();
    await refreshed;
    await expect(page.getByRole("button", { name: "Unfinished" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#board-groups [data-item-open]")).toHaveCount(0);
  } finally { await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
});

test("many checkout versions keep the source picker inside the editor panel", async ({ page }, testInfo) => {
  const { owned, root } = await fixture(2);
  try {
    for (const name of ["green", "yellow", "red", "purple"]) {
      const checkout = path.join(owned, name);
      git(root, "worktree", "add", "-b", `feature/${name}`, checkout);
      const feature = path.join(checkout, "roadmap", "features", "async-01.md");
      await fs.writeFile(feature, (await fs.readFile(feature, "utf8"))
        .replace("title: async-01 — deliberately long async board regression title", `title: ${name} checkout version`));
    }
    const fullResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/worktree-workspace"
      && new URL(response.url()).searchParams.get("openedOnly") !== "1");
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across`);
    await fullResponse;
    await page.locator("#editor-source-summary").click();
    const choices = page.locator("#editor-source-label [data-editor-source]");
    await expect(choices).toHaveCount(6);
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator("#editor-source-label").evaluate((details) => { details.open = true; });
      const geometry = await page.locator("#editor-source-select").evaluate((menu) => {
        const menuBounds = menu.getBoundingClientRect();
        const panelBounds = document.querySelector("#editor-panel").getBoundingClientRect();
        return { bottom: menuBounds.bottom, panelBottom: panelBounds.bottom, height: menu.clientHeight, scrollHeight: menu.scrollHeight };
      });
      expect(geometry.bottom).toBeLessThanOrEqual(geometry.panelBottom);
      expect(geometry.height).toBeLessThan(geometry.scrollHeight);
      await page.screenshot({ path: testInfo.outputPath(`many-sources-${width}.png`) });
    }
    await choices.last().click();
    await expect(choices.last()).toHaveAttribute("aria-pressed", "true");
  } finally { await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
});
