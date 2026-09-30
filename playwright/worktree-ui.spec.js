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
  git(root, "worktree", "add", "-b", "feature/blue", sibling);
  const changed = path.join(sibling, "roadmap", "features", "large-01.md");
  await fs.writeFile(changed, (await fs.readFile(changed, "utf8")).replace("status: done", "status: in-progress"));
  await fs.writeFile(path.join(sibling, "roadmap", "features", "blue-only.md"), "---\nid: blue-only\ntitle: Blue-only untracked feature\nstatus: queued\npriority: high\ncommitment: committed\n---\n\n## Summary\n\nUntracked work must be visible.\n");
  return { owned, root, sibling };
}

test("combined large board stays usable in List and Columns at desktop and narrow widths", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const apiFailures = [];
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/api/")) apiFailures.push({ url: response.url(), status: response.status() });
  });
  const { owned, root } = await fixture();
  testInfo.attach("fixture", { body: root, contentType: "text/plain" });
  try {
    await page.goto(`/#repo=${encodeURIComponent(root)}`);
    await expect(page.locator("#board-source-toggle")).toBeVisible();
    await page.locator("#board-source-toggle").click();
    await expect(page.locator('#board-source-menu [data-source-choice="across"]')).toBeEnabled();
    await page.locator('#board-source-menu [data-source-choice="across"]').click();
    await expect(page.locator("#workspace-summary")).toContainText("85 features");
    await expect(page.locator("#editor-title")).toContainText("large-01");
    await expect(page.locator("#editor-source-label")).toBeVisible();
    await expect(page.locator("#editor-source-select option")).toHaveCount(2);
    expect(apiFailures).toEqual([]);
    await page.locator("#editor-source-select").selectOption({ index: 1 });
    await expect(page.locator("#field-status")).toHaveValue("in-progress");
    await expect(page.getByText("Status differs").first()).toBeVisible();
    await expect(page).toHaveURL(/source=/);
    await page.reload();
    await expect(page.locator("#field-status")).toHaveValue("in-progress");
    await expect(page.locator("#editor-source-select option:checked")).toContainText("feature/blue · in-progress");
    await page.getByRole("button", { name: "Unfinished" }).click();
    await expect(page.locator("#editor-source-select option").first()).toContainText("filtered out");
    await page.getByRole("button", { name: "Unfinished" }).click();
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
    await page.locator("#board-source-toggle").click();
    const menuBounds = await page.locator("#board-source-menu").evaluate((menu) => ({
      right: menu.getBoundingClientRect().right,
      boardRight: menu.closest(".board-panel").getBoundingClientRect().right,
    }));
    expect(menuBounds.right).toBeLessThanOrEqual(menuBounds.boardRight + 1);
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
    await expect(page.locator("#editor-source-select option:checked")).toContainText("feature/blue · in-progress");
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

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
    await expect(page.locator("#board-source-status")).toContainText("3 features · 4 appearances");
    await expect(page.locator("#board-source-status")).toContainText("1 missing ref");
    await expect(page.getByText("Also in Lane 02")).toBeVisible();
    await page.locator("#board-source-toggle").click();
    await expect(page.locator("#board-source-menu")).toContainText("1 missing board reference");
    await page.locator("#board-source-menu .board-source-missing summary").click();
    await expect(page.locator("#board-source-menu .board-source-missing li")).toContainText("feature/blue · Lane 02");
    await expect(page.locator("#board-source-menu .board-source-missing li")).toContainText("vanished-feature");
    const url = new URL(page.url());
    const params = new URLSearchParams(url.hash.slice(1));
    params.set("lens", "milestone");
    await page.goto(`/#${params.toString()}`);
    await expect(page.locator("#board-source-status")).toContainText("1 missing ref");
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
    await expect(page.getByRole("button", { name: "Open Ambiguous main" })).toBeVisible();
    await page.getByRole("button", { name: "Open Ambiguous main" }).click();
    await expect(page.locator("#item-participants-status")).toHaveText("Association ambiguous");
    expect(participantReads).toEqual([]);
  } finally {
    await fs.rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
