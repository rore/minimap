import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadWorktreeAggregate } from "../package/minimap/src/worktree-aggregate.js";

const owned = [];
const gates = [];
const itemRoute = /\/api\/(?:source\/)?items\/[^/?]+$/;
const title = (id) => `Feature ${id}`;
const text = (id) => `---\nid: ${id}\ntitle: ${title(id)}\nstatus: queued\npriority: medium\ncommitment: committed\n---\n\n## Summary\n\nOriginal ${id} body.\n`;

async function fixture({ linked = false, dense = false } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-open-feedback-"));
  owned.push(dir);
  const root = path.join(dir, "main");
  const ids = [...(dense ? Array.from({ length: 28 }, (_, i) => `filler-${i}`) : []), "a", "b", "c"];
  await fs.mkdir(path.join(root, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"));
  await fs.writeFile(path.join(root, "roadmap", "ideas", ".keep"), "");
  await fs.writeFile(path.join(root, "roadmap", "board.md"), `# Now\n${ids.map((id) => `- ${id}`).join("\n")}\n`);
  await fs.writeFile(path.join(root, "roadmap", "scope.md"), "Isolated opening regression fixture.\n");
  for (const id of ids) await fs.writeFile(path.join(root, "roadmap", "features", `${id}.md`), text(id));
  const data = { dir, root };
  if (linked) {
    const git = (...args) => execFileSync("git", args, { cwd: root, windowsHide: true, stdio: "pipe" });
    git("init", "-b", "main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.invalid");
    git("config", "core.autocrlf", "false");
    git("add", ".");
    git("commit", "-m", "fixture");
    data.sibling = path.join(dir, "blue");
    git("worktree", "add", "-b", "feature/blue", data.sibling);
    await fs.writeFile(path.join(data.sibling, "roadmap", "features", "b.md"), text("b").replace("Original b body.", "Sibling b body."));
    data.opened = await loadWorktreeAggregate(root, { openedOnly: true });
    data.full = await loadWorktreeAggregate(root);
    expect(data.full.workspace).not.toBeNull();
  }
  return data;
}

async function open(page, data, { layout = "list", item = "b" } = {}) {
  if (data.full) await page.route("**/api/worktree-workspace**", (route) => route.fulfill({
    json: new URL(route.request().url()).searchParams.has("openedOnly") ? data.opened : data.full,
  }));
  await page.goto(`/#repo=${encodeURIComponent(data.root)}&layout=${layout}&item=${item}${data.full ? "&sources=across" : ""}`);
  if (data.full) {
    await expect(page.locator("#board-source-status-details")).toContainText("2 worktrees loaded");
    await card(page, item).click();
  }
  await expect(page.locator("#editor-title")).toHaveText(title(item));
  await expect(page.locator("#item-preview")).toContainText(`Original ${item} body.`);
}

function card(page, id) {
  return page.getByRole("button", { name: `Open ${title(id)}`, exact: true });
}

async function hold(page, id, { status, error = "Current item read failed." } = {}) {
  let release;
  let started;
  let settled;
  let used = false;
  const pending = new Promise((resolve) => { release = resolve; });
  const gate = { release, started: new Promise((resolve) => { started = resolve; }), settled: new Promise((resolve) => { settled = resolve; }) };
  gates.push(gate);
  await page.route(itemRoute, async (route) => {
    if (used || !route.request().url().endsWith(`/items/${id}`)) return route.fallback();
    used = true;
    gate.request = route.request();
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    started();
    await pending;
    try {
      await route.fulfill(status ? { status, json: { error: { message: error } } } : { response });
    } finally { settled(); }
  });
  return gate;
}

async function paint(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function settle(page, gate) {
  gate.release();
  await gate.settled;
  await paint(page);
}

async function observeAnnouncements(page) {
  await page.evaluate(() => {
    window.openingAnnouncements = [];
    const region = document.querySelector("#item-opening-status");
    if (!region) throw new Error("Missing request-owned item-opening status region");
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") window.openingAnnouncements.push(mutation.target.data);
        for (const node of mutation.addedNodes) if (node.textContent) window.openingAnnouncements.push(node.textContent);
      }
    }).observe(region, { subtree: true, characterData: true, childList: true });
  });
}

