---
id: feature-edit-board-and-scope
title: Edit board and scope from the UI
status: in-progress
priority: high
commitment: committed
labels:
  - ui
  - authoring
---

## Summary

Add first-class editing for `board.md` and `scope.md` so roadmap authors can manage grouping, ordering, and current focus from the UI.

## Why

The product is not fully self-hosting while board structure and scope narrative still require raw markdown edits.

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

Board group reordering is already shipped. The remaining work is scope editing plus item-level and group-level board authoring without creating UI-only ordering state.
