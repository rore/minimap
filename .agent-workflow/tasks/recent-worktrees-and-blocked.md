<!-- agent-workflow:start -->
**Outcome:** Show the most recent local worktrees within a 25-checkout budget and include blocked features in In play.
**Target:** Minimap source discovery and shared board filtering.
**Scope:** Rank eligible worktrees by defined cheap local recency, raise the cap to 25, stop stale entries consuming slots, include blocked status in In play, and update contracts, UI copy and regressions.
**Constraints:** Always retain the opened checkout; preserve source identity, partial coverage, cancellation, bounded asynchronous work, existing filters and attached-session semantics. No live environment changes or new dependencies.
**Completion criteria:** Deterministic recent selection and cap behavior are tested; blocked status matches across board modes and layouts; 25-source qualification shows independent service/UI progress; reviewed implementation and delivery evidence are recorded.
**Requirement baseline:**
{"source":"user-request:2026-10-18:recent-25-and-blocked","outcome":"Show the most recent local worktrees within a 25-checkout budget and include blocked features in In play.","scope":"Rank eligible worktrees by defined cheap local recency, raise the cap to 25, stop stale entries consuming slots, include blocked status in In play, and update contracts, UI copy and regressions.","constraints":"Always retain the opened checkout; preserve source identity, partial coverage, cancellation, bounded asynchronous work, existing filters and attached-session semantics. No live environment changes or new dependencies.","completion_criteria":"Deterministic recent selection and cap behavior are tested; blocked status matches across board modes and layouts; 25-source qualification shows independent service/UI progress; reviewed implementation and delivery evidence are recorded."}
**Relationships:** {"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:recent-worktrees-and-blocked"}],"pull_requests":[]}
**Risk:** High
**Complexity:** Moderate
**Reason:** Canonical CONTRACT.md and agent-facing references are protected behavior contracts; discovery ranking changes coverage. No identity or write-guard rules change.
**Discovery:** Current discovery retains the opened source then inspects the first 15 Git-listed candidates, counting prunable/unreadable entries. No recency sorting. Shared filters.js allows active/in-progress or confirmed attachments and explicitly excludes blocked without attachments. Aggregate lineage compares source pairs, increasing from 120 at 16 to 300 at 25; bounded concurrency must remain.
**Material assumptions:** Recency needs an explicit inexpensive local signal; commit-author date is not checkout activity. Uncommitted edits may not be captured by Git metadata. Discovery is read-only and must not refresh the Git index to manufacture activity.
**Plan:** Complete bounded recency discovery and independent plan review before product edits. Preserve existing source admission and caching, use stable deterministic ranking and replace invalid candidates within the admitted budget. Extend the one shared In play predicate. Update documented semantics and focused tests; sync mirrors and qualify 25-source service responsiveness and both rendered layouts.
**Verification plan:**
test: selection and cap fixtures covering more than 25 sources, stale/missing candidates, ties, missing timestamps, opened source and cancellation.
test: shared filter and Across projection regressions for blocked, participant failure and filter composition.
manual: inspect List and Columns with blocked fixtures; reuse and extend isolated performance harness to 25 sources.
**Behavior changes:** [{"target":"repository-contract","path":"playwright/async-worktree-ui.spec.js","classification":"coverage-only","before":"Source-limit and existing In play browser coverage.","after":"Updated source-limit wording and blocked-status regression coverage in both board modes/layouts.","reason":"Verify the user-approved25-source and blocked behavior without weakening existing obligations."},{"target":"repository-contract","path":"playwright/worktree-ui.spec.js","classification":"coverage-only","before":"Existing Across worktree browser coverage.","after":"Additional blocked In play coverage in This/Across and List/Columns with unavailable participants and filter composition.","reason":"Exercise the shared approved status behavior through rendered boards."}]
**Plan review:** Agent technical review: /root/performance_plan_review independently reviewed b02da37 and passed with refinements: bounded final complete HEAD reflog timestamp; canonical admin-path confinement; fixed metadata concurrency; deterministic unknown-last ranking; authoritative identity admission and backfill; 25-source performance qualification. Refinements accepted.
**Approvals:** Approved by user 2026-10-18: "Approve this rule". This approves the concrete 25-checkout rule and blocked In play behavior. Opened checkout plus 24 eligible siblings ranked by latest recorded local Git event; plain edits do not change rank; unknown timestamps last. No live environment changes authorized.
**State:** Blocked or returned to planning
<!-- agent-workflow:end -->

## Recovery

Plan review and human approval complete; implementation next. Owner checkout `C:/Dev/rore/minimap/.local/preserve-board-view-state`, branch `feat/recent-worktrees-and-blocked`, base `609eda0`. Preserve unrelated artifacts/build directories and the live service.

## Proposed recency rule

Rank by the last complete local HEAD reflog entry timestamp, read from a bounded tail, not commit-author dates or index/reflog file mtime. Read cheap candidate metadata in bounded batches without a full file-tree walk or Git process per excluded candidate. An unfinished appended record is ignored in favor of the last complete entry; a missing/malformed/oversized complete final entry gives unknown activity sorted last; ties use canonical path. Always retain the opened checkout, then admit up to 24 validated siblings. Prunable/missing candidates are excluded before allocation; selected identity failures are backfilled from remaining ranked candidates. Existing context identity validation remains authoritative, not the cheap ranking metadata. A fresh discovery/board validation updates ranking; existing 30-second cached board semantics remain. Plain uncommitted edits are not observed. No watcher or presence service.

## UI implementation and evidence

2026-10-18: The shared `itemMatchesFilters` In play predicate now accepts normalized `blocked` alongside active/in-progress and confirmed non-closed participant attachments. Search and metadata filters still compose with AND, and Across still tests each version independently. The In play button tooltip names blocked. Source-limit copy now describes at most 25 selected checkouts, distinguishes unselected worktrees from unreadable ones, and says recency uses local Git events rather than uncommitted edits. The existing source-limit browser assertion and new blocked This/Across browser case are updated.

Focused pure filter and Across projection tests passed 34/34. Two isolated packaged-browser cases passed: the blocked scenario in This and Across, List and Columns, with participant lookup forced unavailable and explicit status filters; and the existing source-limit disclosure with the updated 25-selection wording. Actual screenshots under `artifacts/recent-worktrees-and-blocked/` show blocked cards at desktop and 390px widths, including a board-focused narrow List capture. The source-menu copy is captured under `artifacts/board-view-state/source-limit-menu-desktop.png`. All were visually inspected without page overflow. UI HTML-escape and promise lint passed 2/2, and `git diff --check` exited 0. The final mirrored-byte check remains for the shared qualification checkpoint.

## Performance qualification blocker

The25x1000 qualification failed: two concurrent cold project snapshots both exceeded the unchanged30-second request budget (503 snapshot_unavailable). Evidence: tmp/roadmap-performance-1792321948894.json. The25x100 cell passed. Do not claim performance acceptance or increase deadlines; perform bounded bottleneck diagnosis and review the smallest correction before delivery. Live service unchanged.