async function expectCue(page, id) {
  const cue = page.locator("#item-opening-status");
  await expect(cue).toHaveAttribute("role", "status");
  await expect(cue).toHaveText(`Opening ${title(id)}…`);
  await expect(cue).toBeVisible();
  return cue;
}

async function expectSilent(page) {
  await expect(page.locator("#item-opening-status")).toBeEmpty();
}

async function edit(page, mode, across = false) {
  if (across) page.once("dialog", (dialog) => dialog.accept());
  await page.locator(`#tab-${mode}`).click();
  if (mode === "structured" && !await page.locator("#field-title").isVisible()) await page.locator("#metadata-toggle").click();
  return page.locator(mode === "raw" ? "#raw-text" : "#field-title");
}

test.afterEach(async ({ page }) => {
  for (const gate of gates.splice(0)) gate.release();
  await page.goto("about:blank");
  for (const dir of owned.splice(0)) await fs.rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

test("delayed explicit keyboard open announces its item without moving focus", async ({ page }) => {
  const data = await fixture();
  await open(page, data);
  const gate = await hold(page, "a");
  const target = card(page, "a");
  await target.focus();
  await page.keyboard.press("Enter");
  await gate.started;
  await expectCue(page, "a");
  await expect(target).toBeFocused();
  await expect(page.locator("#item-preview")).toContainText("Original b body.");
  await settle(page, gate);
  await expect(page.locator("#editor-title")).toHaveText(title("a"));
  await expectSilent(page);
});

test("fast explicit reads and background rereads never mutate the live announcement", async ({ page }) => {
  const data = await fixture();
  await open(page, data);
  await observeAnnouncements(page);
  const response = await page.request.get(`/api/items/a`, { headers: { "X-Minimap-Repo": data.root } });
  const item = await response.json();
  await page.route("**/api/items/a", (route) => route.fulfill({ json: item }));
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await card(page, "a").click();
  await expect(page.locator("#editor-title")).toHaveText(title("a"));
  await page.clock.runFor(100);
  expect(await page.evaluate(() => window.openingAnnouncements)).toEqual([]);
  await page.clock.resume();
  await page.unroute("**/api/items/a");
  const gate = await hold(page, "a");
  await page.locator("#refresh-button").click();
  await gate.started;
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.openingAnnouncements)).toEqual([]);
  await settle(page, gate);
  await expectSilent(page);
  expect(await page.evaluate(() => window.openingAnnouncements)).toEqual([]);
});

for (const layout of ["list", "columns"]) test(`superseded A cannot announce, replace content, report an error or clear pending B (${layout})`, async ({ page }) => {
  const data = await fixture();
  await open(page, data, { item: "c", layout });
  const a = await hold(page, "a", { status: 503, error: "Stale A failure" });
  const b = await hold(page, "b");
  if (layout === "columns") await card(page, "a").evaluate((button) => button.click());
  else await card(page, "a").click();
  await a.started;
  await expectCue(page, "a");
  expect(await card(page, "b").evaluate((button) => {
    button.click();
    return document.querySelector("#item-opening-status").textContent;
  })).toBe("");
  await b.started;
  await expectCue(page, "b");
  await observeAnnouncements(page);
  await settle(page, a);
  await expectCue(page, "b");
  await expect(page.locator("#item-preview")).toContainText("Original c body.");
  await expect(page.locator("#status-banner")).not.toContainText("Stale A failure");
  expect(await page.evaluate(() => window.openingAnnouncements)).toEqual([]);
  await settle(page, b);
  await expect(page.locator("#editor-title")).toHaveText(title("b"));
  await expectSilent(page);
});

