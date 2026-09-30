import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

test("opened-only board is interactive while the full worktree request is pending", async ({ page }, testInfo) => {
  const { owned, root } = await fixture(64);
  const full = await holdFullRoute(page);
  const reads = [];
  const participantRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/source/")) reads.push(request.method());
    if (/\/api\/(board\/participant-counts|items\/.*\/participants)/.test(request.url())) participantRequests.push(request.url());
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

for (const [scenario, response] of [["request failure", null], ["unavailable workspace", {
  sources: [], excluded: [], partial: true, unavailable: { reason: "not-git-or-unavailable" }, workspace: null,
  features: [], groups: [], coverage: { loaded: 0, excluded: 0, missingBoardRefs: [], identityUncertain: [] }, provisional: true,
}]]) test(`opened-only ${scenario} does not prevent the full worktree board from loading`, async ({ page }) => {
  const { owned, root } = await fixture(8);
  let partialRequests = 0;
  await page.route("**/api/worktree-workspace**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("openedOnly") === "1") {
      partialRequests += 1;
      return response
        ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(response) })
        : route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "opened-only request failed" } }) });
    }
    return route.continue();
  });
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across`);
    await expect(page.locator("#workspace-summary")).toContainText("9 features");
    await page.locator('[data-group-toggle="unlisted:Not on a board"]').click();
    await expect(page.getByRole("button", { name: /Open blue-only/i })).toBeVisible();
    expect(partialRequests).toBeGreaterThan(0);
    await expect(page.locator("#board-source-status")).not.toContainText("Loading other worktrees");
  } finally { await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
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
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across`);
    await expect(page.getByRole("button", { name: /Open async-01/i })).toBeVisible();
    await page.locator("#refresh-button").click();
    await held.started;
    await expect(page.getByRole("button", { name: /Open async-01/i })).toBeVisible();
    await expect(page.locator("#board-source-status-summary")).toContainText("Loading other worktrees");
    held.release();
    await expect(page.locator("#board-source-status-summary")).not.toContainText("Loading other worktrees");
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
