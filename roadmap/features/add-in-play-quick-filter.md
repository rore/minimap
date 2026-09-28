---
id: add-in-play-quick-filter
title: Focus the board on items in play
status: done
priority: high
commitment: committed
labels:
  - board
  - collaboration
---

## Summary

In play focuses on items whose status is in-progress OR which have any attached, nonclosed session, including dormant sessions.

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

Completed 2026-09-28 in PR #27: https://github.com/rore/minimap/pull/27. Independent smart-model and manager review accepted production head 11aca9e6e5e6f5d296d7000a6eae48ea7948db16. Full Linux CI 36410165481 attempt 2 passed 306 Node tests, 111 browser tests, and both mirror gates with no skips or failures. All three new dense-board tests passed. A prior local duplicate-phrase anchoring failure passed the exact case plus skipped tail (14/14) and three traced repeats; an initial CI worker-exit hang was not reproduced in exact Node 22.23.2 Linux checks (single test and 130/130 tests in its file). Their original causes remain unexplained; no assertions were weakened.

Read-only rendered QA passed 48 cases across Pallium, Minimap, and dictation boards at desktop and narrow widths, List/Columns, Board/Milestone, and In play with/without Unfinished. No empty filtered groups, overlapping cards, toolbar overflow, or page overflow; real Pallium project data was not changed. Both packaged runtime trees are synchronized.

One authorized packaged same-runtime restart deployed the reviewed implementation on port 4312 (PID 39532, version 0.3.6, API 1); participant lookup and links stayed enabled. Live Pallium verification passed desktop/narrow List/Columns, confirmed includeCompleted=true for all 155 observed board items, composed Unfinished and Clear correctly, and made zero project-write API requests. Deployed screenshots were inspected, including the actual narrow List board after returning from its item pane. The personal spec-review skill was backed up and updated with 39 byte-identical files; owner-managed copies in other repositories were not changed.
