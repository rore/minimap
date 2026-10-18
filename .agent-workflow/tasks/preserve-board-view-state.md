<!-- agent-workflow:start -->
**Outcome:** Board view choices, collapsed groups, and reading position remain stable through feature inspection and refresh; bounded Across worktree coverage is explained accurately.

**Target:** Minimap.

**Scope:** Roadmap board UI preference and viewport lifecycle, source-limit coverage copy, focused browser regressions, and canonical feature documentation.

**Constraints:** Keep roadmap files canonical and personal preferences local. Explicit URL choices take precedence. Preserve source identity, drafts, existing scan bounds, and List/Columns behavior. No live service, installed skill, persistent environment, or real user-data change.

**Completion criteria:** Reloading or reopening a board restores repo/mode-specific controls and group collapse, including Not on a board, unless an explicit URL chooses otherwise; feature open/close and same-view refresh retain applicable List/Columns/narrow scroll positions; source-limit exclusions clearly identify the intentional bound; focused browser checks and inspected desktop/narrow screenshots pass, with badge/related-work observations handed to the manager without an unsupported fix claim.

**Requirement baseline:**
{"source":"roadmap/features/preserve-board-view-state.md@initial-2026-10-18","outcome":"Board view choices, collapsed groups, and reading position remain stable through feature inspection and refresh; bounded Across worktree coverage is explained accurately.","scope":"Roadmap board UI preference and viewport lifecycle, source-limit coverage copy, focused browser regressions, and canonical feature documentation.","constraints":"Keep roadmap files canonical and personal preferences local. Explicit URL choices take precedence. Preserve source identity, drafts, existing scan bounds, and List/Columns behavior. No live service, installed skill, persistent environment, or real user-data change.","completion_criteria":"Reloading or reopening a board restores repo/mode-specific controls and group collapse, including Not on a board, unless an explicit URL chooses otherwise; feature open/close and same-view refresh retain applicable List/Columns/narrow scroll positions; source-limit exclusions clearly identify the intentional bound; focused browser checks and inspected desktop/narrow screenshots pass, with badge/related-work observations handed to the manager without an unsupported fix claim."}

**Relationships:**
{"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:preserve-board-view-state"}],"pull_requests":[]}

**Risk:** High

**Complexity:** Moderate

**Reason:** Browser acceptance regressions under `playwright/**` are a redline-protected contract surface; preference and navigation behavior crosses several UI paths. Multiple interaction states and actual visual checks make this Moderate.

**Discovery:** URL hash stores search, filters, In play, lens, and layout (`ui/app.js` readRouteState/buildRouteHash); the bare route has no remembered defaults and default values are omitted. Collapse is only an in-memory Set keyed by repo/lens/group, so reload loses it and This/Across can collide. `renderBoard(true)` preserves current scroll, but item open/close and list collapse call default `renderBoard()`; narrow CSS scrolls the page. Source discovery caps at 16 in `src/worktree-sources.js` and emits `source-limit` exclusions; the UI currently says only “Checkout limit reached.” Existing Playwright covers column reorder/collapse scroll but not feature navigation or durable preferences.

**Material assumptions:** The preference store can use browser localStorage without changing server state; malformed/quota-denied storage must fall back safely. A new explicit board-route marker can distinguish an intentionally cleared/default view from missing route preferences; existing deep links with board-control parameters remain authoritative. If browser navigation reveals another ownership rule, return to planning before changing precedence.

**Plan:** First review this record and the immutable baseline before code. In `ui/app.js`, use one versioned, bounded localStorage preference keyed by repository and This/Across mode for last board controls; treat an explicit board-route marker or existing board-control parameters as an authoritative complete route, and write the marker on user control changes so Clear, reload, and Back cannot resurrect stored values. Retain configured defaultLens for repositories without saved/explicit choice. Store collapse by repo/mode/lens/stable group key including Across `unlisted:*`; do not edit canonical roadmap data. Consolidate same-view viewport capture/restore around board DOM replacement: List board vertical, Columns horizontal and per-column vertical, plus page scroll on stacked narrow layouts; avoid restoring a different repo/mode/lens/layout/filter view. Preserve focus and drafts. Clarify the existing 16-source bound and individual exclusion reasons in source UI only; do not alter discovery. Add focused browser scenarios for storage precedence, isolation, collapse, open/close, refresh and narrow rendering; inspect actual List/Columns desktop/narrow screenshots. Stop for materially different source coverage, storage semantics, or test failures that call the approach into question.

**Verification plan:** Remembered controls and collapse versus explicit URL → browser checks for clear/reload/back, repo/mode/lens isolation, malformed/quota storage fallback, and Not on a board. Stable reading position → browser checks for List/Columns/narrow viewport and focus through feature open/close and same-view manual/background refresh, with no cross-view scroll leak. Honest bounded coverage → a >16-worktree fixture checks intentional source-limit copy and exclusions without changing scan budget. Visual quality → inspect actual desktop and narrow screenshots for both layouts. Delivery and investigation → run relevant Node/browser checks, mirror sync if runtime changes, workflow/redline checks, and diff check; record the manager-owned badge/related-work investigation status without claiming a fix.

**Plan review:** Pending clean-context technical review by manager; implementation is held at the planning checkpoint.

**Approvals:** User authorized fixes, regression tests, actual List and Columns visual checks, review, and merge on 2026-10-18. Exact plan-review approval reference pending manager handoff; implementation is held.

**Exceptions:** —

**State:** Blocked
<!-- agent-workflow:end -->

## Implementation

2026-10-18: Created isolated `feat/preserve-board-view-state` checkout at `C:/Dev/rore/minimap/.local/preserve-board-view-state` from `5072122c7353f7519c1aeda4fcac072682b55b26`. Added the canonical feature and Now placement before implementation edits. The exact Minimap item-reference CLI returned the Relationships tuple above. Diagnosis and plan are recorded; no product code, tests, live service, installed skill, or user data changed. Awaiting manager's clean-context plan review and release.

## Evidence

Initial source inspection: `package/minimap/ui/app.js` route, render, scroll, refresh and source-coverage functions; `ui/state.js`, `ui/filters.js`, `ui/worktrees.js`, `ui/styles.css`, `src/worktree-sources.js`, and existing Playwright board tests. CLI item-ref result: `roadmap:v1:git:github.com/rore/minimap#roadmap` / `item:v1:preserve-board-view-state`. Baseline revision `5072122c7353f7519c1aeda4fcac072682b55b26`.

## Result review

Pending implementation and independent review. Missing-badge and related-work observations are manager-owned acceptance investigation, not resolved by this planning record.
