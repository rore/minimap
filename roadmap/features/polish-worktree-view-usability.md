---
id: polish-worktree-view-usability
title: Make worktree views responsive and easier to read
status: done
priority: high
commitment: committed
---

## Summary

Follow up on the shipped worktree view with the user's real-board QA: reliable In play matching, immediate source-menu opening, compact source controls, readable version differences, and understandable coverage.

## Why

Active features disappear from In play, source discovery blocks a basic interaction, and version controls and unexplained counts crowd a viewer intended to stay simple.

## In Scope

- Recognize active and in-progress consistently in In play, including when participant results are unavailable. Keep any confirmed attached nonclosed session, including dormant associations, in the OR predicate.
- Open the source menu immediately. Reuse discovered choices and refresh asynchronously without waiting for aggregate parsing, ancestry, or Pallium. Keep request deduplication and stale-response protection local and small.
- Place a compact board source selector beside the repository heading, wrapping cleanly on narrow screens.
- Compact item version control near the title. Expanded versions show distinguishable branch names, status, and differences relative to the selected version; paths are secondary details. Preserve keyboard and touch access.
- Show understandable feature counts and an explicit partial-coverage cue. Explain loaded sources, repeated placements, and exclusions on demand without implying complete repository coverage.
- Fix adjacent defects found in these flows. Preserve exact-source selection, draft protection, write-boundary validation, conservative feature identity, and honest partial participant results.

## Out of Scope

New presence or caching services, assignment systems, full diff editors, changing real project data, raising discovery limits without evidence, and the separate server process-lifetime problem.

## Done When

- Generic regression checks cover active status, unavailable/partial presence, asynchronous failures and stale responses, repeated menu opening, long branches, and partial discovery.
- Actual screenshots and interaction checks pass for List and Columns at desktop and narrow widths, including the expanded controls. Cold menu opening does not wait for a full scan; warm reopening reuses available choices.
- Required tests, mirror synchronization, documented-behavior drift check, review, and delivery pass on the final change.
- Cached menu refresh never changes an editor's captured source or draft. Cover delayed repository-A responses after switching to B and checkout replacement while a draft is open.
- Version differences compare the selected version even when filtered out, and disclose content-only differences using existing revision evidence.
- Discovery, loaded-roadmap coverage, and participant coverage remain distinct. A failed refresh marks retained data as last-known; discovered but unreadable roadmaps never imply complete coverage.

## Notes

Authorized 2026-09-30. Minimap-manager owns the canonical roadmap and acceptance; Minimap-dev is the requested implementation owner. This is a QA follow-up to add-worktree-aware-roadmap-view, which remains shipped. No real Pallium or dictation roadmap files may be changed during QA.

Manager baseline on 2026-09-30, shared server at main 157cd24, read-only dictation_app List / This checkout: cards rendered in 476 ms; source menu first open 11,089 ms and reopen 11,596 ms. Both openings requested the full worktree aggregate. These are observed timings, not performance guarantees. Astra's bounded plan review accepted the direction with the cache/source, content-difference, and coverage safeguards above.

Implemented in PR #33: https://github.com/rore/minimap/pull/33. Manager accepted production head 60b773e after review of the same-repository delayed-retry guard, status badges, removal of repeated repository labels, and loaded/excluded coverage wording. Three delayed-success/error regression cases protect newer scope selections. Focused worktree browser checks passed 15/15, follow-up delayed/partial checks 4/4, and mirror verification passed. Earlier full suites at 91b95e2 passed 123 browser tests and 356 Node tests with 2 Windows skips; required CI on the final PR head remains the delivery gate.

Manager read-only preview acceptance covered dictation_app and Pallium, both layouts at 1440 and 390 pixels: menu openings 31–45 ms, no page overflow or JavaScript errors, and no project-write requests. Dictation In play showed its three active features. Actual board/menu and desktop/narrow version screenshots were inspected. The adjacent spec-selection fix preserves an open composer's quote during document rerender and has a focused regression. The separate Codex/server process-lifetime issue is outside this delivered scope.
