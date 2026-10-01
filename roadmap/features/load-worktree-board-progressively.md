---
id: load-worktree-board-progressively
title: Keep the board usable while worktrees load
status: done
priority: high
commitment: committed
---

## Summary

Show a source-validated opened-checkout board promptly while the full worktree aggregate loads asynchronously. Preserve visible content and current user intent during refresh.

## Why

PR #33 removed the source-menu wait but left the board blank during the full scan. User QA exposed this incomplete response to the original nonblocking-refresh request.

## In Scope

- Explicit provisional coverage and incomplete In play/participant results until the full response arrives.
- No sibling discovery, ancestry scan, or participant wait before opened-checkout cards render.
- Preserve filters, lens, layout, current source, drafts, save revisions, explicit editor close, focus, and scroll during reconciliation.
- Keep usable data on full-refresh failure; retry safely and ignore obsolete responses. A failed provisional request must not prevent a successful full result.
- Actual pending and settled screenshots and interactions in List/Columns at desktop/narrow widths; source-menu mouse usability fixes found during QA.

## Out of Scope

New services, schedulers, assignment systems, real project data edits, raising the 16-checkout cap, and mobile empty-detail-pane layout redesign.

## Done When

Delayed-response regressions, final CI, code review, rendered acceptance and shared-runtime deployment pass. Inspect time to usable cards rather than menu opening alone.

## Notes

Minimap-manager owns canonical roadmap and acceptance; Minimap-dev implements on feat/async-worktree-board. PR #34: https://github.com/rore/minimap/pull/34.

Developer measured first cards around 2.2 seconds versus full aggregation around 11 seconds for dictation_app and 58 seconds for Pallium. These are observations, not guarantees. Full scan cost and the separate coverage cap remain visible limitations.

At head 4a6824c, the startup route replay regression is fixed. Manager independently verified initial Columns mode retains Unfinished through full settlement and URL update, and inspected the rendered screenshot. Developer reports 21 async browser passes, 15 existing worktree UI passes, and 25 focused Node passes; the earlier full Node run passed 358 with 2 expected Windows skips.

Final CI passed on d22020d. PR #34 merged as 146c3fd and was deployed through the packaged restart to port 4312 on 2026-09-30, retaining participant lookup and links. Manager's live held-response checks showed first cards in 1.912 seconds for dictation_app and 1.755 seconds for Pallium, with explicit provisional coverage and Unfinished retained after settlement. Both pending screenshots were inspected; no browser errors were observed. Full scan duration remains variable, and the 16-checkout cap and narrow empty-detail-pane issue remain separate follow-ups.
