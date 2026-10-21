import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveRoadmapItemReference } from "../package/minimap/src/pallium.js";

const fixture = JSON.parse(await fs.readFile(new URL("../test/work-record/fixtures/relationships.json", import.meta.url), "utf8"));

test("feature read view shows live related records and keeps failed refresh explicit", async ({ page }, testInfo) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-related-ui-"));
  const tasks = path.join(root, ".agent-workflow", "tasks");
  await fs.mkdir(tasks, { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"), { recursive: true });
  await fs.writeFile(path.join(root, "roadmap", "ideas", ".gitkeep"), "");
  await fs.writeFile(path.join(root, "roadmap", "board.md"), "# Now\n- alpha\n");
  await fs.writeFile(path.join(root, "roadmap", "scope.md"), "# Scope\n");
  await fs.writeFile(path.join(root, "roadmap", "features", "alpha.md"), "---\nid: alpha\ntitle: Alpha\nstatus: queued\npriority: medium\ncommitment: committed\n---\n\n## Summary\n\nAlpha feature.\n");
  await fs.writeFile(path.join(root, "agent-workflow.yaml"), 'version: 1\nworkRecord: {backend: local, local: {taskPath: ".agent-workflow/tasks/{slug}.md"}}\n');
  const git = (...args) => execFileSync("git", args, { cwd: root, windowsHide: true, stdio: "pipe" });
  git("init", "-b", "main"); git("remote", "add", "origin", "https://github.com/rore/minimap.git");
  git("add", "."); git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture");
  const reference = await resolveRoadmapItemReference(root, "roadmap", "alpha");
  const source = { provider: "minimap", scope_ref: reference.scope_ref, local_ref: reference.local_ref };
  const write = (slug, title, state, prs) => fs.writeFile(path.join(tasks, `${slug}.md`), fixture.record_template
    .replace("Fixture Work Record", title).replace("**State:** Ready to implement", `**State:** ${state}`)
    .replace("__RELATIONSHIPS__", `**Relationships:**\n${JSON.stringify({ schema_version: 1, sources: [source], pull_requests: prs })}`));
  await write("first", "First delivery", "Ready to implement", ["https://github.com/rore/minimap/pull/1"]);
  await write("second", "Second delivery", "Blocked", ["https://github.com/rore/minimap/pull/2"]);
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  let firstRequest = true;
  let firstPageReads = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/related-work") && !url.searchParams.has("record")) firstPageReads++;
  });
  await page.route("**/api/items/alpha/related-work**", async (route) => {
    if (firstRequest) { firstRequest = false; await held; }
    await route.continue();
  });
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}&item=alpha&layout=list`);
    await expect(page.locator("#item-preview")).toContainText("Alpha feature.");
    await expect(page.locator("#related-work > summary")).toContainText("Loading");
    await page.screenshot({ path: testInfo.outputPath("related-loading.png") });
    release();
    await expect(page.locator("#related-work > summary")).toContainText("2");
    await expect(page.locator("#related-work > summary")).toContainText("Linked tasks");
    await page.locator("#related-work > summary").click();
    await expect(page.locator("#related-work-content")).toContainText("Saved task records; PR status may have changed.");
    await expect(page.locator(".related-work-details")).not.toHaveAttribute("open", "");
    await page.locator(".related-work-details > summary").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".related-work-details")).toHaveAttribute("open", "");
    await expect(page.locator("#related-work-content")).toContainText("Blocked");
    await expect(page.locator("#related-work-content a").first()).toHaveAttribute("href", "https://github.com/rore/minimap/pull/1");
    await page.locator("[data-related-record]").first().click();
    await expect(page.locator("#related-record-dialog")).toContainText("Ready to implement");
    await expect(page.locator("[data-related-record]").first()).toHaveText("Open task");
    await expect(page.locator("#related-record-content")).toContainText("Expose related work.");
    await expect(page.locator("#related-record-content")).not.toContainText("Relationships");
    await expect(page.locator("#related-record-content")).not.toContainText("agent-workflow:start");
    await page.screenshot({ path: testInfo.outputPath("related-open-record.png") });
    await page.locator("#related-record-close").click();
    await expect(page.locator("#item-preview")).toContainText("Alpha feature.");
    await page.screenshot({ path: testInfo.outputPath("related-return-to-feature.png") });
    let releaseOldRecord;
    let oldRecordStarted;
    const oldRecordHeld = new Promise((resolve) => { releaseOldRecord = resolve; });
    const oldRecordStart = new Promise((resolve) => { oldRecordStarted = resolve; });
    await page.route("**/api/items/alpha/related-work**", async (route) => {
      if (new URL(route.request().url()).searchParams.get("record") === "agent-workflow:first") {
        oldRecordStarted(); await oldRecordHeld;
      }
      await route.continue();
    });
    await page.locator("[data-related-record]").first().click();
    await oldRecordStart;
    await page.locator("#related-record-close").click();
    await page.locator("[data-related-record]").nth(1).click();
    await expect(page.locator("#related-record-dialog")).toContainText("Second delivery");
    const oldResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("record") === "agent-workflow:first");
    releaseOldRecord();
    await (await oldResponse).finished();
    await expect(page.locator("#related-record-dialog")).toContainText("Blocked");
    await expect(page.locator("#related-record-dialog")).not.toContainText("First delivery");
    await page.locator("#related-record-close").click();
    await page.unroute("**/api/items/alpha/related-work**");
    await write("first", "First delivery", "Blocked", ["https://github.com/rore/minimap/pull/3"]);
    await page.locator("[data-related-refresh]").click();
    await expect(page.locator("#related-work-content")).toContainText("PR #3");
    await fs.unlink(path.join(tasks, "second.md"));
    await page.locator("[data-related-refresh]").click();
    await expect(page.locator("#related-work > summary")).toContainText("1");
    await fs.writeFile(path.join(tasks, "bad.md"), "invalid");
    await page.locator("[data-related-refresh]").click();
    await expect(page.locator("#related-work > summary")).toContainText("Last checked earlier");
    await expect(page.locator("#related-work-content")).toContainText("First delivery");
    await expect(page.locator("#related-work-content")).not.toContainText("related_work_partial");
    await page.screenshot({ path: testInfo.outputPath("related-list-desktop.png") });
    await page.setViewportSize({ width: 390, height: 840 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: testInfo.outputPath("related-list-narrow.png") });
    await fs.unlink(path.join(tasks, "bad.md"));
    await fs.writeFile(path.join(tasks, "legacy.md"), fixture.record_template
      .replace("Fixture Work Record", "Older task record").replace("__RELATIONSHIPS__", ""));
    // The server retains its last complete index after a partial scan; exercise the partial response contract directly.
    await page.route("**/api/items/alpha/related-work**", async (route) => {
      const response = await route.fetch();
      const result = await response.json();
      await route.fulfill({ json: { ...result, status: "partial", coverage: { ...result.coverage, legacy: 1 } } });
    });
    await page.locator("[data-related-refresh]").click();
    await expect(page.locator("#related-work > summary")).toContainText("May be incomplete");
    await expect(page.locator("#related-work-content")).toContainText("Some older task records do not declare feature links");
    await expect(page.locator("#related-work-content")).toContainText("First delivery");
    await page.unroute("**/api/items/alpha/related-work**");
    await fs.unlink(path.join(tasks, "legacy.md"));
    const manyPrs = Array.from({ length: 4 }, (_, i) => `https://github.com/rore/minimap/pull/${100 + i}`);
    const mixedPrs = [...manyPrs, ...Array.from({ length: 4 }, (_, i) => `https://github.com/example/other/pull/${200 + i}`)];
    await Promise.all(Array.from({ length: 45 }, (_, i) => write(`bulk-${String(i + 1).padStart(2, "0")}`, `Bulk ${String(i + 1).padStart(2, "0")}`, "Ready to implement", i ? manyPrs : mixedPrs)));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator("[data-related-refresh]").click();
    await expect(page.locator("#related-work > summary")).toContainText("46");
    await expect(page.locator(".related-work-row")).toHaveCount(20);
    await expect(page.locator(".related-work-row").first()).toContainText("Bulk 01");
    await expect(page.locator(".related-work-row").last()).toContainText("Bulk 20");
    await expect(page.locator(".related-work-row").first().locator("a")).toHaveCount(8);
    await expect(page.locator(".related-work-row").first().locator("a:visible")).toHaveCount(2);
    await expect(page.locator(".related-work-row").first()).toContainText("rore/minimap#100");
    await page.locator(".related-work-row").first().locator(".related-pr-more summary").click();
    await expect(page.locator(".related-work-row").first().locator("a:visible")).toHaveCount(8);
    await expect(page.locator(".related-work-row").first()).toContainText("example/other#200");
    const expandedPrFits = () => page.locator(".related-work-row").first().evaluate((row) => {
      const panel = row.closest("#related-work").getBoundingClientRect();
      return [...row.querySelectorAll("a")].every((link) => {
        const rect = link.getBoundingClientRect();
        return rect.left >= panel.left - 1 && rect.right <= panel.right + 1;
      });
    });
    expect(await expandedPrFits()).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("related-many-pr-expanded.png") });
    await page.setViewportSize({ width: 390, height: 840 });
    expect(await expandedPrFits()).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: testInfo.outputPath("related-many-pr-expanded-narrow.png") });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator(".related-work-row").first().locator(".related-pr-more summary").click();
    await page.screenshot({ path: testInfo.outputPath("related-many-first-page.png"), fullPage: true });
    await page.locator("[data-related-more]").click();
    await expect(page.locator(".related-work-row")).toHaveCount(40);
    await expect(page.locator(".related-work-row").last()).toContainText("Bulk 40");
    await page.locator("[data-related-more]").click();
    await expect(page.locator(".related-work-row")).toHaveCount(46);
    await expect(page.locator(".related-work-row").last()).toContainText("First delivery");
    await expect(page.locator("[data-related-more]")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("related-many-all-pages.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 840 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: testInfo.outputPath("related-many-expanded-narrow.png") });
    await page.locator("#related-work > summary").click();
    await expect(page.locator("#related-work")).not.toHaveAttribute("open");
    await page.screenshot({ path: testInfo.outputPath("related-many-collapsed-narrow.png") });
    await page.locator("#related-work > summary").click();
    await expect(page.locator(".related-work-row")).toHaveCount(46);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator("[data-related-record]").first().click();
    await expect(page.locator("#related-record-dialog")).toBeVisible();
    await expect(page.locator("#related-record-close")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("#related-record-dialog")).not.toBeVisible();
    await expect(page.locator(".related-work-row").first().locator("a").first()).toHaveAttribute("target", "_blank");
    await expect(page.locator(".related-work-row").first().locator("a").first()).toHaveAttribute("rel", "noopener noreferrer");
    await Promise.all((await fs.readdir(tasks)).map((name) => fs.unlink(path.join(tasks, name))));
    await page.locator("[data-related-refresh]").click();
    await expect(page.locator("#related-work-content")).toContainText("No task records link to this feature.");
    await page.screenshot({ path: testInfo.outputPath("related-empty.png") });
    await page.route("**/api/items/alpha/related-work**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Temporary failure" } }) }));
    await page.locator("[data-related-refresh]").click();
    await expect(page.locator("#related-work > summary")).toContainText("Unavailable");
    await page.screenshot({ path: testInfo.outputPath("related-error.png") });
    await page.unroute("**/api/items/alpha/related-work**");
    await write("new", "New delivery", "Ready to implement", ["https://github.com/rore/minimap/pull/9"]);
    const cleanFreshResponse = page.waitForResponse((response) => response.url().includes("/api/items/alpha/related-work")
      && new URL(response.url()).searchParams.get("fresh") === "1" && response.ok());
    const readsBeforeGlobalRefresh = firstPageReads;
    await page.locator("#refresh-button").click();
    await cleanFreshResponse;
    expect(firstPageReads).toBe(readsBeforeGlobalRefresh + 1);
    await expect(page.locator("#related-work-content")).toContainText("New delivery");
    await page.locator("#tab-structured").click();
    if (!await page.locator("#field-title").isVisible()) await page.locator("#metadata-toggle").click();
    await page.locator("#field-title").fill("Unsaved feature draft");
    await write("new", "New delivery revised", "Blocked", ["https://github.com/rore/minimap/pull/10"]);
    const freshRequest = page.waitForRequest((request) => request.url().includes("/api/items/alpha/related-work")
      && new URL(request.url()).searchParams.get("fresh") === "1");
    await page.locator("#refresh-button").click();
    await freshRequest;
    await expect(page.locator("#field-title")).toHaveValue("Unsaved feature draft");
    await expect(page.locator("#related-work-content")).toContainText("New delivery revised");
    await expect(page.locator(".related-work-details")).toHaveAttribute("open", "");
  } finally {
    release();
    await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

test("Across combines task versions independently of the selected document and opens each origin", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-related-across-"));
  const root = path.join(owned, "main"), sibling = path.join(owned, "blue");
  const relatedResponses = [];
  page.on("response", async (response) => {
    if (!response.url().includes("related-work")) return;
    const body = await response.json().catch(() => null);
    relatedResponses.push({ url: response.url(), status: response.status(), body });
  });
  const tasks = (repo) => path.join(repo, ".agent-workflow", "tasks");
  await fs.mkdir(tasks(root), { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"), { recursive: true });
  await fs.writeFile(path.join(root, "roadmap", "ideas", ".gitkeep"), "");
  await fs.writeFile(path.join(root, "roadmap", "board.md"), "# Now\n- alpha\n");
  await fs.writeFile(path.join(root, "roadmap", "scope.md"), "# Scope\n");
  await fs.writeFile(path.join(root, "roadmap", "features", "alpha.md"), "---\nid: alpha\ntitle: Alpha\nstatus: queued\npriority: medium\ncommitment: committed\n---\n\n## Summary\n\nAlpha feature.\n");
  await fs.writeFile(path.join(root, "agent-workflow.yaml"), 'version: 1\nworkRecord: {backend: local, local: {taskPath: ".agent-workflow/tasks/{slug}.md"}}\n');
  const git = (repo, ...args) => execFileSync("git", args, { cwd: repo, windowsHide: true, stdio: "pipe" });
  git(root, "init", "-b", "main"); git(root, "remote", "add", "origin", "https://github.com/rore/minimap.git");
  git(root, "add", "."); git(root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture");
  git(root, "worktree", "add", "-b", "blue", sibling);
  await fs.mkdir(tasks(sibling), { recursive: true });
  await fs.writeFile(path.join(sibling, "roadmap", "features", "alpha.md"), "---\nid: alpha\ntitle: Alpha\nstatus: blocked\npriority: medium\ncommitment: committed\n---\n\n## Summary\n\nBlue version.\n");
  git(sibling, "add", "."); git(sibling, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "blue version");
  const reference = await resolveRoadmapItemReference(root, "roadmap", "alpha");
  const source = { provider: "minimap", scope_ref: reference.scope_ref, local_ref: reference.local_ref };
  const write = (repo, title, state, pr) => fs.writeFile(path.join(tasks(repo), "delivery.md"), fixture.record_template
    .replace("Fixture Work Record", title).replace("**State:** Ready to implement", `**State:** ${state}`)
    .replace("__RELATIONSHIPS__", `**Relationships:**\n${JSON.stringify({ schema_version: 1, sources: [source], pull_requests: [pr] })}`));
  await write(root, "Main delivery", "Ready to implement", "https://github.com/rore/minimap/pull/10");
  await write(sibling, "Blue delivery", "Blocked", "https://github.com/rore/minimap/pull/20");
  let releaseBlue;
  const heldBlue = new Promise((resolve) => { releaseBlue = resolve; });
  let blueStarted = false, listReads = 0;
  await page.route("**/api/source/items/alpha/related-work**", async (route) => {
    if (!new URL(route.request().url()).searchParams.has("record")) {
      listReads++;
      const context = JSON.parse(route.request().headers()["x-minimap-source-context"]);
      if (context.git.branchRef === "refs/heads/blue") { blueStarted = true; await heldBlue; }
    }
    await route.continue();
  });
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}&sources=across&item=alpha`);
    await expect(page.locator("#editor-source-label")).toBeVisible();
    await page.locator("#editor-source-label").evaluate((details) => { details.open = true; });
    await expect(page.locator("#editor-source-label [data-editor-source]")).toHaveCount(2);
    await page.locator('#editor-source-label [data-editor-source]').filter({ hasText: "main" }).click();
    await expect.poll(() => blueStarted).toBe(true);
    await expect(page.locator("#related-work > summary")).toContainText("Loading");
    await page.locator("#editor-source-label").evaluate((details) => { details.open = true; });
    await page.locator('#editor-source-label [data-editor-source]').filter({ hasText: "blue" }).click();
    await expect(page.locator("#item-preview")).toContainText("Blue version.");
    expect(listReads).toBe(2);
    releaseBlue();
    await expect(page.locator("#related-work > summary")).toHaveText("Linked tasks (1)");
    await page.locator("#related-work > summary").click();
    await expect(page.locator(".related-work-row")).toHaveCount(1);
    await page.getByText("2 worktree versions", { exact: true }).click();
    await expect(page.locator("#related-work-content")).toContainText("Main delivery");
    await expect(page.locator("#related-work-content")).toContainText("Worktree:");
    await expect(page.locator("#related-work-content")).toContainText("Blue delivery");
    for (const title of ["Main delivery", "Blue delivery"]) {
      await page.locator(".related-work-version").filter({ hasText: title }).getByRole("button", { name: "Open task" }).click();
      await expect(page.locator("#related-record-title")).toHaveText(title);
      await expect(page.locator("#related-record-content")).toContainText("Outcome");
      await page.locator("#related-record-close").click();
    }
    await page.locator(".related-work-details > summary").click();
    await expect(page.locator(".related-work-details")).toHaveAttribute("open", "");
    await page.locator("#editor-source-label").evaluate((details) => { details.open = true; });
    await page.locator('#editor-source-label [data-editor-source]').filter({ hasText: "main" }).click();
    await expect(page.locator("#related-work > summary")).toContainText("1");
    await page.locator("#related-work").evaluate((details) => { details.open = true; });
    await expect(page.locator("#related-work-content")).toContainText("Blue delivery");
    await expect(page.locator("#related-work-content")).toContainText("Main delivery");
    expect(listReads).toBe(2);
    await page.locator("#related-work > summary").click();
    await page.locator("#related-work > summary").click();
    expect(listReads).toBe(2);
    await expect(page.locator("#related-work-content")).toContainText("PR #20");
    await page.locator("#related-work").evaluate((details) => { details.open = true; });
    await page.screenshot({ path: testInfo.outputPath("related-across-conflict-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 840 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: testInfo.outputPath("related-across-conflict-narrow.png"), fullPage: true });
    await expect.poll(() => relatedResponses.some(({ body }) => body?.records?.some((record) => record.title === "Blue delivery"))).toBe(true);
    const selectedResponse = relatedResponses.find(({ body }) => body?.records?.some((record) => record.title === "Blue delivery"))?.body;
    const injected = structuredClone(selectedResponse);
    const newHead = selectedResponse.source.headCommit === "f".repeat(40) ? "e".repeat(40) : "f".repeat(40);
    injected.source.headCommit = newHead;
    injected.records[0].title = "Stale HEAD response";
    await page.unroute("**/api/source/items/alpha/related-work**");
    let release, started;
    const held = new Promise((resolve) => { release = resolve; });
    const reached = new Promise((resolve) => { started = resolve; });
    await page.route("**/api/source/items/alpha/related-work**", async (route) => {
      started();
      await held;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(injected) });
    });
    await page.locator("[data-related-refresh]").click();
    await reached;
    const injectedResponse = page.waitForResponse((response) => response.url().includes("/api/source/items/alpha/related-work"));
    release();
    await (await injectedResponse).finished();
    await expect(page.locator("#related-work-content")).not.toContainText("Stale HEAD response");
    await expect(page.locator("#related-work-content")).toContainText("Blue delivery");
    await page.unroute("**/api/source/items/alpha/related-work**");
  } finally { releaseBlue(); await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
});
