import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadWorktreeAggregate } from "../package/minimap/src/worktree-aggregate.js";

const owned = [];
const gates = [];
const itemText = (id) => `---\nid: ${id}\ntitle: ${id}\nstatus: queued\npriority: medium\ncommitment: committed\ncustom_field: preserve-me\n---\n\n## Summary\n\n${id} body.\n`;

async function fixture(linked = false) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-reconciliation-"));
  owned.push(dir);
  const root = path.join(dir, "main");
  await fs.mkdir(path.join(root, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"));
  await fs.writeFile(path.join(root, "roadmap", "ideas", ".keep"), "");
  await fs.writeFile(path.join(root, "roadmap", "board.md"), "# Now\n- alpha\n- beta\n");
  await fs.writeFile(path.join(root, "roadmap", "scope.md"), "Initial scope.\n");
  for (const id of ["alpha", "beta"]) await fs.writeFile(path.join(root, "roadmap", "features", `${id}.md`), itemText(id));
  const data = { dir, root, alpha: path.join(root, "roadmap", "features", "alpha.md") };
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
    data.siblingAlpha = path.join(data.sibling, "roadmap", "features", "alpha.md");
    await fs.writeFile(data.siblingAlpha, itemText("alpha").replace("alpha body.", "Selected sibling body."));
    data.opened = await loadWorktreeAggregate(root, { openedOnly: true });
    data.full = await loadWorktreeAggregate(root);
    expect(data.full.workspace).not.toBeNull();
    for (const aggregate of [data.opened, data.full]) aggregate.participantCounts = { status: "disabled", counts: [], partial: false };
  }
  return data;
}

async function responseGate(page, pattern, predicate = () => true, transform = (body) => body, status) {
  let release;
  let started;
  let settled;
  let held = false;
  const pending = new Promise((resolve) => { release = resolve; });
  const gate = {
    started: new Promise((resolve) => { started = resolve; }),
    settled: new Promise((resolve) => { settled = resolve; }),
    release,
  };
  gates.push(gate);
  await page.route(pattern, async (route) => {
    if (held || !predicate(route.request())) return route.continue();
    held = true;
    const response = await route.fetch();
    const body = transform(await response.text());
    started();
    await pending;
    await route.fulfill({ response, body, ...(status ? { status } : {}) });
    settled();
  });
  return gate;
}

async function settle(page, gate) {
  gate.release();
  await gate.settled;
  // Cross the response's render turn before checking that a draft stayed intact.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function openEditor(page, data, mode = "structured") {
  await page.goto(`/#repo=${encodeURIComponent(data.root)}&item=alpha`);
  await expect(page.locator("#editor-title")).toContainText("alpha");
  await page.locator(`#tab-${mode}`).click();
  if (mode === "structured" && !await page.locator("#field-title").isVisible()) await page.locator("#metadata-toggle").click();
  await expect(page.locator(mode === "raw" ? "#raw-text" : "#field-title")).toBeVisible();
}

async function openAcross(page, data) {
  await page.route("**/api/worktree-workspace**", (route) => route.fulfill({ json: new URL(route.request().url()).searchParams.has("openedOnly") ? data.opened : data.full }));
  await page.goto(`/#repo=${encodeURIComponent(data.root)}&sources=across&item=alpha`);
  await expect(page.locator("#board-source-status-details")).toContainText("2 roadmap checkouts loaded");
  await expect(page.locator("#editor-title")).toContainText("alpha");
}

