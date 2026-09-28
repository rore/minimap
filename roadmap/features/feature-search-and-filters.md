---
id: feature-search-and-filters
title: Search and dynamic roadmap filters
status: done
priority: high
commitment: committed
labels:
  - ui
  - navigation
  - search
---

## Summary

Add fast search plus dynamic filter controls that derive their options from the roadmap files already present in the repo.

## Why

As roadmap size grows, minimap needs faster navigation more than it needs heavier authoring. Search and dynamic filters make the UI substantially more useful for human review while staying fully file-canonical.

## In Scope

- search by id, title, and visible roadmap text
- search across common metadata already present in files, such as labels, status, commitment, or milestone
- filter chips or similar controls that only appear for fields the repo actually uses
- combining search and filters without creating a second saved roadmap state
- stable URL state for the active search and filter set when practical

## Out of Scope

- introducing required metadata fields just to support filtering
- hosted indexing services or remote search backends
- per-user saved filter presets stored outside the repo

## Done When

- a user can quickly narrow a larger roadmap without leaving the repo-local UI
- the available filter controls change based on real roadmap metadata instead of a fixed schema
- search and filtering operate only on the canonical roadmap files

## Notes

Search and dynamic filters are implemented and improve review and navigation without changing the product's editing model.

2026-09-28 toolbar polish on fix/list-toolbar-wrapping: reproduced Clear orphaned on a third row in the real Dictation board at 390–420px pane widths with Unfinished / Filters (1). Extended the existing compact toolbar layout through 560px and reserved first-row space for Filters/Clear, keeping milestone / Unfinished / In play together below. Wide Columns retains the capped Search field. Both packaged runtime mirrors are synchronized; no filter semantics, backend, or real project data changed.

Verification: the expanded existing Playwright regression passed twice and failed as expected with the old CSS. It covers 320–560px panes, actual Filters (1), label-only Filters (12) geometry stress, readable incomplete-lookup warnings, 390px List/Columns, wide Columns, bounds/non-overlap, and the original mode-row assertions. Read-only browser QA also passed 12 desktop/mobile List/Columns cases across Pallium, Minimap, and Dictation; screenshots were visually inspected. The shared server stayed on PID 39532 without a restart. Exact-head manager review and full CI gate the authorized merge.
