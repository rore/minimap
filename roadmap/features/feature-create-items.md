---
id: feature-create-items
title: Create roadmap items from the UI
status: queued
priority: high
commitment: committed
labels:
  - ui
  - authoring
---

## Summary

Add create flows for new feature and idea items so authors do not need to start new work by hand-writing markdown files.

## Why

The current product still requires raw file edits to add roadmap items, which blocks the repo from fully managing its own roadmap through the tool.

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

This is the most important remaining step for dogfooding the product on itself.
