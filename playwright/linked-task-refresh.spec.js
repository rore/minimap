import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveRoadmapItemReference } from "../package/minimap/src/pallium.js";
import { expandWorktreePayload } from "../package/minimap/ui/worktree-payload.js";

const template = JSON.parse(await fs.readFile(new URL("../test/work-record/fixtures/relationships.json", import.meta.url), "utf8")).record_template;
const git = (repo, ...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", windowsHide: true, stdio: "pipe" }).trim();

async function fixture() {
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-linked-interaction-"));
  const root = path.join(owned, "main"), sibling = path.join(owned, "blue");
  await fs.mkdir(path.join(root, "roadmap/features"), { recursive: true });
  await fs.mkdir(path.join(root, "roadmap/ideas"));
  await fs.mkdir(path.join(root, ".agent-workflow/tasks"), { recursive: true });
  await fs.writeFile(path.join(root, "roadmap/ideas/.keep"), "");
  await fs.writeFile(path.join(root, "roadmap/scope.md"), "Generic large-project interaction fixture.\n");
  await fs.writeFile(path.join(root, "agent-workflow.yaml"), 'version: 1\nworkRecord: {backend: local, local: {taskPath: ".agent-workflow/tasks/{slug}.md"}}\n');
  const ids = Array.from({ length: 64 }, (_, index) => `sample-${String(index + 1).padStart(2, "0")}`);
  await fs.writeFile(path.join(root, "roadmap/board.md"), Array.from({ length: 8 }, (_, lane) =>
    `# Lane ${lane + 1} · a long release workstream\n${ids.filter((_, index) => index % 8 === lane).map((id) => `- ${id}`).join("\n")}\n`).join("\n"));
  await Promise.all(ids.map((id, index) => fs.writeFile(path.join(root, "roadmap/features", `${id}.md`),
    `---\nid: ${id}\ntitle: ${id} · a long feature title for a full planning board\nstatus: queued\npriority: high\ncommitment: committed\nmilestone: Milestone ${index % 12 + 1} · extended planning horizon\n---\n\n## Summary\n\nReadable feature description for ${id}.\n`)));
  git(root, "init", "-b", "main");
  git(root, "remote", "add", "origin", "https://github.com/example/planning.git");
  git(root, "add", ".");
  git(root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "generic board");
  git(root, "worktree", "add", "-b", "feature/blue-with-a-long-descriptive-branch", sibling);
  const references = await Promise.all(ids.slice(0, 2).map((id) => resolveRoadmapItemReference(root, "roadmap", id)));
  const sources = references.map(({ scope_ref, local_ref }) => ({ provider: "minimap", scope_ref, local_ref }));
  const prs = Array.from({ length: 4 }, (_, index) => `https://github.com/example/planning/pull/${index + 1}`);
  for (const repo of [root, sibling]) {
    await fs.mkdir(path.join(repo, ".agent-workflow/tasks"), { recursive: true });
    await Promise.all(Array.from({ length: 24 }, (_, index) => {
      const title = index === 1 && repo === sibling ? "Different saved delivery title" : `Delivery ${String(index + 1).padStart(2, "0")}`;
      return fs.writeFile(path.join(repo, ".agent-workflow/tasks", `delivery-${String(index + 1).padStart(2, "0")}.md`), template
        .replace("Fixture Work Record", title)
        .replace("**State:** Ready to implement", `**State:** ${repo === root ? "Ready to implement" : "Blocked"}`)
        .replace("__RELATIONSHIPS__", `**Relationships:**\n${JSON.stringify({ schema_version: 1, sources, pull_requests: prs })}`));
    }));
  }
  return { owned, root, sibling };
}

test("linked task controls survive title convergence, peer transitions and source reorder", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const { owned, root, sibling } = await fixture();
  const peerPath = path.join(sibling, ".agent-workflow/tasks/delivery-01.md");
  const peer = await fs.readFile(peerPath, "utf8");
  let reorder = false, held = false, started = 0, release = () => {};
  let workspaceStarted = 0, releaseWorkspace = () => {};
  try {
    await fs.unlink(peerPath);
    await page.route("**/api/source/items/sample-01/related-work**", async (route) => {
      if (new URL(route.request().url()).searchParams.has("record")) return route.continue();
      const response = await route.fetch(), result = await response.json();
      if (held) { started++; await new Promise((resolve) => { const previous = release; release = () => { previous(); resolve(); }; }); }
      await route.fulfill({ response, json: result });
    });
    await page.route("**/api/worktree-workspace**", async (route) => {
      const response = await route.fetch(), result = expandWorktreePayload(await response.json());
      if (reorder) {
        for (const feature of result.features) feature.versions.reverse();
        for (const group of result.groups) for (const row of group.items) row.versions.reverse();
        workspaceStarted++; await new Promise((resolve) => { releaseWorkspace = resolve; });
      }
      await route.fulfill({ response, json: result });
    });
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across&item=sample-01&layout=list`);
    await expect(page.locator("#related-work > summary")).toHaveText("Linked tasks (21+)");
    await page.locator("#related-work > summary").click();
    const first = page.locator(".related-work-row").filter({ hasText: "Delivery 01" });
    const second = page.locator(".related-work-row").filter({ hasText: "Delivery 02" });
    await second.getByText("2 worktree versions", { exact: true }).click();
    const main = first.locator(".related-work-version").filter({ hasText: "Worktree: main" });
    const blue = second.locator(".related-work-version").filter({ hasText: "Worktree: feature/blue" });
    await main.locator(".related-pr-more > summary").click();
    await blue.locator(".related-pr-more > summary").click();
    const mainOpen = main.locator("[data-related-record]"), blueOpen = blue.locator("[data-related-record]");
    await expect(first.locator(".related-work-version")).toHaveCount(1);
    await mainOpen.evaluate((node) => { window.__mainOpen = node; });
    await blueOpen.evaluate((node) => { window.__blueOpen = node; });
    const refresh = async (button, board = false) => {
      started = 0; held = true;
      await page.locator(board ? "#refresh-button" : "[data-related-refresh]").click();
      if (board) {
        await expect.poll(() => workspaceStarted).toBe(1);
        await button.focus(); releaseWorkspace();
      }
      await expect.poll(() => started).toBe(2);
      await button.focus(); held = false; release(); release = () => {};
      await expect(page.locator("[data-related-refresh]")).toBeEnabled();
      await expect(button).toBeFocused();
      expect(await mainOpen.evaluate((node) => node === window.__mainOpen)).toBe(true);
      expect(await blueOpen.evaluate((node) => node === window.__blueOpen)).toBe(true);
      await expect(main.locator(".related-pr-more")).toHaveAttribute("open", "");
      await expect(blue.locator(".related-pr-more")).toHaveAttribute("open", "");
    };
    const titlePath = path.join(sibling, ".agent-workflow/tasks/delivery-02.md");
    await fs.writeFile(titlePath, (await fs.readFile(titlePath, "utf8")).replace("Different saved delivery title", "Delivery 02"));
    await refresh(blueOpen);
    await expect(blue.locator(".related-work-version-title")).toHaveCount(0);
    await fs.writeFile(peerPath, peer); await refresh(mainOpen);
    await expect(first.locator(".related-work-version")).toHaveCount(2);
    await fs.unlink(peerPath); await refresh(mainOpen);
    await expect(first.locator(".related-work-version")).toHaveCount(1);
    await expect(mainOpen).toBeVisible();
    reorder = true; await refresh(mainOpen, true);
    await expect(second.locator(".related-work-version").first()).toContainText("Worktree: feature/blue");
    await page.screenshot({ path: testInfo.outputPath("linked-single-and-reordered.png") });
    await blueOpen.press("Enter");
    await expect(page.locator("#related-record-title")).toHaveText("Delivery 02");
    await expect(page.locator("#related-record-meta")).toContainText("Blocked");
  } finally {
    held = false; release(); releaseWorkspace(); await page.goto("about:blank").catch(() => {});
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("dense linked tasks retain disclosures, focus, scroll and the physical Open click through refresh", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const { owned, root } = await fixture();
  const host = page.locator("#related-work-content");
  const row = page.locator(".related-work-row").filter({ hasText: "Delivery 01" });
  let release = () => {}, releaseFailure = () => {}, releaseLate = () => {}, started = 0, held = false;
  const opened = [];
  page.on("request", (request) => {
    if (new URL(request.url()).searchParams.has("record")) opened.push(request);
  });
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across&item=sample-01&layout=list`);
    await expect(page.locator("#board-source-status-details")).toContainText("2 worktrees loaded");
    await expect(page.locator("#related-work > summary")).toHaveText("Linked tasks (20+)");
    await page.locator("#related-work > summary").click();
    await row.getByText("2 worktree versions", { exact: true }).click();
    await row.locator(".related-work-version").first().locator(".related-pr-more > summary").click();
    await host.locator(".related-work-details > summary").click();
    const gate = new Promise((resolve) => { release = resolve; });
    await page.route("**/api/source/items/sample-01/related-work**", async (route) => {
      if (held && !new URL(route.request().url()).searchParams.has("record")) { started++; await gate; }
      await route.continue();
    });
    held = true;
    await page.locator("[data-related-refresh]").click();
    await expect.poll(() => started).toBe(2);
    await expect(row.locator("details").first()).toHaveAttribute("open", "");
    await expect(row.locator(".related-pr-more").first()).toHaveAttribute("open", "");
    await expect(host.locator(".related-work-details")).toHaveAttribute("open", "");
    const button = row.locator("[data-related-record]").first();
    await button.scrollIntoViewIfNeeded();
    await button.focus();
    const before = await button.evaluate((node) => {
      const scroll = [];
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        if (parent.scrollHeight > parent.clientHeight) scroll.push([parent.id || parent.className, parent.scrollTop]);
      }
      window.__linkedPointerTarget = node;
      return { scroll, top: node.getBoundingClientRect().top };
    });
    const box = await button.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    held = false; release();
    await expect(page.locator("#related-work > summary")).toHaveText("Linked tasks (20+)");
    await expect(page.locator("[data-related-refresh]")).toBeEnabled();
    expect(await button.evaluate((node) => node === window.__linkedPointerTarget)).toBe(true);
    await expect(button).toBeFocused();
    expect(await button.evaluate((node) => node.getBoundingClientRect().top)).toBeCloseTo(before.top, 0);
    const afterScroll = await button.evaluate((node) => {
      const scroll = [];
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        if (parent.scrollHeight > parent.clientHeight) scroll.push([parent.id || parent.className, parent.scrollTop]);
      }
      return scroll;
    });
    expect(afterScroll).toEqual(before.scroll);
    await page.mouse.up();
    await expect(page.locator("#related-record-content")).toContainText("Expose related work.");
    await expect(page.locator("#related-record-title")).toHaveText("Delivery 01");
    expect(opened).toHaveLength(1);
    expect(JSON.parse(opened[0].headers()["x-minimap-source-context"]).git.branchRef).toBe("refs/heads/main");
    await page.locator("#related-record-close").click();
    await expect(row.locator("strong").filter({ hasText: /^Delivery 01$/ })).toHaveCount(1);
    const differing = page.locator(".related-work-row").filter({ hasText: "Delivery 02" });
    await differing.getByText("2 worktree versions", { exact: true }).click();
    await expect(differing).toContainText("Different saved delivery title");
    await page.locator("#editor-source-summary").click();
    await page.locator("[data-editor-source]").filter({ hasText: "feature/blue-with-a-long-descriptive-branch" }).click();
    await expect(row.locator("details").first()).toHaveAttribute("open", "");
    await expect(row.locator(".related-pr-more").first()).toHaveAttribute("open", "");
    for (const layout of ["list", "columns"]) {
      const tab = page.locator(`#board-layout-${layout}`);
      if (await tab.getAttribute("aria-selected") !== "true") await tab.click();
      if (layout === "columns") {
        await page.getByRole("button", { name: "Open sample-01 · a long feature title for a full planning board", exact: true }).click();
        await expect(page.locator("#item-preview")).toBeVisible();
        await expect(page.locator("#related-work > summary")).toHaveText("Linked tasks (20+)");
        await page.locator("#related-work > summary").click();
        await row.getByText("2 worktree versions", { exact: true }).click();
        await row.locator(".related-pr-more > summary").first().click();
        await host.locator(".related-work-details > summary").click();
        await differing.getByText("2 worktree versions", { exact: true }).click();
      }
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 840 : 960 });
        await row.scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
        await page.screenshot({ path: testInfo.outputPath(`linked-${layout}-${width}.png`) });
      }
      await page.setViewportSize({ width: 1440, height: 960 });
    }
    const failureGate = new Promise((resolve) => { releaseFailure = resolve; });
    let failuresStarted = 0;
    const failedRefresh = async (route) => {
      if (new URL(route.request().url()).searchParams.has("record")) return route.continue();
      failuresStarted++; await failureGate;
      await route.fulfill({ status: 503, json: { error: { message: "Temporary task lookup failure" } } });
    };
    await page.route("**/api/source/items/sample-01/related-work**", failedRefresh);
    await page.locator("[data-related-refresh]").click();
    await expect.poll(() => failuresStarted).toBe(2);
    await button.scrollIntoViewIfNeeded();
    await button.focus();
    releaseFailure();
    await expect(page.locator("#related-work > summary")).toContainText("Last checked earlier");
    await expect(button).toBeFocused();
    await expect(row.locator("details").first()).toHaveAttribute("open", "");
    await expect(row.locator(".related-pr-more").first()).toHaveAttribute("open", "");
    await expect(host.locator(".related-work-details")).toHaveAttribute("open", "");
    await page.screenshot({ path: testInfo.outputPath("linked-stale-desktop.png") });
    await page.unroute("**/api/source/items/sample-01/related-work**", failedRefresh);
    await page.locator("[data-related-refresh]").click();
    await expect(page.locator("#related-work > summary")).toHaveText("Linked tasks (20+)");
    await fs.appendFile(path.join(root, ".agent-workflow/tasks/delivery-01.md"), "\nChanged body with unchanged title and state.\n");
    await row.locator("[data-related-record]").first().click();
    await expect(page.locator("#related-record-content")).toContainText("Could not open record");
    await expect(page.locator("#related-record-content")).not.toContainText("Changed body with unchanged title");
    await page.locator("#related-record-close").click();
    let lateStarted = 0, lateFinished = 0;
    const lateGate = new Promise((resolve) => { releaseLate = resolve; });
    await page.route("**/api/source/items/sample-01/related-work**", async (route) => {
      if (new URL(route.request().url()).searchParams.has("record")) return route.continue();
      const response = await route.fetch();
      const result = await response.json();
      lateStarted++; await lateGate;
      if (result.records?.length) result.records[0].title = "Obsolete feature response";
      await route.fulfill({ response, json: result }).catch(() => {});
      lateFinished++;
    });
    await page.locator("[data-related-refresh]").click();
    await expect.poll(() => lateStarted).toBe(2);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Open sample-02 · a long feature title for a full planning board", exact: true }).click();
    releaseLate();
    await expect.poll(() => lateFinished).toBe(2);
    await expect(page.locator("#editor-title")).toContainText("sample-02");
    await expect(page.locator("#related-work > summary")).toHaveText("Linked tasks (20+)");
    await expect(host).not.toContainText("Obsolete feature response");
    await expect(page.locator("#related-work")).not.toHaveAttribute("open");
    await page.locator("#related-work > summary").click();
    await expect(host.locator(".related-work-details")).not.toHaveAttribute("open");
    await expect(row.locator("details").first()).not.toHaveAttribute("open");
  } finally {
    held = false; release(); releaseFailure(); releaseLate();
    await page.mouse.up().catch(() => {});
    await page.goto("about:blank").catch(() => {});
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
