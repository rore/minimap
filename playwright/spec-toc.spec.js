import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

// The repo= hash param tells the workspace which repo to load. The roadmap
// test does the same — we just need it for the spec view to scope sessions.
const repoHashParam = `repo=${encodeURIComponent(process.cwd())}`;

// Write the fixture under docs/ so the workspace path is one a real spec
// session can address. The afterAll hook deletes it; if that hook is skipped
// (e.g. test runner crash) git will surface a stray file, which is fine —
// the file is small and easy to delete.
const fixturePath = path.join(process.cwd(), "docs", "playwright-toc-fixture.md");

// Forward-slash variant for the API + URL — Windows backslashes don't
// survive encodeURIComponent + server-side path comparison cleanly.
const fixturePosix = fixturePath.replaceAll("\\", "/");

const fixtureContent = `# Test Spec

Intro paragraph with enough text to make scrolling meaningful. ${"Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(6)}

## First Section

Body of first section. ${"Lorem ipsum dolor sit amet. ".repeat(50)}

### Sub of First

A subsection. ${"Body content here. ".repeat(30)}

## Second Section

Body of second. ${"More content. ".repeat(50)}

### Sub of Second

Another subsection. ${"Padding. ".repeat(30)}

## Third Section

Body of third. ${"Final content. ".repeat(50)}

## Fourth Section

Body of fourth. ${"Last bit. ".repeat(30)}
`;

test.describe("spec TOC", () => {
  test.beforeAll(async () => {
    await fs.writeFile(fixturePath, fixtureContent, "utf8");
  });

  test.afterAll(async () => {
    await fs.unlink(fixturePath).catch(() => {});
  });

  test.beforeEach(async ({ request }) => {
    // Attach the fixture as a spec session via the API. Idempotent — the
    // server returns { created: false } on a re-attach.
    const resp = await request.post("/api/spec-sessions/attach", {
      data: { file: fixturePosix },
    });
    expect(resp.ok(), `attach failed: ${resp.status()} ${await resp.text()}`).toBe(true);
  });

  test("renders headings, jumps on click, and persists collapsed state", async ({ page }) => {
    const url = `/#${repoHashParam}&view=spec&file=${encodeURIComponent(fixturePosix)}`;
    await page.goto(url);

    // Reset persisted state from any previous run, then re-navigate so the
    // TOC initializes with the cleared (default = expanded) value.
    // localStorage is per-origin so a previous run can leave "true" behind.
    await page.evaluate(() => {
      try {
        window.localStorage.removeItem("minimap.spec.toc.collapsed");
      } catch (_err) {
        // ignore
      }
    });
    await page.goto(url);

    // The spec view should mount and the TOC should populate from the
    // rendered body. Six headings (4x H2 + 2x H3) — the H1 is the doc title
    // and is excluded from the TOC by design.
    const tocList = page.locator("#spec-toc-list");
    await expect(tocList.locator(".spec-toc-link")).toHaveCount(6, { timeout: 10_000 });

    // First link is the first H2 — confirm it surfaced the right text.
    const firstLink = tocList.locator(".spec-toc-link").first();
    await expect(firstLink).toContainText("First Section");

    // H3 entries get .is-sub for the indent treatment.
    await expect(tocList.locator(".spec-toc-link.is-sub")).toHaveCount(2);

    // Click a later link and verify the matching heading scrolls near the
    // top of the spec doc, AND that link becomes the active one.
    const links = tocList.locator(".spec-toc-link");
    const targetLink = links.nth(3); // somewhere in the middle of the list
    const targetId = await targetLink.getAttribute("data-spec-toc-target");
    expect(targetId, "target link must carry a data-spec-toc-target id").toBeTruthy();

    await targetLink.click();

    // Smooth-scroll runs on the .spec-doc container. Give it time, then
    // assert the heading top is close to the doc container top.
    await page.waitForTimeout(800);
    const headingTopDelta = await page.evaluate((id) => {
      const el = document.getElementById(id);
      const doc = document.getElementById("spec-doc");
      if (!el || !doc) return null;
      return el.getBoundingClientRect().top - doc.getBoundingClientRect().top;
    }, targetId);
    expect(headingTopDelta, "heading + doc must both exist after click").not.toBeNull();
    // Smooth scroll lands the heading within ~100px of the doc top.
    expect(Math.abs(headingTopDelta)).toBeLessThan(120);

    await expect(targetLink).toHaveClass(/is-active/);

    // Toggle collapse, reload, verify state persisted via localStorage.
    const tocEl = page.locator("#spec-toc");
    const toggle = page.locator("[data-spec-toc-toggle]");

    await expect(tocEl).toHaveAttribute("data-collapsed", "false");
    await toggle.click();
    await expect(tocEl).toHaveAttribute("data-collapsed", "true");

    // Re-navigate (goto, not reload) for robustness against any future hash
    // mutation; the persisted-state assertion that follows is what we actually
    // care about: localStorage drives the initial paint regardless of how we
    // got back to the spec view.
    await page.goto(url);
    // Wait for spec view to mount — the spec body renders the H1 from the
    // fixture once the file has loaded. The TOC links exist in the DOM but
    // their nav container is hidden by CSS while collapsed, so we anchor on
    // the visible body content instead.
    await expect(page.locator(".spec-body-markdown h1")).toContainText("Test Spec", {
      timeout: 10_000,
    });
    // Persisted state survived: TOC initializes collapsed.
    await expect(page.locator("#spec-toc")).toHaveAttribute("data-collapsed", "true");

    // And it must re-expand cleanly when toggled back.
    await page.locator("[data-spec-toc-toggle]").click();
    await expect(page.locator("#spec-toc")).toHaveAttribute("data-collapsed", "false");
  });
});
