---
id: roadmap-card-hierarchy
title: Make roadmap cards readable at a glance
status: active
priority: high
commitment: committed
---

## Summary

Give List and Columns cards a clear title, summary, configured metadata and subdued source/session context, verified against the real cluttered representative project example and realistic large boards.

## Why

Internal IDs and duplicate difference messages compete with the title and description. Columns reserve action width below the header, making already narrow content wrap needlessly.

## In Scope

Evaluate and iterate the shared card hierarchy visually: title/actions, existing summary behavior, ordered configured metadata, and a separate source/session footer with one differences indicator. Remove ordinary visible internal IDs, retaining ID search, details and missing-item recovery. Preserve combined status/coverage, conflict information, participants, spec links, colors, selection, keyboard activation and reordering.

Use the exact representative project title and full summary in an isolated fixture; cover dense/long/narrow boards, default/configured fields, List/Columns, and participant refresh without scroll loss. Make footer refresh a single target. List buttons must not contain nested interactive controls.

## Out of Scope

Backend/configuration changes, new detail interaction, real project data edits, live service changes, new dependencies and unrelated summary clamping.

## Done When

- Inspect baseline and iterative desktop/narrow renders of both layouts using the same realistic fixtures.
- Titles and summaries receive useful width, metadata order/hiding and color precedence remain intact, and context is not duplicated or empty.
- Existing version details retain differences and coverage; live participant updates neither redraw the board nor duplicate badges.
- Focused and required regression checks pass; mirrors match; independent plan/result review and PR evidence are complete.

## Notes

Manager assignment accepted 2026-10-29. Real representative project is read-only; all implementation and tests use the isolated roadmap-card-hierarchy checkout. Manager owns final review, merge and any separately approved deployment.
