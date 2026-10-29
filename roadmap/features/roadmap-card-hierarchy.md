---
id: roadmap-card-hierarchy
title: Make roadmap cards readable at a glance
status: done
priority: high
commitment: committed
---

## Summary

Give List and Columns cards a clear title, summary, configured metadata and subdued source/session context, verified against representative cluttered cards and realistic large boards.

## Why

Internal IDs and duplicate difference messages compete with the title and description. Columns reserve action width below the header, making already narrow content wrap needlessly.

## In Scope

Evaluate and iterate the shared card hierarchy visually: title/actions, existing summary behavior, ordered configured metadata, and a separate source/session footer with one differences indicator. Remove ordinary visible internal IDs, retaining ID search, details and missing-item recovery. Preserve combined status/coverage, conflict information, participants, spec links, colors, selection, keyboard activation and reordering.

Use realistic titles and summaries in isolated fixtures; keep identifying real-project examples in ignored local evidence and generic examples in public tests. Cover dense/long/narrow boards, default/configured fields, List/Columns, and participant refresh without scroll loss. Make footer refresh a single target. List buttons must not contain nested interactive controls.

User-approved extension: Read view tags follow the same configured cardFields selection/order/colors, excluding status from that tag row because primary combined status remains separate and visible. Omitted configuration retains defaults. Empty fields hide Read tags, not primary status. Edit/Raw keep complete metadata and no item data changes. Verify This/Across, checkout changes, reopen and actual Read renders; update public and roadmap-skill guidance.

## Out of Scope

Backend/configuration changes, new detail interaction, real project data edits, live service changes, new dependencies and unrelated summary clamping.

## Done When

- Inspect baseline and iterative desktop/narrow renders of both layouts using the same realistic fixtures.
- Titles and summaries receive useful width, metadata order/hiding and color precedence remain intact, and context is not duplicated or empty.
- Existing version details retain differences and coverage; live participant updates neither redraw the board nor duplicate badges.
- Configured Read tags match card selection/order without duplicate status; Edit/Raw retain excluded fields and default Read behavior is unchanged.
- Focused and required regression checks pass; mirrors match; independent plan/result review and PR evidence are complete.

## Notes

Manager assignment accepted 2026-10-29. Real projects remain read-only; all implementation and tests use an isolated checkout. Manager owns final review, merge and any separately approved deployment.

## Delivery

Delivered 2026-10-29 in [PR #79](https://github.com/rore/minimap/pull/79), merged at 62954b7520b921e8c95844c56d330fb102eefe07. Shared card hierarchy and configured Read tags are complete; no implementation scope remains. PR #78 is closed as superseded.

Final required CI passed: 523 Node tests passed, three skipped, zero failed; all 240 browser tests passed; workflow and redline jobs passed. Independent application/adoption reviews and inspected desktop/narrow, dense/default/configured renders are recorded in the linked Work Record. The manager verified the separately approved deployed runtime matches the merge and inspected Columns/Read on a real board without item edits. Private examples and evidence remain local.

Work Record: [.agent-workflow/tasks/roadmap-card-hierarchy.md](../../.agent-workflow/tasks/roadmap-card-hierarchy.md).
