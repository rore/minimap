---
id: idea-derived-roadmap-lenses
title: Derived roadmap lenses
status: queued
priority: medium
commitment: uncommitted
labels:
  - ui
  - navigation
  - views
---

## Summary

Allow the same roadmap files to be viewed through alternate grouping lenses such as board group, milestone, status, type, or label.

## Why

Elastic's roadmap is effective partly because users can navigate the same underlying work through multiple organizational cuts. Minimap should support alternate read lenses too, but they must be computed from the existing files rather than stored as UI-only structure.

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

This should be treated as a browse layer over the current editor-first workflow, not as a replacement for it.