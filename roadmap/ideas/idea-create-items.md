---
id: idea-create-items
title: Create roadmap items from the UI
status: queued
priority: low
commitment: uncommitted
labels:
  - ui
  - authoring
---

## Summary

Add create flows for new feature and idea items so authors do not need to start new work by hand-writing markdown files.

## Why

This is a convenience feature, but the primary minimap loop is usually discussion with an agent followed by human review and lightweight adjustments in the UI. That makes item creation useful, not core.

## In Scope

- create a new feature item from the UI
- create a new idea item from the UI
- generate the canonical markdown file with required frontmatter and sections
- append the new item to the appropriate board group or a default group

## Out of Scope

- drag-and-drop board editing
- bulk creation
- custom templates per repo

## Done When

- a user can create a feature without leaving the UI
- a user can create an idea without leaving the UI
- generated files follow the canonical item structure exactly

## Notes

This should stay behind visibility and light-control features unless real usage shows that manual item creation is a frequent bottleneck.