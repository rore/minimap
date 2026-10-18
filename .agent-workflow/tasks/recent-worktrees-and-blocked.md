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
**Plan review:** Pending concrete recency rule and clean-context review.
**Approvals:** User requested "so we should do top recent 25. also, shouldn't in play also show blocked features?"; concrete recency definition remains to be confirmed.
**State:** Blocked or returned to planning
<!-- agent-workflow:end -->

## Recovery

Discovery only; no product edits. Owner checkout `C:/Dev/rore/minimap/.local/preserve-board-view-state`, branch `feat/recent-worktrees-and-blocked`, base `609eda0`. Resolve recency semantics and obtain the required plan review before implementation. Preserve unrelated artifacts/build directories and the live service.

## Proposed recency rule

Rank by the last complete local HEAD reflog entry timestamp, read from a bounded tail, not commit-author dates or index/reflog file mtime. Read cheap candidate metadata in bounded batches without a full file-tree walk or Git process per excluded candidate. Missing/malformed/oversized final entry gives unknown activity sorted last; ties use canonical path. Always retain the opened checkout, then admit up to 24 validated siblings. Prunable/missing candidates are excluded before allocation; selected identity failures are backfilled from remaining ranked candidates. Existing context identity validation remains authoritative, not the cheap ranking metadata. A fresh discovery/board validation updates ranking; existing 30-second cached board semantics remain. Plain uncommitted edits are not observed. No watcher or presence service.