test.afterEach(async () => {
  for (const gate of gates.splice(0)) gate.release();
  for (const dir of owned.splice(0)) {
    expect(path.dirname(dir)).toBe(os.tmpdir());
    expect(path.basename(dir)).toMatch(/^minimap-reconciliation-/);
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

for (const mode of ["structured", "raw"]) for (const phase of ["workspace", "item"]) {
  test(`Refresh preserves a ${mode} draft typed during its ${phase} response`, async ({ page }) => {
    const data = await fixture();
    await openEditor(page, data, mode);
    const gate = await responseGate(page, phase === "workspace" ? /\/api\/workspace$/ : /\/api\/items\/alpha$/, (request) => request.method() === "GET");
    await page.locator("#refresh-button").click();
    await gate.started;
    const editor = page.locator(mode === "raw" ? "#raw-text" : "#field-title");
    const draft = mode === "raw" ? `${await editor.inputValue()}\nRefresh draft.\n` : "Refresh draft";
    await editor.fill(draft);
    await settle(page, gate);
    await expect(editor).toHaveValue(draft);
    await expect(page.locator(`#tab-${mode}`)).toHaveAttribute("aria-selected", "true");
    await page.locator("#save-button").click();
    await expect.poll(() => fs.readFile(data.alpha, "utf8")).toContain("Refresh draft");
    expect(await fs.readFile(data.alpha, "utf8")).toContain("custom_field: preserve-me");
  });
}

for (const kind of ["board", "scope"]) {
  test(`Refresh preserves a ${kind} draft begun while its workspace response is pending`, async ({ page }) => {
    const data = await fixture();
    await openEditor(page, data);
    const gate = await responseGate(page, /\/api\/workspace$/);
    await page.locator("#refresh-button").click();
    await gate.started;
    await page.locator(`#${kind}-edit-button`).click();
    const editor = page.locator(kind === "board" ? "[data-board-group-name='0']" : "#scope-text");
    await editor.fill("Post-request draft");
    await settle(page, gate);
    await expect(editor).toHaveValue("Post-request draft");
    await expect(page.locator(`#${kind}-save-button`)).toBeEnabled();
  });
}

for (const mode of ["structured", "raw"]) for (const phase of ["save", "refresh"]) {
  test(`Save preserves later ${mode} edits during its ${phase} response`, async ({ page }) => {
    const data = await fixture();
    await openEditor(page, data, mode);
    const editor = page.locator(mode === "raw" ? "#raw-text" : "#field-title");
    const submitted = mode === "raw" ? `${await editor.inputValue()}\nSubmitted draft.\n` : "Submitted draft";
    await editor.fill(submitted);
    const gate = await responseGate(page, phase === "save" ? /\/api\/items\/alpha$/ : /\/api\/workspace$/, (request) => request.method() === (phase === "save" ? "POST" : "GET"));
    await page.locator("#save-button").click();
    await gate.started;
    const later = `${submitted} later edit`;
    await editor.fill(later);
    await settle(page, gate);
    await expect(editor).toHaveValue(later);
    await expect(page.locator("#save-button")).toBeEnabled();
    await page.locator("#save-button").click();
    await expect.poll(() => fs.readFile(data.alpha, "utf8")).toContain("later edit");
    expect(await fs.readFile(data.alpha, "utf8")).toContain("custom_field: preserve-me");
  });
}

for (const kind of ["board", "scope"]) {
  test(`a ${kind} draft begun during Refresh keeps its original write revision`, async ({ page }) => {
    const data = await fixture();
    await openEditor(page, data);
    const file = path.join(data.root, "roadmap", `${kind}.md`);
    const external = kind === "board" ? "# External board\n- alpha\n- beta\n" : "External scope.\n";
    await fs.writeFile(file, external);
    const gate = await responseGate(page, /\/api\/workspace$/);
    await page.locator("#refresh-button").click();
    await gate.started;
    await page.locator(`#${kind}-edit-button`).click();
    const editor = page.locator(kind === "board" ? "[data-board-group-name='0']" : "#scope-text");
    await editor.fill("Local draft");
    await settle(page, gate);
    const response = page.waitForResponse((response) => response.url().endsWith(`/api/${kind}`) && response.request().method() === "POST");
    await page.locator(`#${kind}-save-button`).click();
    expect((await response).status()).toBe(409);
    expect(await fs.readFile(file, "utf8")).toBe(external);
    await expect(editor).toHaveValue("Local draft");
  });

  test(`${kind} Save preserves edits made while the saved response is pending`, async ({ page }) => {
    const data = await fixture();
    await openEditor(page, data);
    await page.locator(`#${kind}-edit-button`).click();
    const editor = page.locator(kind === "board" ? "[data-board-group-name='0']" : "#scope-text");
    await editor.fill("Submitted draft");
    const gate = await responseGate(page, new RegExp(`/api/${kind}$`), (request) => request.method() === "POST");
    await page.locator(`#${kind}-save-button`).click();
    await gate.started;
    await editor.fill("Later draft");
    await settle(page, gate);
    await expect(editor).toHaveValue("Later draft");
    await expect(page.locator(`#${kind}-save-button`)).toBeEnabled();
    const saved = page.waitForResponse((response) => response.url().endsWith(`/api/${kind}`) && response.request().method() === "POST");
    await page.locator(`#${kind}-save-button`).click();
    expect((await saved).ok()).toBe(true);
    expect(await fs.readFile(path.join(data.root, "roadmap", `${kind}.md`), "utf8")).toContain("Later draft");
  });
}

test("Review targets the selected sibling version's actual file", async ({ page }) => {
  test.setTimeout(60_000);
  const data = await fixture(true);
  let attached;
  page.on("request", (request) => { if (request.url().endsWith("/spec-sessions/attach")) attached = request.postDataJSON().file; });
  await openAcross(page, data);
  await page.locator("#editor-source-summary").click();
  await page.locator("[data-editor-source]").filter({ hasText: "feature/blue" }).click();
  await expect(page.locator("#item-preview")).toContainText("Selected sibling body.");
  await page.locator("#open-in-spec-button").click();
  await expect.poll(() => attached?.replaceAll("\\", "/").toLowerCase()).toBe(data.siblingAlpha.replaceAll("\\", "/").toLowerCase());
  await expect(page.locator("#spec-file-content")).toContainText("Selected sibling body.", { timeout: 15_000 });
});

test("Across Refresh requests selected-item participant details exactly once", async ({ page }) => {
  test.setTimeout(60_000);
  const data = await fixture(true);
  let details = 0;
  let itemReads = 0;
  await page.route(/\/api\/(?:source\/)?items\/[^/]+\/participants$/, (route) => {
    details += 1;
    return route.fulfill({ json: { status: "disabled", reference: null, participants: [], partial: false } });
  });
  page.on("request", (request) => { if (/\/api\/(?:source\/)?items\/alpha$/.test(request.url())) itemReads += 1; });
  await openAcross(page, data);
  await expect.poll(() => details).toBeGreaterThan(0);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const initial = details;
  const initialItems = itemReads;
  await page.locator("#refresh-button").click();
  await expect.poll(() => itemReads).toBe(initialItems + 1);
  await expect.poll(() => details).toBeGreaterThan(initial);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(details).toBe(initial + 1);
});

async function specFixture(page, request) {
  const data = await fixture();
  data.files = [path.join(data.root, "alpha-spec.md"), path.join(data.root, "beta-spec.md")];
  for (const [index, file] of data.files.entries()) {
    await fs.writeFile(file, `# ${index ? "Beta" : "Alpha"} spec\n\n${index ? "Beta" : "Alpha"} document body.\n`);
    const response = await request.post("/api/spec-sessions/attach", { data: { file } });
    expect(response.ok()).toBe(true);
  }
  // Trigger the actual poll callback deterministically without another poll racing the gate.
  await page.addInitScript(() => {
    const interval = window.setInterval;
    window.setInterval = (callback, delay, ...args) => {
      if (delay === 5000) { window.__runSpecPoll = callback; return interval(() => {}, 3_600_000); }
      return interval(callback, delay, ...args);
    };
  });
  await page.goto(`/#repo=${encodeURIComponent(data.root)}&view=spec&file=${encodeURIComponent(data.files[0])}`);
  await expect(page.locator("#spec-file-content")).toContainText("Alpha document body.");
  return data;
}

for (const phase of ["list", "context", "content", "poll"]) {
  test(`a late Spec ${phase} response cannot replace a newer selected file`, async ({ page, request }) => {
    const data = await specFixture(page, request);
    if (phase === "poll") {
      const response = await request.post("/api/spec-sessions/by-file/comments", { data: { file: data.files[0], by: "Test", kind: "question", scope: "global", text: "Obsolete Alpha comment" } });
      expect(response.ok()).toBe(true);
    }
    const gate = await responseGate(page, phase === "list" ? /\/api\/spec-sessions$/ : new RegExp(`/api/spec-sessions/by-file/${phase === "poll" ? "context" : phase}\\?`), () => true, (body) => {
      if (phase !== "list") return body;
      const payload = JSON.parse(body);
      payload.sessions = payload.sessions.filter((session) => session.targetFile.replaceAll("\\", "/") !== data.files[1].replaceAll("\\", "/"));
      return JSON.stringify(payload);
    });
    if (phase === "poll") await page.evaluate(() => window.__runSpecPoll());
    else await page.locator("#refresh-button").click();
    await gate.started;
    await page.locator(`[data-spec-session-path="${data.files[1].replaceAll("\\", "/")}"]`).click();
    await expect(page.locator("#spec-file-content")).toContainText("Beta document body.");
    await settle(page, gate);
    await expect(page.locator("#spec-file-content")).toContainText("Beta document body.");
    await expect(page.locator("#spec-margin")).not.toContainText("Obsolete Alpha comment");
    expect(new URLSearchParams(await page.evaluate(() => location.hash.slice(1))).get("file")?.replaceAll("\\", "/")).toBe(data.files[1].replaceAll("\\", "/"));
  });
}

test("a late Spec load error cannot replace a newer file or its banner", async ({ page, request }) => {
  const data = await specFixture(page, request);
  const gate = await responseGate(page, /\/api\/spec-sessions\/by-file\/context\?/, () => true, () => JSON.stringify({ error: { code: "target_missing", message: "Obsolete Alpha error" } }), 404);
  await page.locator("#refresh-button").click();
  await gate.started;
  await page.locator(`[data-spec-session-path="${data.files[1].replaceAll("\\", "/")}"]`).click();
  await expect(page.locator("#spec-file-content")).toContainText("Beta document body.");
  await settle(page, gate);
  await expect(page.locator("#spec-file-content")).toContainText("Beta document body.");
  await expect(page.locator("#status-banner")).not.toContainText("Obsolete Alpha error");
});

test("a late Spec load error cannot interrupt a different mode", async ({ page, request }) => {
  await specFixture(page, request);
  const gate = await responseGate(page, /\/api\/spec-sessions\/by-file\/context\?/, () => true, () => JSON.stringify({ error: { code: "target_missing", message: "Obsolete mode error" } }), 404);
  await page.locator("#refresh-button").click();
  await gate.started;
  await page.locator("#roadmap-mode-button").click();
  await expect(page.locator("#roadmap-mode-button")).toHaveAttribute("aria-selected", "true");
  await settle(page, gate);
  await expect(page.locator("#status-banner")).not.toContainText(/Attached file no longer exists|Obsolete mode error/);
  expect(new URLSearchParams(await page.evaluate(() => location.hash.slice(1))).get("view")).not.toBe("spec");
});
