import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
}

async function fixture(count = 84) {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-worktree-ui-"));
  const root = path.join(owned, "main");
  const sibling = path.join(owned, "blue");
  await fs.mkdir(path.join(root, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"));
  await fs.writeFile(path.join(root, "roadmap", "ideas", ".gitkeep"), "");
  const ids = Array.from({ length: count }, (_, index) => `large-${String(index + 1).padStart(2, "0")}`);
  const lanes = Array.from({ length: 10 }, (_, index) => `Lane ${String(index + 1).padStart(2, "0")} · long release workstream`);
  const board = lanes.flatMap((lane, index) => [`# ${lane}`, ...ids.filter((_, itemIndex) => itemIndex % lanes.length === index).map((id) => `- ${id}`), ""]).join("\n");
  await fs.writeFile(path.join(root, "roadmap", "board.md"), board);
  await fs.writeFile(path.join(root, "roadmap", "scope.md"), "Temporary large-project visual fixture.\n");
  for (const [index, id] of ids.entries()) {
    await fs.writeFile(path.join(root, "roadmap", "features", `${id}.md`), `---\nid: ${id}\ntitle: ${id} — a deliberately long feature title that remains readable\nstatus: ${index === 0 ? "done" : "queued"}\npriority: ${index % 2 ? "medium" : "high"}\ncommitment: committed\nmilestone: Milestone ${String(index % 12 + 1).padStart(2, "0")} · long horizon\n---\n\n## Summary\n\nDescription for ${id}. This should be visible when the board gets enough room.\n`);
  }
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.invalid");
  git(root, "config", "core.autocrlf", "false");
  git(root, "add", ".");
  git(root, "commit", "-m", "base");
  const branch = "feature/blue/with-an-intentionally-long-name-for-narrow-version-controls";
  git(root, "worktree", "add", "-b", branch, sibling);
  const changed = path.join(sibling, "roadmap", "features", "large-01.md");
  await fs.writeFile(changed, (await fs.readFile(changed, "utf8")).replace("status: done", "status: in-progress"));
  const contentOnly = path.join(sibling, "roadmap", "features", "large-02.md");
  await fs.writeFile(contentOnly, (await fs.readFile(contentOnly, "utf8")).replace("Description for large-02.", "Body-only change for large-02."));
  await fs.writeFile(path.join(sibling, "roadmap", "features", "blue-only.md"), "---\nid: blue-only\ntitle: Blue-only untracked feature\nstatus: queued\npriority: high\ncommitment: committed\n---\n\n## Summary\n\nUntracked work must be visible.\n");
  return { owned, root, sibling };
}

test("combined large board stays usable in List and Columns at desktop and narrow widths", async ({ page, request }, testInfo) => {
  test.setTimeout(90_000);
  const apiFailures = [];
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/api/")) apiFailures.push({ url: response.url(), status: response.status() });
  });
  const { owned, root } = await fixture();
  const inventory = await (await request.get("/api/worktree-sources", { headers: { "X-Minimap-Repo": root } })).json();
  const blueSource = inventory.sources.find((source) => source.repoRoot.toLowerCase() !== root.toLowerCase());
  testInfo.attach("fixture", { body: root, contentType: "text/plain" });
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}`);
    await expect(page.locator("#board-source-toggle")).toBeVisible();
    await page.locator("#board-source-toggle").click();
    await expect(page.locator('#board-source-menu [data-source-choice="across"]')).toBeEnabled();
    await page.locator('#board-source-menu [data-source-choice="across"]').click();
    await expect(page.locator("#workspace-summary")).toContainText("85 features");
    await expect(page.locator("#board-source-status-details")).toContainText("2 roadmap checkouts loaded; 0 excluded");
    await expect(page.locator("#editor-title")).toContainText("large-01");
    await expect(page.locator("#editor-source-label")).toBeVisible();
    await page.locator("#editor-source-summary").click();
    await expect(page.locator("#editor-source-label [data-editor-source]")).toHaveCount(2);
    await expect(page.locator("#editor-source-label [data-editor-source]").first().locator(".editor-source-meta .badge-field-status")).toBeVisible();
    await expect(page.locator("#editor-source-label [data-editor-source]").first().locator(".editor-source-meta")).not.toContainText("main");
    expect(apiFailures).toEqual([]);
    await page.locator('#editor-source-label [data-editor-source]').filter({ hasText: "feature/blue" }).click();
    await expect(page.locator("#field-status")).toHaveValue("in-progress");
    await expect(page.locator('#editor-source-label [data-editor-source]').filter({ hasText: "main" })).toContainText("Status: done (selected: in-progress)");
    await expect(page).toHaveURL(/source=/);
    await page.reload();
    await expect(page.locator("#field-status")).toHaveValue("in-progress");
    await page.locator("#editor-source-summary").click();
    await expect(page.locator('#editor-source-label [data-editor-source][aria-pressed="true"]')).toContainText("feature/blue/with-an-intentionally-long-name-for-narrow-version-controls");
    await expect(page.locator('#editor-source-label [data-editor-source][aria-pressed="true"]')).toContainText("in-progress");
    await page.getByRole("button", { name: "Unfinished" }).click();
    const filteredMain = page.locator('#editor-source-label [data-editor-source]').filter({ hasText: "main" });
    await expect(filteredMain).toContainText("filtered out");
    await filteredMain.click();
    await expect(page.locator("#field-status")).toHaveValue("done");
    await expect(filteredMain).toHaveAttribute("aria-pressed", "true");
    await page.locator("#editor-source-summary").click();
    await expect(page.locator('#editor-source-label [data-editor-source]').filter({ hasText: "feature/blue/with-an-intentionally-long-name-for-narrow-version-controls" }))
      .toContainText("Status: in-progress (selected: done)");
    await page.locator('#editor-source-label [data-editor-source]').filter({ hasText: "feature/blue/with-an-intentionally-long-name-for-narrow-version-controls" }).click();
    await page.getByRole("button", { name: "Unfinished" }).click();
    await page.getByRole("button", { name: /Open large-02/ }).first().click();
    await page.locator("#editor-source-summary").click();
    const contentOnlyVersion = page.locator('#editor-source-label [data-editor-source]').filter({ hasText: "feature/blue/with-an-intentionally-long-name-for-narrow-version-controls" });
    await expect(contentOnlyVersion).toContainText("Content differs");
    await expect(contentOnlyVersion).not.toContainText(/Status:/);
    await contentOnlyVersion.click();
    await page.locator("#editor-source-summary").click();
    await expect(contentOnlyVersion).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("combined-list-desktop.png"), fullPage: true });
    await page.locator('[data-group-toggle="unlisted:Not on a board"]').click();
    await expect(page.getByText("Blue-only untracked feature")).toBeVisible();

    await page.locator("#board-layout-columns").click();
    await expect(page.locator(".board-column-card").first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("combined-columns-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 760, height: 900 });
    await page.screenshot({ path: testInfo.outputPath("combined-columns-narrow.png"), fullPage: true });
    await page.locator("#board-layout-list").click();
    await page.screenshot({ path: testInfo.outputPath("combined-list-narrow.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 840 });
    await page.locator("#board-layout-columns").click();
    await page.getByRole("button", { name: /Open large-02/ }).first().click();
    if (!(await page.locator("#editor-source-label").evaluate((element) => element.open))) await page.locator("#editor-source-summary").click();
    await expect(contentOnlyVersion).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("expanded-versions-columns-390.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await page.locator("#board-layout-list").click();
    await page.screenshot({ path: testInfo.outputPath("expanded-versions-list-390.png") });
    await page.locator("#board-source-toggle").click();
    const menuBounds = await page.locator("#board-source-menu").evaluate((menu) => ({
      right: menu.getBoundingClientRect().right,
      left: menu.getBoundingClientRect().left,
      viewportRight: window.innerWidth,
    }));
    expect(menuBounds.right).toBeLessThanOrEqual(menuBounds.viewportRight + 1);
    expect(menuBounds.left).toBeGreaterThanOrEqual(-1);
    await page.locator("#board-source-menu").press("Escape");
    const overflowing = await page.locator(".board-item, .board-column-card").evaluateAll((cards) => cards.filter((card) => {
      const parent = card.parentElement;
      return card.getBoundingClientRect().right > parent.getBoundingClientRect().right + 2;
    }).length);
    expect(overflowing).toBe(0);
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#tab-raw").click();
    const raw = await page.locator("#raw-text").inputValue();
    const draft = `${raw}\n<!-- unsaved worktree draft -->\n`;
    await page.locator("#raw-text").fill(draft);
    await page.locator("#refresh-button").click();
    await expect(page.locator("#raw-text")).toHaveValue(draft);
    await expect(page.locator("#tab-raw")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('#editor-source-label [data-editor-source][aria-pressed="true"]')).toContainText("feature/blue/with-an-intentionally-long-name-for-narrow-version-controls");
    await expect(page.locator('#editor-source-label [data-editor-source][aria-pressed="true"]')).toContainText("in-progress");
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("source menu stays responsive during discovery, deduplicates refresh, and ignores a closed response", async ({ page }) => {
  const { owned, root } = await fixture(2);
  let inventoryCalls = 0;
  let releaseFirst;
  let releaseSecond;
  let releaseThird;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const secondGate = new Promise((resolve) => { releaseSecond = resolve; });
  const thirdGate = new Promise((resolve) => { releaseThird = resolve; });
  const aggregates = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/worktree-workspace")) aggregates.push(request.url());
  });
  const fullAggregates = () => aggregates.filter((url) => new URL(url).searchParams.get("openedOnly") !== "1");
  await page.route("**/api/worktree-sources**", async (route) => {
    inventoryCalls += 1;
    if (inventoryCalls === 1) {
      await firstGate;
      await route.continue();
      return;
    }
    if (inventoryCalls === 2) {
      await secondGate;
      await route.continue();
      return;
    }
    if (inventoryCalls === 3) {
      await thirdGate;
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "inventory unavailable" } }) });
      return;
    }
    await route.continue();
  });
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}`);
    const firstRequest = page.waitForRequest((request) => request.url().includes("/api/worktree-sources"));
    await page.locator("#board-source-toggle").click();
    await expect(page.locator("#board-source-menu")).toBeVisible();
    await expect(page.locator('#board-source-menu [data-source-choice="this"]')).toBeVisible();
    await expect(page.locator('#board-source-menu [data-source-choice="across"]')).toBeVisible();
    await firstRequest;
    await page.locator("#board-source-toggle").click();
    await expect(page.locator("#board-source-menu")).toBeHidden();
    expect(aggregates).toEqual([]);
    const firstResponse = page.waitForResponse((response) => response.url().includes("/api/worktree-sources"));
    releaseFirst();
    await firstResponse;
    await expect(page.locator("#board-source-menu")).toBeHidden();

    const secondRequest = page.waitForRequest((request) => request.url().includes("/api/worktree-sources"));
    await page.locator("#board-source-toggle").click();
    await secondRequest;
    await page.locator("#board-source-toggle").click();
    await expect(page.locator("#board-source-menu")).toBeHidden();
    await page.locator("#board-source-toggle").click();
    await expect(page.locator("#board-source-menu")).toBeVisible();
    expect(inventoryCalls).toBe(2);
    await page.locator('#board-source-menu [data-source-choice="this"]').focus();
    const secondResponse = page.waitForResponse((response) => response.url().includes("/api/worktree-sources"));
    releaseSecond();
    await secondResponse;
    await expect(page.locator('#board-source-menu [data-source-choice="this"]')).toBeFocused();
    await expect(page.locator('#board-source-menu [data-source-choice]').filter({ hasText: "feature/blue/with-an-intentionally-long-name-for-narrow-version-controls" })).toBeVisible();

    const thirdRequest = page.waitForRequest((request) => request.url().includes("/api/worktree-sources"));
    await page.locator("#board-source-toggle").click();
    await page.locator("#board-source-toggle").click();
    await thirdRequest;
    await expect(page.locator('#board-source-menu [data-source-choice]').filter({ hasText: "feature/blue/with-an-intentionally-long-name-for-narrow-version-controls" })).toBeVisible();
    const thirdResponse = page.waitForResponse((response) => response.url().includes("/api/worktree-sources"));
    releaseThird();
    expect((await thirdResponse).status()).toBe(503);
    await expect(page.locator('#board-source-menu [data-source-choice]').filter({ hasText: "feature/blue/with-an-intentionally-long-name-for-narrow-version-controls" })).toBeVisible();
    await expect(page.locator("#board-source-menu")).toContainText(/last-known|unavailable/i);
    await expect(page.locator("#board-source-menu")).toBeVisible();
    expect(aggregates).toEqual([]);

    const acrossRequest = page.waitForRequest((request) => request.url().includes("/api/worktree-workspace"));
    await page.locator('#board-source-menu [data-source-choice="across"]').click();
    await acrossRequest;
    expect(fullAggregates()).toHaveLength(1);
  } finally {
    releaseFirst();
    releaseSecond();
    releaseThird();
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("inventory from a previous repository cannot replace the current repository menu", async ({ page }) => {
  const a = await fixture(2);
  const b = await fixture(2);
  let releaseA;
  const gateA = new Promise((resolve) => { releaseA = resolve; });
  await page.route("**/api/worktree-sources**", async (route) => {
    if (route.request().headers()["x-minimap-repo"]?.toLowerCase() === a.root.toLowerCase()) await gateA;
    await route.continue();
  });
  try {
    await page.goto(`/#repo=${encodeURIComponent(a.root)}`);
    const inventoryA = page.waitForRequest((request) => request.url().includes("/api/worktree-sources")
      && request.headers()["x-minimap-repo"]?.toLowerCase() === a.root.toLowerCase());
    await page.locator("#board-source-toggle").click();
    await inventoryA;

    const workspaceB = page.waitForResponse((response) => response.url().endsWith("/api/workspace")
      && response.request().headers()["x-minimap-repo"]?.toLowerCase() === b.root.toLowerCase());
    await page.evaluate((repo) => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      params.set("repo", repo);
      window.location.hash = params.toString();
    }, b.root);
    await workspaceB;
    if (await page.locator("#board-source-menu").isVisible()) await page.locator("#board-source-toggle").click();
    const inventoryB = page.waitForRequest((request) => request.url().includes("/api/worktree-sources")
      && request.headers()["x-minimap-repo"]?.toLowerCase() === b.root.toLowerCase());
    await page.locator("#board-source-toggle").click();
    await inventoryB;
    await expect(page.locator('#board-source-menu [data-source-choice="this"]')).toContainText(b.root);

    const responseA = page.waitForResponse((response) => response.url().includes("/api/worktree-sources")
      && response.request().headers()["x-minimap-repo"]?.toLowerCase() === a.root.toLowerCase());
    releaseA();
    await responseA;
    await expect(page.locator("#board-source-menu")).toBeVisible();
    await expect(page.locator('#board-source-menu [data-source-choice="this"]')).toContainText(b.root);
  } finally {
    releaseA();
    await fs.rm(a.owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    await fs.rm(b.owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("partial worktree discovery is explicit and does not imply complete coverage", async ({ page }) => {
  const { owned, root } = await fixture(2);
  const missing = path.join(owned, "missing-checkout");
  git(root, "worktree", "add", "-b", "feature/missing", missing);
  await fs.rm(missing, { recursive: true, force: true });
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}`);
    await page.locator("#board-source-toggle").click();
    await expect(page.locator('#board-source-menu [data-source-choice="across"]')).toBeEnabled();
    await page.locator('#board-source-menu [data-source-choice="across"]').click();
    await expect(page.locator("#board-source-status")).toContainText(/partial/i);
    await expect(page.locator("#board-source-status-details")).toContainText("1 excluded");
    await page.locator("#board-source-toggle").click();
    await expect(page.locator("#board-source-menu")).toContainText(/unavailable|excluded/i);
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("a raw draft survives same-path source replacement and stale saves are rejected", async ({ page }) => {
  const { owned, root, sibling } = await fixture(2);
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}`);
    await page.locator("#board-source-toggle").click();
    await page.locator('#board-source-menu [data-source-choice]').filter({ hasText: "feature/blue/with-an-intentionally-long-name-for-narrow-version-controls" }).click();
    await expect(page).toHaveURL(/sources=this&bound=1/);
    await expect(page.locator("#editor-title")).toContainText("large-01");
    await page.locator("#tab-structured").click();
    await page.locator("#tab-raw").click();
    const draft = `${await page.locator("#raw-text").inputValue()}\n<!-- same-path replacement draft -->\n`;
    await page.locator("#raw-text").fill(draft);

    git(sibling, "switch", "--detach", "HEAD");
    await page.locator("#save-button").click();
    await expect(page.locator("#raw-text")).toHaveValue(draft);
    await expect(page.locator("#status-banner")).toContainText(/source|checkout|changed|stale/i);
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("a discovered checkout selection uses its fresh inventory binding", async ({ page, request }) => {
  const { owned, root } = await fixture(2);
  try {
    const inventory = await (await request.get("/api/worktree-sources", { headers: { "X-Minimap-Repo": root } })).json();
    const blueSource = inventory.sources.find((source) => source.repoRoot.toLowerCase() !== root.toLowerCase());
    await page.goto(`/#repo=${encodeURIComponent(root)}`);
    await page.locator("#board-source-toggle").click();
    const blueChoice = page.locator('#board-source-menu [data-source-choice]').filter({ hasText: "feature/blue/with-an-intentionally-long-name-for-narrow-version-controls" });
    await expect(blueChoice).toBeVisible();
    const bindingRequest = page.waitForRequest((request) => request.url().includes("/api/worktree-source-workspace"));
    await blueChoice.click();
    const binding = await bindingRequest;
    expect(JSON.parse(binding.headers()["x-minimap-source-context"])).toEqual(blueSource);
    await page.locator("#board-source-toggle").click();
    const aggregateResponse = page.waitForResponse((response) => response.url().includes("/api/worktree-workspace"));
    await page.locator('#board-source-menu [data-source-choice="across"]').click();
    expect((await aggregateResponse).status()).toBe(200);
    await expect(page.locator("#workspace-summary")).toContainText("3 features");
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("a failed checkout load can retry through Refresh and the current-source choice", async ({ page }) => {
  const { owned, root } = await fixture(2);
  let attempts = 0;
  await page.route("**/api/worktree-source-workspace", async (route) => {
    attempts += 1;
    if (attempts <= 2) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "temporary checkout failure" } }) });
    else await route.continue();
  });
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}`);
    await page.locator("#board-source-toggle").click();
    await page.locator('#board-source-menu [data-source-choice]').filter({ hasText: "feature/blue/with-an-intentionally-long-name-for-narrow-version-controls" }).click();
    await expect(page.locator("#status-banner")).toContainText("temporary checkout failure");
    await expect(page.locator("#board-groups")).not.toContainText("large-01");
    await page.locator("#refresh-button").click();
    await expect.poll(() => attempts).toBe(2);
    await page.locator("#board-source-toggle").click();
    await page.locator('#board-source-menu [data-source-choice="this"]').click();
    await expect(page.locator("#editor-title")).toContainText("large-01");
    expect(attempts).toBe(3);
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

for (const [trigger, discoveryFails] of [["Refresh", false], ["Refresh", true], ["current source", false]]) {
  test(`a delayed ${trigger} discovery${discoveryFails ? " error" : ""} cannot replace a newer Across view`, async ({ page }) => {
    const { owned, root } = await fixture(2);
    let boundLoads = 0;
    let aggregateLoads = 0;
    let heldDiscovery;
    let discoveryStarted;
    const started = new Promise((resolve) => { discoveryStarted = resolve; });
    page.on("request", (request) => {
      if (request.url().includes("/api/worktree-workspace") && new URL(request.url()).searchParams.get("openedOnly") !== "1") aggregateLoads += 1;
    });
    await page.route("**/api/worktree-source-workspace", async (route) => {
      boundLoads += 1;
      if (boundLoads === 1) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "temporary checkout failure" } }) });
      else await route.continue();
    });
    try {
      await page.goto(`/#repo=${encodeURIComponent(root)}`);
      await page.locator("#board-source-toggle").click();
      await page.locator('#board-source-menu [data-source-choice]').filter({ hasText: "feature/blue/with-an-intentionally-long-name-for-narrow-version-controls" }).click();
      await expect(page.locator("#status-banner")).toContainText("temporary checkout failure");
      await page.route("**/api/worktree-sources", async (route) => {
        if (!heldDiscovery) { heldDiscovery = route; discoveryStarted(); }
        else await route.continue();
      });
      if (trigger === "Refresh") await page.locator("#refresh-button").click();
      else {
        await page.locator("#board-source-toggle").click();
        await page.locator('#board-source-menu [data-source-choice="this"]').click();
      }
      await started;
      await page.locator("#board-source-toggle").click();
      await page.locator('#board-source-menu [data-source-choice="across"]').click();
      await expect(page.locator("#workspace-summary")).toContainText("3 features");
      expect(aggregateLoads).toBe(1);
      const settled = page.waitForResponse((response) => response.request() === heldDiscovery.request());
      if (discoveryFails) await heldDiscovery.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "stale discovery failure" } }) });
      else await heldDiscovery.continue();
      await (await settled).finished();
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      expect(boundLoads).toBe(1);
      expect(aggregateLoads).toBe(1);
      await expect(page.locator("#board-source-toggle")).toContainText("Across worktrees");
      await expect(page.locator("#workspace-summary")).toContainText("3 features");
      await expect(page.locator("#status-banner")).not.toContainText("stale discovery failure");
    } finally {
      await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  });
}

