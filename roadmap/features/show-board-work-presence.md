---
id: show-board-work-presence
title: Show work context on roadmap boards
status: done
priority: high
commitment: committed
labels:
  - board
  - collaboration
---

## Summary

Make current work easier to scan in List and Columns while preserving file-backed roadmap state.

## Why

Large boards hide active and blocked work among completed items. Participant detail exists only after opening an item, and numeric priority lacks a clear visual meaning.

## In Scope

- Show optional Pallium attached-session counts on board cards through one bounded roadmap-wide read, with item details remaining in the existing panel.
- Distinguish active and blocked item states, explain numeric priority, and make existing filters and column collapse useful for focusing on an unfinished milestone.
- Add short Minimap-owned pickup, pause, resume, handoff, and completion guidance for a manager-designated shared checkout.
- Verify List and Columns with synthetic dense data at desktop and narrow widths, including absent and unavailable Pallium states.

## Out of Scope

- Session activity or ownership claims from an association; a milestone-state system; canonical board reordering; cross-worktree auto-sync.

## Done When

- Both layouts show correct participant presence without per-card calls or false zero on failure, with bounded visible-only refresh and repo-switch safety.
- Active/blocked work and priority remain legible on dense boards, and current milestone focus uses existing controls without changing canonical order.
- Packaged guidance, tests, rendered captures, and independent review agree with the released behavior.

## Notes

Shipped the agreed bounded roadmap-wide Pallium presence read, board focus and status signals, and pickup/handoff guidance in both packaged skills. Synthetic attach/detach and dense List/Columns browser checks passed; Pallium roadmap data was not changed. Attached sessions indicate association, not activity or ownership.
