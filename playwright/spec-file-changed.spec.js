import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const repoHashParam = `repo=${encodeURIComponent(process.cwd())}`;

const fixturePath = path.join(process.cwd(), "docs", "playwright-file-changed-fixture.md");
const fixturePosix = fixturePath.replaceAll("\\", "/");

const initialContent = `# File-Changed Fixture

Original line.
`;

const editedContent = `# File-Changed Fixture

Original line.

External edit appended at xxxxxxxx.
`;

test.describe("spec file-changed banner", () => {
  test.beforeAll(async () => {
    await fs.writeFile(fixturePath, initialContent, "utf8");
  });

  test.afterAll(async () => {
    await fs.unlink(fixturePath).catch(() => {});
  });

  test.beforeEach(async ({ request }) => {
    // Re-create initial content in case a previous test edited it.
    await fs.writeFile(fixturePath, initialContent, "utf8");
    const resp = await request.post("/api/spec-sessions/attach", {
      data: { file: fixturePosix },
    });
    expect(resp.ok(), `attach failed: ${resp.status()} ${await resp.text()}`).toBe(true);
  });

  test("shows banner when file changes on disk and clears it on reload", async ({ page }) => {
    const url = `/#${repoHashParam}&view=spec&file=${encodeURIComponent(fixturePosix)}`;
    await page.goto(url);

    // Wait for the spec body to render the original content.
    const body = page.locator("#spec-file-content");
    await expect(body).toContainText("Original line.", { timeout: 10_000 });

    // Banner should be hidden initially.
    const banner = page.locator("#status-banner");
    await expect(banner).toBeHidden();

    // Simulate an external edit (agent or another process).
    await fs.writeFile(fixturePath, editedContent, "utf8");

    // Within the 5 s poll cycle (+ network), the banner should appear with
    // tone="warning" and a Reload action. We give it 15 s to absorb jitter.
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toHaveAttribute("data-tone", "warning");
    await expect(banner.locator(".status-banner-message")).toHaveText("This file changed on disk.");
    const reloadBtn = banner.locator('[data-spec-action="reload-changed-file"]');
    await expect(reloadBtn).toBeVisible();

    // The body should still show the OLD content — we haven't reloaded yet.
    await expect(body).not.toContainText("External edit appended");

    // Click Reload — banner clears and body shows the new content.
    await reloadBtn.click();
    await expect(banner).toBeHidden({ timeout: 5_000 });
    await expect(body).toContainText("External edit appended");
  });

  test("dismissing the banner is transient — next poll re-renders it", async ({ page }) => {
    const url = `/#${repoHashParam}&view=spec&file=${encodeURIComponent(fixturePosix)}`;
    await page.goto(url);
    await expect(page.locator("#spec-file-content")).toContainText("Original line.", { timeout: 10_000 });

    await fs.writeFile(fixturePath, editedContent, "utf8");
    const banner = page.locator("#status-banner");
    await expect(banner).toBeVisible({ timeout: 15_000 });

    // Dismiss with × — banner hides…
    await banner.locator(".status-banner-dismiss").click();
    await expect(banner).toBeHidden();

    // …but next poll (within ~6 s) re-renders it because fileChangedDetected
    // is still true and the on-disk hash still differs from lastSeenContentHash.
    await expect(banner).toBeVisible({ timeout: 15_000 });
  });
  test("marks an unavailable session in the file list", async ({ page }) => {
    await page.route("**/api/spec-sessions", async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      const session = payload.sessions.find((entry) => entry.targetFile === fixturePosix);
      expect(session).toBeTruthy();
      delete session.counts;
      session.availability = {
        status: "unavailable",
        code: "recovery_conflict",
        message: "Target changed during suggestion recovery; no file was overwritten.",
      };
      await route.fulfill({ response, json: payload });
    });
    await page.route(/\/api\/spec-sessions\/by-file\/context\?/, (route) => route.fulfill({
      status: 409,
      json: { error: { code: "recovery_conflict", message: "Target changed during suggestion recovery.", details: null } },
    }));
    await page.goto("/#" + repoHashParam + "&view=spec&file=" + encodeURIComponent(fixturePosix));
    const row = page.locator(".spec-session-row").filter({ hasText: "playwright-file-changed-fixture.md" });
    await expect(row.locator(".spec-session-time")).toHaveText("Recovery conflict");
    await expect(row.locator(".spec-session-time")).toHaveAttribute("title", /Target changed/);
    await expect(row).toHaveAttribute("data-pulse", "unavailable");
    await expect(page.locator(".spec-file-error-card")).toContainText("This session needs recovery.");
    await expect(page.locator("[data-spec-missing-remove]")).toHaveCount(0);
  });

});
