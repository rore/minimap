---
id: feature-card-preview-and-overview
title: Better cards and read-first item view
status: done
priority: medium
commitment: committed
labels:
  - ui
  - board
  - preview
---

## Summary

Improve board and list cards so they communicate more at a glance, then let users open the full item in read mode before switching into edit.

## Why

Minimap is primarily a review surface for roadmap state that often originates in agent conversations. Better overview cards and a read-first item view make that review loop faster without requiring users to bounce in and out of edit mode.

## In Scope

- compact cards that can optionally show one short summary line and selected metadata already present in the item
- a full read-mode rendering of the item from board or list views
- a clear path from read mode into full edit mode
- preserving the user's place in the current board or list while reading

## Out of Scope

- a second hidden detail schema distinct from the markdown item
- long, dense card layouts that make the board hard to scan
- replacing the existing full editor workflow

## Done When

- users can read the whole item without entering edit
- cards stay compact by default even when items contain richer metadata
- read-mode content is sourced directly from the canonical item file

## Notes

This is a strong follow-on to search because it improves the quality of the browse flow after a user finds an item.