test("current failed version read retains loaded content, version and source actions", async ({ page }) => {
  const data = await fixture({ linked: true });
  await open(page, data);
  const originalSource = await page.locator("#editor-source-summary").textContent();
  const originalRoute = new URL(page.url()).hash;
  const gate = await hold(page, "b", { status: 503 });
  await page.locator("#editor-source-summary").click();
  await page.locator('[data-editor-source]').filter({ hasText: "feature/blue" }).click();
  await gate.started;
  await expectCue(page, "b");
  await expect(page.locator("#item-preview")).toContainText("Original b body.");
  await expect(page.locator("#editor-source-summary")).toHaveText(originalSource);
  await expect(page.locator("#open-in-spec-button")).toBeDisabled();
  await settle(page, gate);
  await expectSilent(page);
  await expect(page.locator("#status-banner")).toContainText("Current item read failed.");
  await expect(page.locator("#item-preview")).toContainText("Original b body.");
  await expect(page.locator("#editor-source-summary")).toHaveText(originalSource);
  await expect(page.locator("#open-in-spec-button")).toBeEnabled();
  expect(new URL(page.url()).hash).toBe(originalRoute);
});

for (const mode of ["structured", "raw"]) test(`failed version switch retains exact ${mode} draft, mode and accepted save source`, async ({ page }) => {
  const data = await fixture({ linked: true });
  await open(page, data);
  const field = await edit(page, mode, true);
  const draft = mode === "raw" ? `${text("b")}\nExact retained raw draft <&> 🚀\n` : "Exact retained structured draft <&> 🚀";
  await field.fill(draft);
  const source = await page.locator("#editor-source-summary").textContent();
  const gate = await hold(page, "b", { status: 503 });
  await page.locator("#editor-source-summary").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("[data-editor-source]").filter({ hasText: "feature/blue" }).click();
  await gate.started;
  await expectCue(page, "b");
  await settle(page, gate);
  await expect(page.locator("#status-banner")).toContainText("Current item read failed.");
  await expect(page.locator(`#tab-${mode}`)).toHaveAttribute("aria-selected", "true");
  await expect(field).toHaveValue(draft);
  await expect(page.locator("#save-button")).toBeEnabled();
  await expect(page.locator("#editor-source-summary")).toHaveText(source);
  await expectSilent(page);
  let unexpectedConsent = 0;
  page.on("dialog", (dialog) => { unexpectedConsent += 1; void dialog.dismiss(); });
  const saved = page.waitForResponse((response) => itemRoute.test(response.url()) && response.request().method() === "POST");
  await page.locator("#save-button").click();
  const response = await saved;
  expect(response.ok()).toBe(true);
  expect(JSON.parse(response.request().headers()["x-minimap-source-context"]).git.branchRef).toBe("refs/heads/main");
  expect(unexpectedConsent).toBe(0);
  expect(await fs.readFile(path.join(data.root, "roadmap", "features", "b.md"), "utf8")).toContain(draft.trim());
  expect(await fs.readFile(path.join(data.sibling, "roadmap", "features", "b.md"), "utf8")).toContain("Sibling b body.");
});

test("reselecting displayed B cancels pending A", async ({ page }) => {
  const data = await fixture();
  await open(page, data);
  const a = await hold(page, "a");
  await card(page, "a").click();
  await a.started;
  await expectCue(page, "a");
  await card(page, "b").click();
  await expectSilent(page);
  await observeAnnouncements(page);
  await settle(page, a);
  await expect(page.locator("#editor-title")).toHaveText(title("b"));
  await expect(page).toHaveURL(/item=b/);
  expect(await page.evaluate(() => window.openingAnnouncements)).toEqual([]);
});

