---
id: add-in-play-quick-filter
title: Focus the board on items in play
status: in-progress
priority: high
commitment: committed
labels:
  - board
  - collaboration
---

## Summary

Add an In play quick filter for items whose status is in-progress OR which have any attached, nonclosed session, including dormant sessions.

## Why

Readers need a focused view of ongoing work and associated sessions without confusing association with current execution.

## In Scope

- List, Columns, all lenses, search, metadata, and independent Unfinished composition.
- Route persistence and Clear following existing filter conventions.
- Completed attached items when Unfinished is off; completed candidates join the existing bounded batch only when needed.
- Loading, unavailable, unsupported, and partial results remain visibly incomplete; known in-progress items remain visible.
- Refresh rederives membership after attachment, detach, or close.
- Pure, backend, browser, batching, dense-board, desktop, and narrow verification; both packaged skills and mirrors aligned.

## Out of Scope

New services, dependencies, automatic lifecycle changes, per-card lookups, and changes to real Pallium project data.

## Done When

The OR predicate and AND composition work, edge cases and bounded fetching are tested, rendered dense boards are inspected, and independent plus manager review and delivery gates pass.

## Notes

Accepted 2026-09-28 from minimap-manager. Root is the sole canonical roadmap writer in C:\Dev\rore\minimap; branch feat/in-play-quick-filter. Preserve unrelated artifacts. Existing Agent Workflow is not configured and will not be installed.

Implementation and independent smart-model review are complete. Local Node verification: 304 passed and two documented Windows signal skips, followed by focused compatibility and mirror checks. Browser verification: all three new dense-board tests passed; the full run had 97 passes, one duplicate-phrase spec anchoring failure, and 13 skipped tests. The failing test and skipped tail passed together (14/14); three traced anchoring repeats also passed. The original failure remains unexplained, so clean full CI is required before merge.

Read-only rendered QA passed 48 cases across Pallium, Minimap, and dictation boards at desktop and narrow widths, List/Columns, Board/Milestone, and In play with/without Unfinished. No empty filtered groups, overlapping cards, toolbar overflow, or page overflow; real Pallium project data was not changed. Both packaged runtime trees are synchronized. PR/manager acceptance, full CI, and the coordinated shared-server restart remain delivery gates.
