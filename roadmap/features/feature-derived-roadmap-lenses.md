---
id: feature-derived-roadmap-lenses
title: "Derived roadmap lenses"
status: done
priority: high
commitment: committed
labels:
  - ui
  - navigation
  - views
milestone: ""
---

## Summary

Allow the same roadmap files to be viewed through alternate grouping lenses such as board group, milestone, status, type, or label.

## Why

The roadmap files may support more than one useful organizational cut, and minimap should help humans inspect that without inventing parallel state. Derived lenses strengthen visibility and prioritization while preserving `board.md` as the canonical board view.

## In Scope

- a default view that respects canonical `board.md` grouping
- alternate derived views for metadata the repo already uses
- clear indication that these are presentation lenses over the same file-backed items
- stable deep links to the active lens

## Out of Scope

- separate per-view board ordering stored outside `board.md`
- bespoke data models for each view type
- forcing repos into fixed workflow columns

## Done When

- a repo can browse the same roadmap by more than one grouping without duplicating items
- alternate lenses degrade gracefully when the relevant metadata is absent
- the canonical ownership rules for group names and order remain intact

## Notes

This should follow search because alternate lenses become much more useful once users can already navigate quickly.