test("reselecting the loaded main version cancels a pending sibling version and its preference", async ({ page }) => {
  const data = await fixture({ linked: true });
  await open(page, data);
  const gate = await hold(page, "b");
  await page.locator("#editor-source-summary").click();
  await page.locator("[data-editor-source]").filter({ hasText: "feature/blue" }).click();
  await gate.started;
  await expectCue(page, "b");
  await page.locator("#editor-source-summary").click();
  await page.locator('[data-editor-source][aria-pressed="true"]').click();
  await expectSilent(page);
  await settle(page, gate);
  await expect(page.locator("#item-preview")).toContainText("Original b body.");
  await expect(page.locator("#editor-source-summary")).toContainText("main");
  await expect(page.locator("#open-in-spec-button")).toBeEnabled();
  const read = page.waitForRequest((request) => itemRoute.test(request.url()));
  await page.locator("#refresh-button").click();
  expect(JSON.parse((await read).headers()["x-minimap-source-context"]).git.branchRef).toBe("refs/heads/main");
  await expect(page.locator("#item-preview")).toContainText("Original b body.");
});

test("cancelling A through Edit restores cached B enrichment when returning to Read", async ({ page }) => {
  const data = await fixture();
  await page.route("**/api/items/b/related-work**", (route) => route.fulfill({ json: {
    status: "ok", records: [], total: 0, nextOffset: null, generation: "fixture", coverage: {},
  } }));
  await page.route("**/api/items/b/participants", (route) => route.fulfill({ json: {
    status: "ok", participants: [], partial: false,
  } }));
  await open(page, data);
  await expect(page.locator("#related-work > summary")).not.toContainText("Loading");
  await expect(page.locator("#item-participants")).toBeVisible();
  const a = await hold(page, "a");
  await card(page, "a").click();
  await a.started;
  await edit(page, "structured");
  await page.locator("#tab-preview").click();
  await expect(page.locator("#related-work > summary")).not.toContainText("Loading");
  await page.locator("#related-work > summary").click();
  await expect(page.locator("[data-related-refresh]")).toBeEnabled();
  await expect(page.locator("#related-work-content")).toContainText("No task records link to this feature.");
  await expect(page.locator("#item-participants")).toBeVisible();
  await page.locator("#item-participants > summary").click();
  await expect(page.locator("#item-participants-list")).toContainText("No sessions are associated with this item.");
  await settle(page, a);
  await expect(page.locator("#editor-title")).toHaveText(title("b"));
  await expect(page.locator("[data-related-refresh]")).toBeEnabled();
});

for (const exit of ["button", "hash"]) test(`Spec ${exit} exit cancels pending open without stale routing or narrow scroll`, async ({ page }) => {
  const data = await fixture({ dense: true });
  await page.setViewportSize({ width: 390, height: 840 });
  await open(page, data);
  const a = await hold(page, "a");
  await card(page, "a").click();
  await a.started;
  await expectCue(page, "a");
  if (exit === "button") await page.locator("#spec-mode-button").click();
  else await page.evaluate(() => {
    const route = new URLSearchParams(location.hash.slice(1));
    route.set("view", "spec");
    location.hash = route.toString();
  });
  await expect(page.locator("#spec-workbench")).toBeVisible();
  await expect(page).toHaveURL(/view=spec/);
  await expectSilent(page);
  const route = new URL(page.url()).hash;
  await page.evaluate(() => {
    window.staleScrolls = 0;
    const scroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) { window.staleScrolls += 1; return scroll.apply(this, args); };
  });
  await settle(page, a);
  await expect(page.locator("#spec-workbench")).toBeVisible();
  expect(new URL(page.url()).hash).toBe(route);
  expect(await page.evaluate(() => window.staleScrolls)).toBe(0);
  await expect(page.locator("#editor-title")).toHaveText(title("b"));
});

