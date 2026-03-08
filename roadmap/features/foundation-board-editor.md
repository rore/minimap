---
id: foundation-board-editor
title: Board view and existing-item editor
status: done
priority: high
commitment: committed
labels:
  - foundation
  - ui
  - editor
---

## Summary

Provide a board view for fast roadmap scanning and a focused editor for existing roadmap items.

## Why

The product has to be immediately useful for humans before more advanced mutation flows are added.

## In Scope

- grouped board display from `board.md`
- metadata badges from item frontmatter
- preview, edit, and raw modes for existing roadmap items
- editable fields for title, status, priority, commitment, optional milestone, and core sections
- surface additional item sections that already exist in the file
- save and reload behavior based on canonical files

## Out of Scope

- create item flows
- item moves between board groups
- rich markdown editing with a custom document model

## Done When

- a user can open an item from the board
- a user can preview, edit, and save it without leaving the app
- the board refreshes from the saved file contents

## Notes

This is implemented and currently used by this repo.
