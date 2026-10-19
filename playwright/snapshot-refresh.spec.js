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

async function fixture(page, mode, layout, beforeOpen, { waitForBoard = true, openItem = false } = {}) {
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
  let recent = 1, dormant = 0, fail = false, observations = 0, reads = 0;
  const requests = [];
  const counts = () => ({ status: "ok", counts: [{ [mode === "across" ? "featureKey" : "itemId"]: mode === "across" ? payload.features[0].key : "alpha", participantCount: recent + dormant, recentParticipantCount: recent, dormantParticipantCount: dormant }], partial: false, asOf: new Date().toISOString(), recentSeconds: 86400, includeCompleted: true });
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
  await page.goto(`/#repo=${encodeURIComponent(root)}&sources=${mode}&layout=${layout}${openItem ? "&item=alpha" : ""}`);
  if (waitForBoard) await expect(page.locator("#board-groups")).toContainText("Alpha");
  return { root, payload, setRecent: (value) => { recent = value; }, setRecency: (nextRecent, nextDormant) => { recent = nextRecent; dormant = nextDormant; }, fail: () => { fail = true; }, observations: () => observations, reads: () => reads, requests,
    setSpec: () => {
      const link = { sessionId: "fixture-session", targetFile: path.join(root, "roadmap", "features", "alpha.md"), openComments: 2, pendingSuggestions: 1 };
      if (mode === "across") for (const version of payload.features[0].versions) version.summary.specSession = link;
      else payload.specSessionsByItemId = { alpha: link };
    },
    expire: () => { payload.snapshot = { ...payload.snapshot, stale: true, validatedAt: new Date(Date.now() - 31_000).toISOString() }; } };
}

function detailParticipantPayload(alias) {
  return {
    status: "ok",
    reference: { scope_ref: "roadmap:v1:fixture", local_ref: "item:v1:alpha" },
    partial: false,
    participants: [{
      alias, title: alias, runtime: "codex", lifecycle: "recent", state: "active", destination_health: "active",
      container_ref: "container:fixture",
      session_ref: `relay-session-${alias.toLowerCase().replaceAll(" ", "-")}`,
      session_url: "http://127.0.0.1:19836/dashboard#relay?session=relay-session-00000000000000000000000000000000",
      last_seen_at: new Date().toISOString(), association: { origins: ["fixture"], updated_at: new Date().toISOString() },
    }],
  };
}

