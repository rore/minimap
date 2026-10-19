<!-- agent-workflow:start -->
**Outcome:** Collapsed linked-task headers show known task counts, and board search accepts typed spaces without moving the caret or changing matching semantics.

**Target:** Minimap roadmap UI.

**Scope:** Task-header count rendering and focused search-input synchronization; focused browser regressions, owning roadmap notes and generated UI mirrors.

**Constraints:** Preserve partial/stale/unavailable truth, pagination totals, normalized matching, route/Clear behavior, source guards and existing APIs. Do not update the installed app or shared server.

**Completion criteria:** Known total counts, including zero and paginated totals, remain visible with partial/stale status when collapsed; unknown loading/unavailable data omits a count. Typed multiword search, repeated spaces, backspace and caret editing work in List and Columns; Clear and route changes update the input correctly.

**Requirement baseline:** 
{"source": "work-record-initial", "outcome": "Collapsed linked-task headers show known task counts, and board search accepts typed spaces without moving the caret or changing matching semantics.", "scope": "Task-header count rendering and focused search-input synchronization; focused browser regressions, owning roadmap notes and generated UI mirrors.", "constraints": "Preserve partial/stale/unavailable truth, pagination totals, normalized matching, route/Clear behavior, source guards and existing APIs. Do not update the installed app or shared server.", "completion_criteria": "Known total counts, including zero and paginated totals, remain visible with partial/stale status when collapsed; unknown loading/unavailable data omits a count. Typed multiword search, repeated spaces, backspace and caret editing work in List and Columns; Clear and route changes update the input correctly."}

**Relationships:** 
{"schema_version": 1, "sources": [{"provider": "minimap", "scope_ref": "roadmap:v1:git:github.com/rore/minimap#roadmap", "local_ref": "item:v1:show-feature-related-work"}, {"provider": "minimap", "scope_ref": "roadmap:v1:git:github.com/rore/minimap#roadmap", "local_ref": "item:v1:feature-search-and-filters"}], "pull_requests": []}

**Risk:** High

**Complexity:** Simple

**Reason:** Focused UI changes; protected Playwright acceptance paths require architecture review.

**Discovery:** renderRelatedWork drops totals in every non-ok summary branch. The search input handler trims/lowercases each keystroke and renderBoardFilterControls writes that normalized state back into the focused input, deleting a trailing typed space and moving the caret. Existing filters and URL state expect normalized queries.

**Material assumptions:** A validated total is the pagination-wide count. Unavailable responses without retained rows do not establish a known zero. Input synchronization can keep raw focused text when it normalizes to the current state, while genuine query changes still replace it; tests will verify route and Clear behavior.

**Plan:** Render a shared task header prefix with a safe known total, then retain existing status suffixes. Preserve a focused input when its normalized value already equals state; update when unfocused or query semantics change. Add focused status/count and keyboard/search cases; reconcile two owning roadmap notes, inspect desktop/narrow screenshots and sync mirrors. No cache or backend changes.

**Verification plan:** test: Known/unknown, zero, partial/stale and pagination-wide counts -> focused Playwright count test. test: Space, repeated-space, backspace, caret, route and Clear behavior in both layouts -> focused keyboard browser tests plus existing search regression. manual: Actual desktop and 390px narrow screenshots. test: UI filters, HTML/promise lint, runtime mirror parity, workflow/redline checks.

**Plan review:** Pending independent agent technical review before product edits.

**Approvals:** Approved by user 2026-10-19: "1. in the task linked to this feature header, can we show the number of tasks (e.g. (2) ) - so  you don't need to open to know if there are tasks. 2. in the search box, i can't search for multiple words - i can't enter a space" (source request cd6b01f8-7396-4229-b518-1a7ae0fabfc3).

**Exceptions:** —

**State:** Ready to implement
<!-- agent-workflow:end -->

## Implementation

Isolated checkout `.local/task-count-search`, branch `feat/task-count-search`, starts at `833ae31`. Planned files: `package/minimap/ui/app.js`, generated runtime app mirrors, focused cases in `playwright/snapshot-refresh.spec.js`, and owning roadmap notes `roadmap/features/show-feature-related-work.md` and `roadmap/features/feature-search-and-filters.md`. No product edits yet.
