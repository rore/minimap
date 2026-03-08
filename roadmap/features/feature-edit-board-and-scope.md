---
id: feature-edit-board-and-scope
title: Edit board and scope from the UI
status: done
priority: high
commitment: committed
labels:
  - ui
  - authoring
---

## Summary

Add first-class editing for `board.md` and `scope.md` so roadmap authors can manage grouping, ordering, and current focus from the UI.

## Why

The product was not fully self-hosting while board structure and scope narrative still required raw markdown edits.

## In Scope

- edit `scope.md` in the UI
- edit board group names
- move items between board groups
- reorder items within a group
- save those changes back to `board.md`

## Out of Scope

- arbitrary board views derived from filters
- multi-select bulk reordering
- automated prioritization

## Done When

- a user can update current focus without leaving the UI
- a user can regroup and reorder roadmap items from the UI
- board grouping remains canonical in `board.md`

## Notes

Shipped with markdown scope rendering plus scope edit/save, board draft editing for group names and item placement, and canonical writes back to `board.md` and `scope.md` without introducing UI-only roadmap state.
