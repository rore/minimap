---
id: idea-timeline-view
title: "Optional timeline view"
status: queued
priority: low
commitment: uncommitted
labels:
  - ui
  - views
  - timeline
---



## Summary

Add a time-oriented roadmap view when the repo already carries milestone, release, or date-like metadata that can support it.

## Why

Elastic's default calendar-style view works because its roadmap is explicitly organized around time horizons. Minimap should only adopt that pattern where the repo's own files justify it, otherwise the UI would imply structure that does not exist.

## In Scope

- render a timeline or calendar-adjacent view from existing milestone, release, or date-like metadata
- gracefully fall back when the repo does not have enough time data
- keep the timeline as an alternate browse lens rather than the primary editing model

## Out of Scope

- requiring every repo to add schedule metadata
- creating UI-only dates or release buckets
- replacing the canonical board as the default structure

## Done When

- time-oriented repos gain a useful optional planning view
- repos without time metadata are not pushed into fake timeline semantics
- the same canonical items remain editable through the existing editor flow

## Notes

This should follow search, filters, and derived lenses because it depends on stronger navigation foundations.
