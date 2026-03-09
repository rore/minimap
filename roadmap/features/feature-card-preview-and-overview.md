---
id: feature-card-preview-and-overview
title: Better cards and quick preview
status: queued
priority: medium
commitment: committed
labels:
  - ui
  - board
  - preview
---

## Summary

Improve board and list cards so they communicate more at a glance, then let users open a lightweight preview without fully switching into edit mode.

## Why

Minimap is primarily a review surface for roadmap state that often originates in agent conversations. Better overview cards and quick preview make that review loop faster without requiring users to bounce in and out of full edit mode.

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

This is a strong follow-on to search because it improves the quality of the browse flow after a user finds an item.