test("bound HTTP routes reject missing, stale, and escaping source context without modifying files", async ({ request }) => {
  const { owned, root } = await fixture(2);
  try {
    const repoHeaders = { "X-Minimap-Repo": root };
    const aggregateResponse = await request.get("/api/worktree-workspace", { headers: repoHeaders });
    expect(aggregateResponse.status()).toBe(200);
    const aggregate = await aggregateResponse.json();
    const context = aggregate.sources[0];
    expect(context.repoRoot.toLowerCase()).toBe(root.toLowerCase());
    const headers = { ...repoHeaders, "X-Minimap-Source-Context": JSON.stringify(context) };
    const itemPath = path.join(root, "roadmap", "features", "large-01.md");
    const itemBefore = await fs.readFile(itemPath, "utf8");
    const boardPath = path.join(root, "roadmap", "board.md");
    const boardBefore = await fs.readFile(boardPath, "utf8");
    const scopePath = path.join(root, "roadmap", "scope.md");
    const scopeBefore = await fs.readFile(scopePath, "utf8");

    const missing = await request.get("/api/source/items/large-01", { headers: repoHeaders });
    expect(missing.status()).toBe(400);
    expect((await missing.json()).error.code).toBe("source_context_required");
    const wrong = await request.get("/api/source/items/large-01", { headers: {
      ...repoHeaders, "X-Minimap-Source-Context": JSON.stringify({ ...context, git: { ...context.git, branchRef: "refs/heads/other" } }),
    } });
    expect(wrong.status()).toBe(409);
    expect((await wrong.json()).error.code).toBe("source_changed");
    const workspace = await request.get("/api/source/workspace", { headers });
    expect(workspace.status(), JSON.stringify(await workspace.json())).toBe(200);
    const item = await request.get("/api/source/items/large-01", { headers });
    expect(item.status()).toBe(200);
    const itemBody = await item.json();
    expect((await request.post("/api/source/items/large-01", { headers, data: { rawText: itemBody.rawText } })).status()).toBe(400);
    expect((await request.post("/api/source/items/large-01", { headers, data: { rawText: itemBody.rawText, expectedRevision: "stale" } })).status()).toBe(409);
    expect((await request.post("/api/source/board", { headers, data: { groups: [] } })).status()).toBe(400);
    expect((await request.post("/api/source/board", { headers, data: { groups: [], expectedRevision: "stale" } })).status()).toBe(409);
    expect((await request.post("/api/source/scope", { headers, data: { scopeText: "changed" } })).status()).toBe(400);
    expect((await request.post("/api/source/scope", { headers, data: { scopeText: "changed", expectedRevision: "stale" } })).status()).toBe(409);
    expect((await request.post("/api/source/setup/initialize", { headers, data: {} })).status()).toBe(400);
    expect((await request.post("/api/source/spec-sessions/attach", { headers, data: { file: path.join(owned, "outside.md") } })).status()).toBe(403);
    expect((await request.get(`/api/source/spec-sessions/by-file?path=${encodeURIComponent(path.join(owned, "outside.md"))}`, { headers })).status()).toBe(403);
    for (const action of ["apply", "rollback"]) {
      expect((await request.post(`/api/source/spec-sessions/by-file/suggestions/unknown/${action}`, {
        headers, data: { file: path.join(owned, "outside.md") },
      })).status()).toBe(403);
    }
    await fs.cp(path.join(root, "roadmap"), path.join(root, "alternate-roadmap"), { recursive: true });
    const configPath = path.join(root, "roadmap.config.json");
    await fs.writeFile(configPath, JSON.stringify({ roadmapPath: "alternate-roadmap" }));
    const relocated = await request.get("/api/source/workspace", { headers });
    expect(relocated.status()).toBe(409);
    expect((await relocated.json()).error.code).toBe("source_changed");
    await fs.rm(configPath);
    const delayedBody = JSON.stringify({ scopeText: "must not be saved", expectedRevision: (await workspace.json()).scopeRevision });
    const delayedStatus = await new Promise((resolve, reject) => {
      const outbound = http.request("http://127.0.0.1:4315/api/source/scope", {
        method: "POST", headers: { ...headers, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(delayedBody) },
      }, (incoming) => {
        incoming.resume();
        incoming.on("end", () => resolve(incoming.statusCode));
      });
      outbound.on("error", reject);
      outbound.write(delayedBody.slice(0, 12));
      setTimeout(() => {
        try { git(root, "switch", "-c", "changed-while-body-open"); outbound.end(delayedBody.slice(12)); }
        catch (error) { outbound.destroy(); reject(error); }
      }, 250);
    });
    expect(delayedStatus).toBe(409);
    expect(await fs.readFile(itemPath, "utf8")).toBe(itemBefore);
    expect(await fs.readFile(boardPath, "utf8")).toBe(boardBefore);
    expect(await fs.readFile(scopePath, "utf8")).toBe(scopeBefore);
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("scope drafts survive Refresh and canceled checkout or URL navigation", async ({ page }) => {
  const { owned, root } = await fixture(2);
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}`);
    await expect(page.locator("#scope-edit-button")).toBeVisible();
    await page.locator("#scope-edit-button").click();
    const draft = "Temporary large-project visual fixture.\nUnsaved scope draft stays here.";
    await page.locator("#scope-text").fill(draft);
    await page.locator("#refresh-button").click();
    await expect(page.locator("#scope-text")).toHaveValue(draft);
    await expect(page.locator("#status-banner")).toContainText("Save or discard");
    await page.locator("#board-source-toggle").click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.locator('[data-source-choice="across"]').click();
    await expect(page.locator("#board-source-toggle")).toContainText("This checkout");
    await expect(page.locator("#scope-text")).toHaveValue(draft);
    const url = page.url();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.evaluate(() => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      params.set("sources", "across");
      window.location.hash = params.toString();
    });
    await expect(page).toHaveURL(url);
    await expect(page.locator("#scope-text")).toHaveValue(draft);
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("cross-group versions and missing board references stay visible in derived lenses", async ({ page }) => {
  const { owned, root, sibling } = await fixture(2);
  try {
    const boardPath = path.join(sibling, "roadmap", "board.md");
    const board = await fs.readFile(boardPath, "utf8");
    await fs.writeFile(boardPath, board.replace("- large-01\n", "")
      .replace("- large-02\n", "- large-02\n- large-01\n- vanished-feature\n"));
    await page.goto(`/#repo=${encodeURIComponent(root)}`);
    await page.locator("#board-source-toggle").click();
    await page.locator('[data-source-choice="across"]').click();
    await expect(page.locator("#board-source-status-summary")).toContainText("3 features");
    await page.locator("#board-source-status-summary").click();
    await expect(page.locator("#board-source-status-details")).toContainText("4 placements in 3 groups");
    await expect(page.locator("#board-source-status-details")).toContainText("1 missing board references");
    await expect(page.getByText("Also in Lane 02")).toBeVisible();
    await page.locator("#board-source-toggle").click();
    await expect(page.locator("#board-source-menu")).toContainText("1 missing board reference");
    await page.locator("#board-source-menu .board-source-missing summary").click();
    await expect(page.locator("#board-source-menu .board-source-missing li")).toContainText(/blue · feature\/blue\/.+ · Lane 02/);
    await expect(page.locator("#board-source-menu .board-source-missing li")).toContainText("vanished-feature");
    const url = new URL(page.url());
    const params = new URLSearchParams(url.hash.slice(1));
    params.set("lens", "milestone");
    await page.goto(`/#${params.toString()}`);
    await expect(page.locator("#board-source-status-summary")).toContainText("3 features");
    await expect(page.locator("#board-source-status-details")).toContainText("1 missing board references");
    await expect(page.locator("#board-source-status")).toBeVisible();
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("an unavailable version deep link needs confirmation before opening another checkout", async ({ page, request }) => {
  const { owned, root } = await fixture(2);
  try {
    const aggregate = await (await request.get("/api/worktree-workspace", { headers: { "X-Minimap-Repo": root } })).json();
    const feature = aggregate.features.find((entry) => entry.id === "large-01");
    const appearance = JSON.stringify([feature.key, "board", "Lane 01 · long release workstream"]);
    const params = new URLSearchParams({ repo: root, sources: "across", item: appearance,
      source: "unavailable-source", sourceRef: "refs/heads/gone" });
    page.on("dialog", (dialog) => dialog.dismiss());
    await page.goto(`/#${params}`);
    await expect(page.locator("#status-banner")).toContainText("selected checkout version changed or is unavailable");
    await expect(page.locator("#editor-title")).not.toContainText("large-01");
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("independent same-ID features do not acquire participant detail from each other", async ({ page }) => {
  const { owned, root, sibling } = await fixture(2);
  try {
    for (const [source, title] of [[root, "Ambiguous main"], [sibling, "Ambiguous blue"]]) {
      await fs.writeFile(path.join(source, "roadmap", "features", "ambiguous.md"),
        `---\nid: ambiguous\ntitle: ${title}\nstatus: queued\npriority: high\ncommitment: committed\n---\n\n## Summary\n\nSeparate creation.\n`);
      const boardPath = path.join(source, "roadmap", "board.md");
      await fs.appendFile(boardPath, "\n# Ambiguous lane\n- ambiguous\n");
    }
    const participantReads = [];
    page.on("request", (outbound) => { if (outbound.url().includes("/items/ambiguous/participants")) participantReads.push(outbound.url()); });
    await page.goto(`/#repo=${encodeURIComponent(root)}`);
    await page.locator("#board-source-toggle").click();
    await page.locator('[data-source-choice="across"]').click();
    await expect(page.locator("#workspace-summary")).toContainText("5 features");
    await expect(page.getByRole("button", { name: "Open Ambiguous main" })).toBeVisible();
    await page.getByRole("button", { name: "Open Ambiguous main" }).click();
    await expect(page.locator("#item-participants-status")).toHaveText("Association ambiguous");
    expect(participantReads).toEqual([]);
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("Across participant badges survive view invalidation and stay scoped to their workspace snapshot", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const { owned, root, sibling } = await fixture(64);
  const other = await fixture(2);
  const completedPath = path.join(sibling, "roadmap", "features", "large-01.md");
  await fs.writeFile(completedPath, (await fs.readFile(completedPath, "utf8")).replace("status: in-progress", "status: done"));
  const aggregateReads = [];
  const boardCountReads = [];
  const participantReads = [];
  let injectCounts = true;
  let recentCount = 1;
  page.on("request", (request) => {
    if (/\/api\/worktree-workspace(?:\?|$)/.test(request.url())) aggregateReads.push(request.url());
    if (/\/api\/(?:source\/)?board\/participant-counts(?:\?|$)/.test(request.url())) boardCountReads.push(request.url());
    if (/\/api\/(?:source\/)?items\/[^/]+\/participants(?:\?|$)/.test(request.url())) participantReads.push(request.url());
  });
  await page.route(/\/api\/worktree-workspace(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    const openedOnly = new URL(route.request().url()).searchParams.get("openedOnly") === "1";
    if (injectCounts && !openedOnly && !payload.provisional && Array.isArray(payload.features)) {
      const featureKey = (id) => payload.features.find((feature) => feature.id === id)?.key;
      const rows = [
        { id: "large-02", recentParticipantCount: recentCount, dormantParticipantCount: 0 },
        { id: "large-03", recentParticipantCount: 0, dormantParticipantCount: 2 },
        { id: "large-04", recentParticipantCount: 1, dormantParticipantCount: 1 },
        { id: "large-05", recentParticipantCount: 0, dormantParticipantCount: 0 },
        // Stale/over-inclusive data must not render a completed feature badge.
        { id: "large-01", recentParticipantCount: 3, dormantParticipantCount: 0 },
      ].map(({ id, ...counts }) => ({
        featureKey: featureKey(id),
        participantCount: counts.recentParticipantCount + counts.dormantParticipantCount,
        ...counts,
      }));
      payload.participantCounts = {
        status: "ok", counts: rows, partial: true,
        asOf: "2026-09-24T08:30:00.000Z", recentSeconds: 86400,
      };
    }
    await route.fulfill({ response, json: payload });
  });

  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across`);
    const badges = page.locator(".board-item-participants:visible");
    await expect(badges).toContainText(["Recent 1", "Dormant 2", "Recent 1", "Dormant 1"]);
    const completedBadge = page.getByRole("button", { name: /Open large-01/ }).locator(".board-item-participants").first();
    await expect(page.getByRole("button", { name: /Open large-05/ }).locator(".board-item-participants")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Open large-06/ }).locator(".board-item-participants")).toHaveCount(0);
    await expect(completedBadge).toHaveCount(0);
    await expect(page.locator("#board-participant-status")).toContainText(/partial/i);
    const listScreenshotCard = page.getByRole("button", { name: /Open large-02/ }).first();
    await listScreenshotCard.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("across-participant-badges-list-desktop.png") });
    await page.setViewportSize({ width: 390, height: 840 });
    await listScreenshotCard.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("across-participant-badges-list-390.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    await page.setViewportSize({ width: 1440, height: 900 });
    const initialReads = aggregateReads.length;
    const initialDetailReads = participantReads.length;
    const initialBoardCountReads = boardCountReads.length;
    expect(initialReads).toBeGreaterThan(0);
    await page.locator("#board-focus-in-play").click();
    await expect(page.locator("#board-focus-in-play")).toHaveAttribute("aria-pressed", "true");
    await expect(completedBadge).toHaveText("Recent 3");
    await expect(page.locator(".board-item-participants:visible")).toHaveCount(5);
    await page.locator("#board-focus-in-play").click();
    await expect(page.locator("#board-focus-in-play")).toHaveAttribute("aria-pressed", "false");
    await expect(completedBadge).toHaveCount(0);
    await expect(page.locator(".board-item-participants:visible")).toHaveCount(4);

    for (const layout of ["list", "columns"]) {
      if (layout === "columns") {
        await page.locator("#board-layout-columns").click();
        await expect(page.locator(".board-item-participants:visible")).toHaveCount(4);
        const columnsScreenshotCard = page.getByRole("button", { name: /Open large-02/ }).first();
        await columnsScreenshotCard.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath("across-participant-badges-columns-desktop.png") });
        await page.setViewportSize({ width: 390, height: 840 });
        await columnsScreenshotCard.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath("across-participant-badges-columns-390.png") });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
        await page.setViewportSize({ width: 1440, height: 900 });
      }
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect(page.locator(".board-item-participants:visible")).toHaveCount(4);
      await expect(page.locator("#board-participant-status")).toContainText(/partial/i);
      expect(aggregateReads).toHaveLength(initialReads);
      expect(boardCountReads).toHaveLength(initialBoardCountReads);
      expect(participantReads).toHaveLength(initialDetailReads);

      await page.locator("#spec-mode-button").click();
      await expect(page.locator("#spec-workbench")).toBeVisible();
      await page.locator("#roadmap-mode-button").click();
      await expect(page.locator("#spec-workbench")).toBeHidden();
      await expect(page.locator(".board-item-participants:visible")).toHaveCount(4);
      expect(aggregateReads).toHaveLength(initialReads);
      expect(boardCountReads).toHaveLength(initialBoardCountReads);
      expect(participantReads).toHaveLength(initialDetailReads);
    }

    await page.locator("#board-source-toggle").click();
    await page.locator('#board-source-menu [data-source-choice="this"]').click();
    await expect(page.locator(".board-item-participants:visible")).toHaveCount(0);
    await page.locator("#board-source-toggle").click();
    await page.locator('#board-source-menu [data-source-choice="across"]').click();
    await expect(page.locator(".board-item-participants:visible")).toHaveCount(4);

    recentCount = 2;
    await page.locator("#refresh-button").click();
    const large02Card = page.locator(".board-column-card-main").filter({ hasText: "large-02" }).first();
    await expect(large02Card.locator(".board-item-participants").first()).toHaveText("Recent 2");

    injectCounts = false;
    await page.evaluate((hash) => { window.location.hash = hash; }, `repo=${encodeURIComponent(other.root)}&sources=across`);
    await expect(page.locator("#board-source-toggle")).toContainText("Across worktrees");
    await expect(page.locator("#board-source-status-summary")).toContainText("3 features");
    const otherLarge02Card = page.locator(".board-item:visible, .board-column-card-main:visible").filter({ hasText: "large-02" }).first();
    await expect(otherLarge02Card).toBeVisible();
    await expect(otherLarge02Card.locator(".board-item-participants")).toHaveCount(0);
    await expect(page.locator("#board-participant-status")).not.toContainText(/partial/i);
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    await fs.rm(other.owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
