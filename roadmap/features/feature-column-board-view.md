---
id: feature-column-board-view
title: Column board view
status: done
priority: medium
commitment: committed
---

## Summary

Add a second board presentation mode that shows the current grouping source as compact horizontal columns for easier roadmap management.

## Why

List mode remains the best default for scanning, but some roadmap operations are faster in a kanban-like layout. A column board makes it easier to move items between canonical board groups, status values, or version buckets without introducing a second planning model.

## In Scope

- a `Columns` layout toggle next to the existing `List` layout
- columns derived from the current `Group by` source instead of a separate saved board model
- dedicated drag handles for moving items between board groups or draggable metadata values
- card clicks that still open the normal read-first item pane
- compact column UI that keeps the main board usable on desktop and medium-width layouts
- URL state for the active column layout together with grouping, filters, and selection

## Out of Scope

- workflow-specific kanban semantics forced onto every repo
- drag-based reordering within a single column
- a second source of truth for board state
- custom drag behavior for fields that are not already safe to move canonically

## Done When

- users can switch between list and column layouts without losing the current grouping source
- board-group moves rewrite `board.md` canonically
- metadata-backed column moves update the underlying item frontmatter canonically
- non-draggable grouping sources stay browse-only in columns mode
- the column view remains compact enough to be useful instead of becoming a novelty layout

## Notes

This feature keeps `Group by` as the single grouping source and uses `Columns` only as an alternate presentation. The final UI uses drag handles rather than whole-card dragging so opening an item and moving it remain clearly separate actions.
