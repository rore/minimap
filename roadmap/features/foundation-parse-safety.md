---
id: foundation-parse-safety
title: Parse safety and non-destructive saving
status: done
priority: medium
commitment: committed
labels:
  - foundation
  - parser
---

## Summary

Reject malformed roadmap files with clear errors and preserve unknown content when saving valid files.

## Why

The UI is only a lens over canonical files, so it must fail safely and avoid erasing information it does not own.

## In Scope

- parse validation for board and item files
- non-destructive error messages in the UI
- safe failure when a board entry points to a missing item
- preserve unknown frontmatter keys and untouched markdown sections on save
- allow validated raw file edits while preserving the canonical item id

## Out of Scope

- auto-repairing malformed files
- migrating old formats automatically

## Done When

- malformed files return parse errors through the API
- the UI shows an error state without modifying files
- saving known fields does not erase unknown content
- raw edits fail safely when they break the canonical item contract

## Notes

This is implemented and covered by tests.