test.afterEach(async () => {
  for (const release of releases.splice(0)) release();
  for (const root of owned.splice(0)) {
    expect(path.dirname(root)).toBe(os.tmpdir());
    expect(path.basename(root)).toMatch(/^minimap-snapshot-ui-/);
    await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

async function expectHeaderFits(page) {
  const boxes = await page.locator("#board-panel").evaluate((board) => {
    const rect = (selector) => board.querySelector(selector).getBoundingClientRect().toJSON();
    return { header: rect(".panel-header"), title: rect("h2"), status: rect("#board-source-status-summary"), controls: rect("#board-controls") };
  });
  for (const content of [boxes.title, boxes.status]) {
    expect(content.top).toBeGreaterThanOrEqual(boxes.header.top);
    expect(content.bottom).toBeLessThanOrEqual(boxes.header.bottom);
    expect(content.left).toBeGreaterThanOrEqual(boxes.header.left);
    expect(content.right).toBeLessThanOrEqual(boxes.header.right);
  }
  expect(boxes.header.bottom).toBeLessThanOrEqual(boxes.controls.top + 1);
}

for (const mode of ["this", "across"]) for (const layout of ["list", "columns"]) {
  test(`${mode} ${layout} Done badges use the existing green palette without coloring mixed statuses`, async ({ page }, testInfo) => {
    let sibling;
    const data = await fixture(page, mode, layout, async ({ root, payload }) => {
      const file = path.join(root, "roadmap", "features", "alpha.md");
      await fs.writeFile(file, (await fs.readFile(file, "utf8")).replace("status: queued", "status: done"));
      Object.assign(payload, mode === "across" ? await loadWorktreeAggregate(root) : await loadWorkspace(root));
      if (mode === "across") {
        sibling = structuredClone(payload.features[0].versions[0]);
        sibling.sourceKey += "-done";
        sibling.sourceContext.sourceKey = sibling.sourceKey;
        sibling.sourceContext.git.branchRef = "refs/heads/feat/done-copy";
        payload.features[0].versions.push(sibling);
        payload.groups[0].items[0].versions.push(sibling);
      }
    });
    const card = page.locator(layout === "list" ? ".board-item" : ".board-column-card").first();
    const badge = card.locator(".recorded-status:visible");
    await expect(badge).toHaveText("Done");
    await expect(badge).toHaveClass(/badge-tone-status-done/);
    await expect(badge).toHaveCSS("color", "rgb(21, 121, 90)");
    await page.screenshot({ path: testInfo.outputPath(`${mode}-${layout}-done-desktop.png`) });
    await page.setViewportSize({ width: 390, height: 840 });
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${mode}-${layout}-done-narrow.png`) });
    await page.getByRole("button", { name: "Open Alpha", exact: true }).first().click();
    const detailBadge = page.locator("#item-preview .recorded-status:visible");
    await expect(detailBadge).toHaveText("Done");
    await expect(detailBadge).toHaveClass(/badge-tone-status-done/);
    await expect(detailBadge).toHaveCSS("color", "rgb(21, 121, 90)");
    await detailBadge.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${mode}-${layout}-done-detail-narrow.png`) });
    await page.setViewportSize({ width: 1280, height: 900 });
    await detailBadge.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${mode}-${layout}-done-detail-desktop.png`) });
    if (mode === "across") {
      sibling.summary.status = "queued";
      if (sibling.summary.metadata) sibling.summary.metadata.status = "queued";
      if (await page.locator("#editor-overlay").isVisible()) await page.keyboard.press("Escape");
      await page.locator("#refresh-button").click();
      await expect(badge).toHaveText("Statuses differ");
      await expect(badge).toHaveClass(/badge-tone-neutral/);
      await page.getByRole("button", { name: "Open Alpha", exact: true }).first().click();
      await expect(detailBadge).toHaveClass(/badge-tone-neutral/);
      await expect(badge).toHaveCSS("color", "rgb(108, 115, 133)");
      await page.screenshot({ path: testInfo.outputPath(`${mode}-${layout}-mixed-neutral.png`) });
      await page.evaluate(() => {
        const params = new URLSearchParams(location.hash.slice(1));
        params.set("f", "status:done");
        location.hash = params.toString();
      });
      await expect(badge).toHaveText("Done");
      await expect(badge).toHaveClass(/badge-tone-status-done/);
      await expect(detailBadge).toHaveClass(/badge-tone-status-done/);
      sibling.summary.status = null;
      if (sibling.summary.metadata) sibling.summary.metadata.status = null;
      await page.evaluate(() => {
        const params = new URLSearchParams(location.hash.slice(1));
        params.delete("f");
        location.hash = params.toString();
      });
      if (await page.locator("#editor-overlay").isVisible()) await page.keyboard.press("Escape");
      await page.locator("#refresh-button").click();
      await expect(badge).toHaveText("Statuses differ");
      await expect(badge).toHaveClass(/badge-tone-neutral/);
      await page.getByRole("button", { name: "Open Alpha", exact: true }).first().click();
      await expect(detailBadge).toHaveClass(/badge-tone-neutral/);
      expect(data.payload.features[0].versions[0].summary.status).toBe("done");
    }
  });
}

for (const layout of ["list", "columns"]) {
  test(`${layout} represented activity, wrapped coverage and session recency remain source-specific`, async ({ page }, testInfo) => {
    const hold = responseHold();
    let lifecycle = "recent";
    const data = await fixture(page, "across", layout, async ({ payload }) => {
      const feature = payload.features[0];
      const base = feature.versions[0];
      for (const status of ["active", "blocked"]) {
        const sibling = structuredClone(base);
        sibling.sourceKey += `-${status}`;
        sibling.sourceContext.sourceKey = sibling.sourceKey;
        sibling.sourceContext.git.branchRef = `refs/heads/feat/${status}-delivery`;
        sibling.summary.status = status;
        if (sibling.summary.metadata) sibling.summary.metadata.status = status;
        feature.versions.push(sibling);
        payload.groups[0].items[0].versions.push(sibling);
      }
      const opened = structuredClone(payload);
      opened.features[0].versions = [opened.features[0].versions[0]];
      opened.groups[0].items[0].versions = [opened.groups[0].items[0].versions[0]];
      opened.provisional = true;
      opened.partial = true;
      opened.coverage = { ...opened.coverage, pending: true };
      await page.route("**/api/worktree-workspace**", async (route) => {
        if (new URL(route.request().url()).searchParams.has("openedOnly")) return route.fulfill({ json: opened });
        await hold.pending;
        await route.fulfill({ json: payload });
      });
      await page.route(/\/api\/source\/items\/alpha\/participants(?:\?|$)/, async (route) => {
        const result = detailParticipantPayload("Associated Session");
        result.participants[0].lifecycle = lifecycle;
        if (lifecycle === "dormant") result.participants[0].last_seen_at = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
        await route.fulfill({ json: result });
      });
    });
    await expect(page.locator("#board-source-status-summary")).toContainText("Loading worktrees");
    await expectHeaderFits(page);
    await expect(page.locator("#board-source-status-summary .coverage-partial")).toHaveText(["Current worktree only", "Loading worktrees…"]);
    await page.screenshot({ path: testInfo.outputPath(`${layout}-loading-header-desktop.png`) });
    await page.setViewportSize({ width: 390, height: 840 });
    await expectHeaderFits(page);
    await page.screenshot({ path: testInfo.outputPath(`${layout}-loading-header-narrow.png`) });
    hold.release();
    await expect(page.locator("#board-source-status-summary")).not.toContainText("Loading worktrees");
    await expect(page.locator("#workspace-summary")).toHaveText("1 feature · 1 appearance · 1 group");
    await expect(page.locator("#board-source-status-summary")).toHaveText("1 feature");
    await page.setViewportSize({ width: 1280, height: 900 });
    const card = page.locator(layout === "list" ? ".board-item" : ".board-column-card").first();
    await expect(card.locator(".recorded-status:visible")).toHaveText("Active · Blocked");
    await expect(card.locator(".board-source-badge:visible")).toContainText(["3 worktrees · Statuses differ"]);
    await expect(card).toHaveClass(/board-card-status-blocked/);
    await expect(card.locator(".badge-field-status:visible")).toHaveCount(0);
    await expect(card.locator(".board-item-participants:visible")).toHaveText("1 linked session");
    await expect(card.locator(".board-item-participants:visible")).not.toContainText(/recent|dormant|24h/i);
    await page.screenshot({ path: testInfo.outputPath(`${layout}-version-activity-desktop.png`) });
    await page.setViewportSize({ width: 390, height: 840 });
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${layout}-version-activity-narrow.png`) });
    await page.getByRole("button", { name: "Open Alpha", exact: true }).first().click();
    await expect(page.locator("#item-preview .recorded-status")).toHaveText("Active · Blocked");
    await expect(page.locator("#editor-source-summary")).toContainText("Statuses differ");
    await expect(page.locator("#item-preview .preview-meta")).toBeVisible();
    await expect(page.locator("#item-preview .badge-field-status")).not.toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator("#item-preview .recorded-status").scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${layout}-compact-detail-desktop.png`) });
    await page.setViewportSize({ width: 390, height: 840 });
    await page.locator("#item-preview .recorded-status").scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${layout}-compact-detail-narrow.png`) });
    await page.locator(".preview-selected-version > summary").click();
    await expect(page.locator("#item-preview .badge-field-status")).toHaveText("queued");
    await expect(page.locator("#item-preview .badge-field-status")).toBeVisible();
    await expect(page.locator("#item-participants-status")).toContainText("1 linked session");
    await expect(page.locator(".item-participants-hint")).toHaveCount(0);
    lifecycle = "dormant";
    await page.locator("#item-participants > summary").click();
    await page.locator("#item-participants-refresh").click();
    await expect(page.locator("#item-participants-status")).toContainText("1 linked session");
    await expect(page.locator(".item-participant")).toHaveCount(1);
    await expect(page.locator(".item-participant-freshness")).not.toBeVisible();
    await page.locator(".item-participant-details > summary").click();
    await expect(page.locator(".item-participant-details")).toContainText("Lifecycle: dormant");
    await expect(page.locator(".item-participant-freshness")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${layout}-plain-session-details-narrow.png`) });
    if (await page.locator("#editor-overlay").isVisible()) await page.keyboard.press("Escape");
    data.setRecency(0, 1);
    await page.evaluate(() => window.__refreshTicks.forEach((tick) => tick()));
    await expect(card.locator(".board-item-participants:visible")).toHaveText("1 linked session");
    await page.evaluate(() => {
      const params = new URLSearchParams(location.hash.slice(1));
      params.set("f", "status:queued");
      location.hash = params.toString();
    });
    await expect(page.locator("#board-groups .recorded-status:visible")).toHaveText("Queued");
    await expect(page.locator("#board-groups .board-source-badge:visible")).not.toContainText(["Statuses differ"]);
  });

  test(`${layout} failed full coverage settles and can recover without a stuck loading label`, async ({ page }) => {
    const hold = responseHold();
    let failFull = true;
    await fixture(page, "across", layout, async ({ payload }) => {
      const opened = structuredClone(payload);
      opened.provisional = true;
      opened.partial = true;
      await page.route("**/api/worktree-workspace**", async (route) => {
        if (new URL(route.request().url()).searchParams.has("openedOnly")) return route.fulfill({ json: opened });
        await hold.pending;
        await route.fulfill(failFull ? { status: 503, json: { error: { message: "Full coverage unavailable" } } } : { json: payload });
      });
    });
    await expect(page.locator("#board-source-status-summary")).toContainText("Loading worktrees");
    hold.release();
    await expect(page.locator("#board-source-status-summary")).not.toContainText("Loading worktrees");
    await page.locator("#board-source-status-summary").click();
    await expect(page.locator("#board-source-status-details")).toContainText("could not be loaded");
    failFull = false;
    await page.locator("#refresh-button").click();
    await expect(page.locator("#board-source-status-summary")).not.toContainText("Current worktree only");
    await expect(page.locator("#board-source-status-summary")).not.toContainText("Loading worktrees");
  });
}

test("finished representative with an active shown sibling retains its linked-session count", async ({ page }) => {
  await fixture(page, "across", "list", async ({ payload }) => {
    const feature = payload.features[0];
    const base = feature.versions[0];
    base.summary.status = "done";
    if (base.summary.metadata) base.summary.metadata.status = "done";
    const sibling = structuredClone(base);
    sibling.sourceKey += "-active";
    sibling.sourceContext.sourceKey = sibling.sourceKey;
    sibling.summary.status = "in-progress";
    if (sibling.summary.metadata) sibling.summary.metadata.status = "in-progress";
    feature.versions.push(sibling);
    payload.groups[0].items[0].versions.push(sibling);
  });
  const card = page.locator(".board-item").first();
  await expect(card.locator(".recorded-status:visible")).toHaveText("Active");
  await expect(card.locator(".board-item-participants:visible")).toHaveText("1 linked session");
  await expect(card.locator(".board-source-badge:visible")).toContainText(["Statuses differ"]);
});

for (const layout of ["list", "columns"]) {
  test(`${layout} collapsed task header keeps known totals and status through pagination`, async ({ page }, testInfo) => {
    const held = responseHold();
    let first = true;
    const record = (id) => ({ id: `agent-workflow:${id}`, title: `Delivery ${id}`, recordedState: "Ready for review", pullRequests: [] });
    let result = { status: "partial", records: [record(1)], total: 42, nextOffset: 20, generation: "count-generation", coverage: { legacy: 1 } };
    await fixture(page, "this", layout, async () => {
      await page.route(/\/api\/items\/alpha\/related-work(?:\?|$)/, async (route) => {
        if (first) { first = false; await held.pending; }
        const offset = new URL(route.request().url()).searchParams.get("offset");
        await route.fulfill({ json: offset ? { ...result, records: [record(2)], nextOffset: null } : result });
      });
    }, { openItem: true });
    const section = page.locator("#related-work");
    const summary = section.locator(":scope > summary");
    await expect(summary).toHaveText("Linked tasks · Loading");
    held.release();
    await expect(summary).toHaveText("Linked tasks (42) · May be incomplete");
    await expect(section).not.toHaveAttribute("open");
    await summary.click();
    await page.locator("[data-related-more]").click();
    await expect(page.locator(".related-work-row")).toHaveCount(2);
    await expect(summary).toContainText("(42)");
    result = { ...result, status: "stale", records: [record(1), record(2)], nextOffset: null };
    await page.locator("[data-related-refresh]").click();
    await expect(summary).toHaveText("Linked tasks (42) · Last checked earlier");
    await summary.click();
    await page.screenshot({ path: testInfo.outputPath(`${layout}-task-count-desktop.png`) });
    await page.setViewportSize({ width: 390, height: 840 });
    await summary.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${layout}-task-count-narrow.png`) });
    await summary.click();
    result = { status: "ok", records: [], total: 0, nextOffset: null, generation: "empty-generation" };
    await page.locator("[data-related-refresh]").click();
    await expect(summary).toHaveText("Linked tasks (0)");
    result = { status: "unavailable", records: [], total: 0 };
    await page.locator("[data-related-refresh]").click();
    await expect(summary).toHaveText("Linked tasks · Unavailable");
  });

  test(`${layout} keyboard search preserves spaces and caret while route and Clear still update`, async ({ page }, testInfo) => {
    await fixture(page, "this", layout);
    const search = page.locator("#board-search");
    await search.pressSequentially("Generic");
    await search.press("Space");
    await expect(search).toHaveValue("Generic ");
    await search.press("Space");
    await expect(search).toHaveValue("Generic  ");
    await search.press("Backspace");
    await search.pressSequentially("feature");
    await expect(search).toHaveValue("Generic feature");
    await expect(page.locator("#board-groups")).toContainText("Alpha");
    await search.evaluate((input) => input.setSelectionRange(7, 7));
    await search.press("Space");
    await expect(search).toHaveValue("Generic  feature");
    expect(await search.evaluate((input) => input.selectionStart)).toBe(8);
    await search.press("Backspace");
    await expect(search).toHaveValue("Generic feature");
    expect(await search.evaluate((input) => input.selectionStart)).toBe(7);
    await expect(page.locator("#board-groups")).toContainText("Alpha");
    await expect(page).toHaveURL(/q=generic(?:%20|\+)feature/);
    await page.screenshot({ path: testInfo.outputPath(`${layout}-multiword-search-desktop.png`) });
    await page.setViewportSize({ width: 390, height: 840 });
    await search.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${layout}-multiword-search-narrow.png`) });
    await page.locator("#board-clear-filters").click();
    await expect(search).toHaveValue("");
    await search.pressSequentially("Generic ");
    await page.evaluate(() => {
      const params = new URLSearchParams(location.hash.slice(1));
      params.set("q", "alpha");
      location.hash = params.toString();
    });
    await expect(search).toHaveValue("alpha");
    await expect(page.locator("#board-groups")).toContainText("Alpha");
  });
}

for (const mode of ["this", "across"]) for (const layout of ["list", "columns"]) {
  test(`${mode} ${layout} reuses feature-detail reads through reopen and short hide-resume, then refreshes at expiry`, async ({ page }, testInfo) => {
    const heldParticipantRead = responseHold();
    let participantReads = 0, relatedReads = 0, holdNextParticipant = false, participantHeld = false;
    const data = await fixture(page, mode, layout, async ({ payload }) => {
      const selected = mode === "across" ? payload.sources[0] : null;
      const relatedSource = selected ? {
        repoRoot: selected.repoRoot, sourceKey: selected.sourceKey, headCommit: selected.git.headCommit,
      } : undefined;
      await page.route(/\/api\/(?:source\/)?items\/alpha\/participants(?:\?|$)/, async (route) => {
        participantReads++;
        if (holdNextParticipant) {
          holdNextParticipant = false;
          participantHeld = true;
          await heldParticipantRead.pending;
        }
        await route.fulfill({ json: detailParticipantPayload(participantHeld ? "Fresh Session" : "Old Session") });
      });
      await page.route(/\/api\/(?:source\/)?items\/alpha\/related-work(?:\?|$)/, async (route) => {
        relatedReads++;
        await route.fulfill({ json: {
          status: "ok", records: [{ id: "agent-workflow:delivery", title: "Clarify feature task records", recordedState: "Ready for review", pullRequests: ["https://github.com/example/project/pull/12"] }], total: 1, generation: "detail-generation", nextOffset: null,
          source: relatedSource,
        } });
      });
    }, { openItem: true });

    await expect(page.locator("#item-preview")).toContainText("Generic feature.");
    await expect.poll(() => participantReads).toBe(1);
    await expect.poll(() => relatedReads).toBe(1);
    await expect(page.locator("#item-participants-list")).toContainText("Old Session");
    await expect(page.locator("#related-work > summary")).toContainText("Linked tasks");
    await page.locator("#related-work > summary").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#related-work")).toHaveAttribute("open", "");
    const itemButton = page.getByRole("button", { name: "Open Alpha", exact: true }).first();
    const reopenSameItem = async () => {
      if (await page.locator("#editor-overlay").isVisible()) await page.keyboard.press("Escape");
      await itemButton.click();
      await expect(page.locator("#item-preview")).toContainText("Generic feature.");
    };
    await reopenSameItem();
    await expect.poll(() => participantReads).toBe(1);

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(participantReads).toBe(1);
    expect(relatedReads).toBe(1);

    await page.locator("#item-participants > summary").click();
    holdNextParticipant = true;
    await page.locator("#item-participants-refresh").click();
    await expect.poll(() => participantHeld).toBe(true);
    await reopenSameItem();
    expect(participantReads).toBe(2);
    heldParticipantRead.release();
    await expect(page.locator("#item-participants-list")).toContainText("Fresh Session");
    await expect(page.locator(".item-participants-refresh-error")).toHaveCount(0);

    await page.locator("#related-work").evaluate((details) => { details.open = true; });
    await page.screenshot({ path: testInfo.outputPath(`${mode}-${layout}-feature-detail-desktop.png`) });
    await page.setViewportSize({ width: 390, height: 840 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    expect(await page.locator("#related-work-content").evaluate((content) => content.scrollWidth - content.clientWidth)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: testInfo.outputPath(`${mode}-${layout}-feature-detail-narrow.png`) });
    await page.locator("#related-work").screenshot({ path: testInfo.outputPath(`${mode}-${layout}-tasks-narrow.png`) });

    const beforeExpiry = { participantReads, relatedReads };
    await page.evaluate(() => {
      const now = Date.now();
      Date.now = () => now + 31_000;
      window.__refreshTicks.forEach((tick) => tick());
    });
    await expect.poll(() => participantReads).toBe(beforeExpiry.participantReads + 1);
    await expect.poll(() => relatedReads).toBe(beforeExpiry.relatedReads + 1);
    expect(data.reads()).toBeGreaterThan(0);

    const beforeManual = { participantReads, relatedReads };
    await page.locator("#refresh-button").evaluate((button) => button.click());
    await expect.poll(() => participantReads).toBe(beforeManual.participantReads + 1);
    await expect.poll(() => relatedReads).toBe(beforeManual.relatedReads + 1);
  });
}

test("detail reads completing while the overlay is closed remain reusable", async ({ page }) => {
  const held = responseHold();
  let participantReads = 0, relatedReads = 0;
  await fixture(page, "this", "columns", async () => {
    await page.route(/\/api\/items\/alpha\/participants(?:\?|$)/, async (route) => {
      participantReads++;
      await held.pending;
      await route.fulfill({ json: detailParticipantPayload("Closed Session") });
    });
    await page.route(/\/api\/items\/alpha\/related-work(?:\?|$)/, async (route) => {
      relatedReads++;
      await held.pending;
      await route.fulfill({ json: { status: "partial", records: [], total: 0, generation: "closed-generation", nextOffset: null, coverage: { legacy: 1 } } });
    });
  }, { openItem: true });
  await expect.poll(() => participantReads).toBe(1);
  await expect.poll(() => relatedReads).toBe(1);
  await page.keyboard.press("Escape");
  const settled = Promise.all([
    page.waitForResponse((response) => response.url().includes("/participants")).then((response) => response.finished()),
    page.waitForResponse((response) => response.url().includes("/related-work")).then((response) => response.finished()),
  ]);
  held.release();
  await settled;
  await page.getByRole("button", { name: "Open Alpha", exact: true }).click();
  await expect(page.locator("#item-participants-list")).toContainText("Closed Session");
  await expect(page.locator("#related-work > summary")).toContainText("May be incomplete");
  expect(participantReads).toBe(1);
  expect(relatedReads).toBe(1);
});

test("manual Refresh supersedes pending automatic detail reads", async ({ page }) => {
  const held = responseHold();
  let participantReads = 0, relatedReads = 0;
  await fixture(page, "this", "list", async () => {
    await page.route(/\/api\/items\/alpha\/participants(?:\?|$)/, async (route) => {
      const read = ++participantReads;
      if (read === 1) await held.pending;
      await route.fulfill({ json: detailParticipantPayload(read === 1 ? "Obsolete Session" : "Manual Session") });
    });
    await page.route(/\/api\/items\/alpha\/related-work(?:\?|$)/, async (route) => {
      const read = ++relatedReads;
      if (read === 1) await held.pending;
      await route.fulfill({ json: { status: "ok", records: [], total: read === 1 ? 99 : 0, generation: `generation-${read}`, nextOffset: null } });
    });
  }, { openItem: true });
  await expect.poll(() => participantReads).toBe(1);
  await expect.poll(() => relatedReads).toBe(1);
  await page.locator("#refresh-button").click();
  await expect.poll(() => participantReads).toBe(2);
  await expect.poll(() => relatedReads).toBe(2);
  await expect(page.locator("#item-participants-list")).toContainText("Manual Session");
  held.release();
  await expect(page.locator("#item-participants-list")).not.toContainText("Obsolete Session");
  await expect(page.locator("#related-work > summary")).toContainText("(0)");
});

test("detail reads retain partial coverage, recover failures, and isolate rapid item and uncommitted revision changes", async ({ page }) => {
  const held = responseHold();
  const failedRefresh = responseHold();
  const reads = { alpha: 0, beta: 0 };
  let failNext = false;
  const data = await fixture(page, "this", "columns", async ({ root, payload }) => {
    await fs.writeFile(path.join(root, "roadmap", "features", "beta.md"), "---\nid: beta\ntitle: Beta\nstatus: queued\npriority: medium\ncommitment: committed\n---\n\n## Summary\n\nBeta feature.\n");
    await fs.writeFile(path.join(root, "roadmap", "board.md"), "# Now\n- alpha\n- beta\n");
    Object.assign(payload, await loadWorkspace(root));
    await page.route(/\/api\/items\/(alpha|beta)\/participants(?:\?|$)/, async (route) => {
      const id = new URL(route.request().url()).pathname.split("/")[3];
      reads[id]++;
      if (id === "beta") await held.pending;
      if (failNext) {
        failNext = false;
        await failedRefresh.pending;
        await route.fulfill({ status: 503, json: { error: { message: "Temporary participant failure" } } });
      } else await route.fulfill({ json: { ...detailParticipantPayload(`${id} Session ${reads[id]}`), partial: true } });
    });
    await page.route(/\/api\/items\/(alpha|beta)\/related-work(?:\?|$)/, async (route) => {
      await route.fulfill({ json: { status: "partial", records: [], total: 0, generation: "partial-generation", nextOffset: null, coverage: { unreadable: 1 } } });
    });
  }, { openItem: true });
  const close = () => page.keyboard.press("Escape");
  const open = (title) => page.getByRole("button", { name: `Open ${title}`, exact: true }).first().click();
  await expect(page.locator("#item-participants-list")).toContainText("alpha Session 1");
  await page.locator("#item-participants > summary").click();
  failNext = true;
  await page.locator("#item-participants-refresh").click();
  await expect.poll(() => reads.alpha).toBe(2);
  await page.getByRole("button", { name: "Open Alpha", exact: true }).evaluate((button) => button.click());
  expect(reads.alpha).toBe(2);
  failedRefresh.release();
  await expect(page.locator(".item-participants-refresh-error")).toContainText("last successful results");
  await expect(page.locator("#item-participants-list")).toContainText("alpha Session 1");
  await page.locator("#item-participants-refresh").click();
  await expect(page.locator("#item-participants-list")).toContainText("alpha Session 3");
  await expect(page.locator(".item-participants-refresh-error")).toHaveCount(0);
  await close();
  await open("Alpha");
  await expect(page.locator("#item-participants-list")).toContainText("alpha Session 3");
  expect(reads.alpha).toBe(3);
  await expect(page.locator("#item-participants-status")).toContainText("+");
  await expect(page.locator("#related-work > summary")).toContainText("May be incomplete");
  await page.locator("#related-work > summary").click();
  await expect(page.locator("#related-work-content")).toContainText("some records could not be checked");
  await expect(page.locator("#related-work-content")).not.toContainText("older task records");

  await close();
  await fs.appendFile(path.join(data.root, "roadmap", "features", "alpha.md"), "\nUncommitted update.\n");
  await open("Alpha");
  await expect(page.locator("#item-preview")).toContainText("Uncommitted update.");
  await expect(page.locator("#item-participants-list")).toContainText("alpha Session 4");
  await close();
  await open("Beta");
  await expect.poll(() => reads.beta).toBe(1);
  await close();
  await open("Alpha");
  held.release();
  await expect(page.locator("#item-participants-list")).toContainText("alpha Session 4");
  await expect(page.locator("#item-participants-list")).not.toContainText("beta Session");
  expect(reads.alpha).toBe(4);
});

for (const mode of ["this", "across"]) for (const layout of ["list", "columns"]) {
  test(`${mode} ${layout} refreshes observations without a full scan and pauses observations while hidden`, async ({ page }, testInfo) => {
    const data = await fixture(page, mode, layout);
    await expect.poll(data.observations).toBeGreaterThan(0);
    await expect(page.locator("#board-groups .board-item-participants:visible").first()).toHaveText("1 linked session");
    const reads = data.reads();
    data.setRecent(2);
    await page.evaluate(() => window.__refreshTicks.forEach((tick) => tick()));
    await expect(page.locator("#board-groups .board-item-participants:visible").first()).toHaveText("2 linked sessions");
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
    await expect(page.locator("#board-groups .board-item-participants:visible").first()).toHaveText("3 linked sessions");
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
  await expect(page.locator("#board-groups .board-item-participants:visible").first()).toHaveText("1 linked session");
  data.fail();
  await page.evaluate(() => window.__refreshTicks.forEach((tick) => tick()));
  await expect(page.locator("#board-participant-status")).toContainText("earlier");
  await expect(page.locator("#board-groups .board-item-participants:visible").first()).toHaveText("1 linked session");
  await page.screenshot({ path: testInfo.outputPath("stale-desktop.png") });
  await page.setViewportSize({ width: 390, height: 840 });
  await expect(page.locator("#board-participant-status")).toHaveClass(/is-incomplete/);
  await expect(page.locator("#board-participant-status")).not.toHaveCSS("color", "rgba(0, 0, 0, 0)");
  await page.screenshot({ path: testInfo.outputPath("stale-narrow.png") });
});

test("hash entry to Spec cancels a workspace read and retains badges on unchanged return", async ({ page }) => {
  const data = await fixture(page, "this", "columns");
  await expect(page.locator("#board-groups .board-item-participants:visible").first()).toHaveText("1 linked session");
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
  await expect(page.locator("#board-participant-status")).toContainText("earlier");
  await expect(page.locator("#board-groups .board-item-participants:visible").first()).toHaveText("1 linked session");
  await expect(page.locator("#board-groups")).not.toContainText("Late Alpha");
});

test("a provisional snapshot keeps its full read through hidden completion", async ({ page }, testInfo) => {
  const hold = responseHold();
  let fullReads = 0;
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
  await expect(page.locator("#board-source-status-summary")).toContainText("Current worktree only");
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
  hold.release();
  await expect(page.locator("#board-source-status-summary")).not.toContainText("Current worktree only");
  expect(fullReads).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(data.observations).toBeGreaterThan(0);
  expect(fullReads).toBe(1);
});

for (const mode of ["this", "across"]) {
  test(`${mode} keeps one in-flight workspace read through repeated hide and resume`, async ({ page }) => {
    const data = await fixture(page, mode, "columns");
    const hold = responseHold();
    let holdNext = false, held = false, completed = false, followupReads = 0;
    const routePattern = mode === "across" ? "**/api/worktree-workspace**" : "**/api/workspace**";
    await page.route(routePattern, async (route) => {
      followupReads++;
      if (!holdNext) return route.fallback();
      holdNext = false;
      held = true;
      await hold.pending;
      const payload = structuredClone(data.payload);
      payload.snapshot = { ...payload.snapshot, id: `${payload.snapshot.id}-hidden-completion`, validatedAt: new Date().toISOString(), stale: false };
      if (mode === "across") {
        for (const feature of payload.features) for (const version of feature.versions) version.summary.title = "Completed while hidden";
        for (const group of payload.groups) for (const item of group.items) for (const version of item.versions || []) version.summary.title = "Completed while hidden";
      } else {
        payload.items.alpha.title = "Completed while hidden";
        for (const group of payload.boardGroups) for (const item of group.items) if (item.id === "alpha") item.title = "Completed while hidden";
      }
      await route.fulfill({ json: payload }).catch(() => {});
      completed = true;
    });
    holdNext = true;
    await page.locator("#refresh-button").click();
    await expect.poll(() => held).toBe(true);
    const hideAndShow = () => page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await hideAndShow();
    await hideAndShow();
    expect(followupReads).toBe(1);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    hold.release();
    await expect.poll(() => completed).toBe(true);
    await expect(page.locator("#board-groups")).toContainText("Completed while hidden");
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(followupReads).toBe(1);
  });
}

for (const mode of ["this", "across"]) {
  test(`${mode} cached stale workspace finishing hidden waits until resume to revalidate`, async ({ page }) => {
    const hold = responseHold();
    let intercepted = 0, held = false;
    const data = await fixture(page, mode, "columns");
    const routePattern = mode === "across" ? "**/api/worktree-workspace**" : "**/api/workspace**";
    await page.route(routePattern, async (route) => {
      intercepted++;
      if (intercepted === 1) {
        held = true;
        await hold.pending;
        await route.fulfill({ json: { ...data.payload, snapshot: { ...data.payload.snapshot, stale: true } } }).catch(() => {});
      } else return route.fallback();
    });
    await page.evaluate(() => {
      const now = Date.now();
      Date.now = () => now + 31_000;
      window.__refreshTicks.forEach((tick) => tick());
    });
    await expect.poll(() => held).toBe(true);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    hold.release();
    await expect(page.locator("#board-source-status-summary")).toContainText("Showing earlier results");
    expect(intercepted).toBe(1);
    await page.evaluate(() => {
      const now = Date.now();
      Date.now = () => now + 1_500;
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(() => intercepted).toBe(2);
    await expect(page.locator("#board-source-status-summary")).not.toContainText("Showing earlier results");
  });
}

test("a cold workspace read failure while hidden recovers on visible resume", async ({ page }) => {
  const hold = responseHold();
  let reads = 0;
  await fixture(page, "this", "columns", async () => {
    await page.route("**/api/workspace**", async (route) => {
      reads++;
      if (reads === 1) {
        await hold.pending;
        return route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Temporary failure" } } });
      }
      return route.fallback();
    });
  }, { waitForBoard: false });
  await expect.poll(() => reads).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  hold.release();
  await expect(page.locator("#roadmap-path")).toHaveText("Unavailable");
  await expect(page.locator("#board-groups")).not.toContainText("Alpha");
  expect(reads).toBe(1);
  await page.evaluate(() => {
    const now = Date.now();
    Date.now = () => now + 1_500;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => reads).toBe(2);
  await expect(page.locator("#board-groups")).toContainText("Alpha");
  await expect(page.locator("#roadmap-path")).not.toHaveText("Unavailable");
});

test("a workspace timeout while hidden retains the board and retries once on resume", async ({ page }) => {
  const data = await fixture(page, "this", "columns");
  const hold = responseHold();
  let reads = 0, held = false;
  await page.route("**/api/workspace**", async (route) => {
    reads++;
    if (reads === 1) {
      held = true;
      await hold.pending;
      await route.fulfill({ json: data.payload }).catch(() => {});
    } else return route.fallback();
  });
  await page.evaluate(() => {
    const nativeTimeout = AbortSignal.timeout;
    window.__workspaceTimeoutMs = 0;
    window.__restoreTimeout = () => { AbortSignal.timeout = nativeTimeout; };
    AbortSignal.timeout = (milliseconds) => {
      if (milliseconds !== 30_000) return nativeTimeout.call(AbortSignal, milliseconds);
      window.__workspaceTimeoutMs = milliseconds;
      const controller = new AbortController();
      window.__expireWorkspaceTimeout = () => controller.abort(new DOMException("Timed out.", "TimeoutError"));
      return controller.signal;
    };
  });
  await page.locator("#refresh-button").click();
  await expect.poll(() => held).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    window.__expireWorkspaceTimeout();
  });
  await expect(page.locator("#board-source-status-summary")).toContainText("Showing earlier results");
  await expect(page.locator("#board-groups")).toContainText("Alpha");
  expect(await page.evaluate(() => window.__workspaceTimeoutMs)).toBe(30_000);
  expect(reads).toBe(1);
  hold.release();
  await page.evaluate(() => {
    window.__restoreTimeout();
    const now = Date.now();
    Date.now = () => now + 1_500;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => reads).toBe(2);
  await expect(page.locator("#board-source-status-summary")).not.toContainText("Showing earlier results");
});

test("a newly ambiguous feature cannot retain its formerly confirmed participant badge", async ({ page }) => {
  const data = await fixture(page, "across", "columns");
  await expect(page.locator("#board-groups .board-item-participants:visible").first()).toHaveText("1 linked session");
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
  await expect(page.locator("#board-participant-status")).toContainText("incomplete");
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