for (const mode of ["structured", "raw"]) test(`accepted ${mode} mode and exact new draft retire pending A without resetting B`, async ({ page }) => {
  const data = await fixture({ linked: true });
  await open(page, data);
  const source = await page.locator("#editor-source-summary").textContent();
  const a = await hold(page, "a");
  await card(page, "a").click();
  await a.started;
  await expectCue(page, "a");
  const field = await edit(page, mode, true);
  await expectSilent(page);
  const draft = mode === "raw" ? `${text("b")}\nExact raw draft <&> 🚀\n` : "Exact structured draft <&> 🚀";
  await field.fill(draft);
  await expectSilent(page);
  await settle(page, a);
  await expect(field).toHaveValue(draft);
  await expect(page.locator("#save-button")).toBeEnabled();
  await expect(page.locator("#editor-source-summary")).toHaveText(source);
  await expect(page.locator("#field-id")).toHaveValue("b");
  await expect(page).toHaveURL(/mode=(?:structured|raw)/);
  await expect(page).not.toHaveURL(/item=a(?:&|$)/);
});

for (const mode of ["structured", "raw"]) test(`new ${mode} input alone cancels a background reread and preserves exact dirty text`, async ({ page }) => {
  const data = await fixture();
  await open(page, data);
  const field = await edit(page, mode);
  const b = await hold(page, "b");
  await page.locator("#refresh-button").click();
  await b.started;
  const draft = mode === "raw" ? `${text("b")}\nTyped during read.\n` : "Typed during read <&> 🚀";
  await field.fill(draft);
  await expect.poll(() => b.request.failure()?.errorText || "").toContain("ERR_ABORTED");
  await settle(page, b);
  await expect(field).toHaveValue(draft);
  await expect(page.locator("#save-button")).toBeEnabled();
  await expectSilent(page);
});

test("declined discard or source-edit consent issues no read or announcement", async ({ page }) => {
  const data = await fixture({ linked: true });
  await open(page, data);
  await observeAnnouncements(page);
  let reads = 0;
  page.on("request", (request) => { if (itemRoute.test(request.url())) reads += 1; });
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator("#tab-structured").click();
  await expect(page.locator("#tab-preview")).toHaveAttribute("aria-selected", "true");
  const field = await edit(page, "structured", true);
  await field.fill("Keep my unsaved draft");
  page.once("dialog", (dialog) => dialog.dismiss());
  await card(page, "a").click();
  await page.waitForTimeout(120);
  await expect(field).toHaveValue("Keep my unsaved draft");
  expect(reads).toBe(0);
  expect(await page.evaluate(() => window.openingAnnouncements)).toEqual([]);
});

for (const layout of ["list", "columns"]) test(`narrow scrolled ${layout} cue is viewport-visible above retained content and overlay`, async ({ page }, testInfo) => {
  const data = await fixture({ dense: true });
  await page.setViewportSize({ width: 390, height: 840 });
  await open(page, data, { layout });
  const a = await hold(page, "a");
  if (layout === "columns") {
    await expect(page.locator("#editor-overlay")).toBeVisible();
    // The open overlay deliberately covers board controls; retain it while a second open starts.
    await card(page, "a").evaluate((button) => button.click());
  } else {
    await card(page, "a").scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(100);
    await card(page, "a").click();
  }
  await a.started;
  const cue = await expectCue(page, "a");
  await paint(page);
  const visibility = await cue.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const overlay = document.querySelector("#editor-overlay");
    return { inViewport: box.top >= 0 && box.left >= 0 && box.bottom <= innerHeight && box.right <= innerWidth,
      shortTextFits: element.scrollWidth <= element.clientWidth,
      pointerEvents: style.pointerEvents, aboveOverlay: overlay.hidden || Number(style.zIndex) > Number(getComputedStyle(overlay).zIndex) };
  });
  expect(visibility).toEqual({ inViewport: true, shortTextFits: true, pointerEvents: "none", aboveOverlay: true });
  await page.screenshot({ path: testInfo.outputPath(`pending-${layout}-narrow.png`) });
  if (layout === "columns") await page.keyboard.press("Escape");
  else await page.locator("#board-layout-columns").click();
  await expectSilent(page);
  await settle(page, a);
  await expectSilent(page);
  await expect(page).not.toHaveURL(/item=a(?:&|$)/);
});
