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

**Plan review:** Agent technical review: `/root/scan_review` approved the plan after inspecting the connected input/render/route/Clear and related-work paths. Counts use nonnegative safe totals including zero, preserve uncertainty and pagination; search retains focused raw text only when query semantics match.

**Approvals:** Approved by user 2026-10-19: "1. in the task linked to this feature header, can we show the number of tasks (e.g. (2) ) - so  you don't need to open to know if there are tasks. 2. in the search box, i can't search for multiple words - i can't enter a space" (source request cd6b01f8-7396-4229-b518-1a7ae0fabfc3).

**Behavior changes:** [{"target":"repository-contract","path":"playwright/snapshot-refresh.spec.js","classification":"requirement-change","before":"The browser contract labels a successful empty task result as None and does not require count visibility in partial/stale/collapsed states or keyboard typing of search spaces.","after":"Known task totals appear parenthesized with status and pagination truth; unknown loading/unavailable states omit counts. Keyboard search preserves raw spaces and caret while matching remains normalized in both layouts; route and Clear behavior remain intact.","reason":"The user requested collapsed task counts and repair of the inability to type spaces.","impact":"The old None assertion becomes (0); focused count/status and typed-search regressions are added. No API, matching, cache or source semantics change.","alternatives":"Retaining the old header hides known counts; writing normalized input continues to erase spaces.","authority":{"scope":"task","name":"task-owner"},"approval":{"by":"user","reference":"User request cd6b01f8-7396-4229-b518-1a7ae0fabfc3, 2026-10-19","verbatim":"1. in the task linked to this feature header, can we show the number of tasks (e.g. (2) ) - so  you don't need to open to know if there are tasks. 2. in the search box, i can't search for multiple words - i can't enter a space"}}]

**Exceptions:** —

**State:** Ready for review
<!-- agent-workflow:end -->

## Implementation

Isolated checkout `.local/task-count-search`, branch `feat/task-count-search`, starts at `833ae31`. Planned files: `package/minimap/ui/app.js`, generated runtime app mirrors, focused cases in `playwright/snapshot-refresh.spec.js`, and owning roadmap notes `roadmap/features/show-feature-related-work.md` and `roadmap/features/feature-search-and-filters.md`. Product implementation follows this pre-edit plan.

Implemented the shared count prefix with validated totals (including zero), existing status suffixes and no inferred zero for an unknown unavailable result. Search keeps normalized state/filter/route contracts; `renderSearchControls` now preserves the focused input when its normalized text equals state, avoiding value reassignment and caret movement on ordinary typing. Added focused keyboard and count-status/pagination cases for List and Columns, with desktop/narrow captures. Both runtime mirrors regenerated. No backend/cache changes.

## Evidence

`node C:/Dev/rore/minimap/node_modules/@playwright/test/cli.js test playwright/snapshot-refresh.spec.js --grep "collapsed task header|keyboard search" --reporter=line` passed all four new List/Columns cases. `node --test test/ui-filters.test.js test/ui-lint-html-escape.test.js test/ui-lint-promises.test.js test/sync-mirrors.test.js` passed all 25 checks. `node scripts/sync-mirrors.mjs` regenerated both runtime mirrors; `git diff --check` passed. The broader run passed all 35 browser tests: complete `playwright/snapshot-refresh.spec.js` and `playwright/related-work.spec.js` suites plus the existing `roadmap-ui.spec.js` body-text search/URL and metadata-filter-plus-search cases.

Actual desktop and 390px narrow screenshots were inspected by implementer and parent: known collapsed stale count remains readable, and typed multiword search remains visible with its matching item in both layouts. Captures are under `test-results/snapshot-refresh-{list,columns}-*/`, named `{layout}-task-count-{desktop,narrow}.png` and `{layout}-multiword-search-{desktop,narrow}.png`. Skill-doc keyword checks found no conflicting old description.

## Result review

Agent technical review: `/root/scan_review`, independent non-implementer, approved the final diff on 2026-10-19. No code/test blockers.

Reviewed revision: canonical app SHA256 `0AD06338027AABC7957AD5E2416C524E6DD2EA0AE61CD5594C2CA180C8D46A25`, independently verified identical in both runtime mirrors.

Verification adequacy: reviewer read all four new browser cases and updated zero-count assertion and accepted the reported four browser plus 25 filter/lint/mirror checks as targeted evidence. The subsequent broader 35-case local browser regression passed; full CI remains an owner delivery gate. Reviewer ran no tests and relied on the parent screenshot inspection while the broader test run regenerated artifacts.
