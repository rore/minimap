---
id: idea-card-preview-and-overview
title: Better cards and quick preview
status: queued
priority: medium
commitment: uncommitted
labels:
  - ui
  - board
  - preview
---

## Summary

Improve board and list cards so they communicate more at a glance, then let users open a lightweight preview without fully switching into edit mode.

## Why

Elastic's card-to-detail flow makes browsing efficient because users can inspect an item without losing context. Minimap needs a comparable read path for scanning, while still keeping the full editor as the primary write surface.

## In Scope

- compact cards that can optionally show one short summary line and selected metadata already present in the item
- a quick preview surface from board or list views
- a clear path from preview into full edit mode
- preserving the user's place in the current board or list while previewing

## Out of Scope

- a second hidden detail schema distinct from the markdown item
- long, dense card layouts that make the board hard to scan
- replacing the existing full editor workflow

## Done When

- users can learn enough about an item from the overview layer before deciding to edit
- cards stay compact by default even when items contain richer metadata
- preview content is sourced directly from the canonical item file

## Notes

This pairs naturally with search and filters because both features increase the value of rapid scanning.