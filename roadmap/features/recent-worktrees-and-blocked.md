---
id: recent-worktrees-and-blocked
title: Prefer recent worktrees and include blocked work in In play
status: in-progress
priority: high
commitment: committed
---

## Summary

Expand Across worktrees to 25 checkouts and choose recent local checkouts instead of taking Git listing order. Include blocked features in In play without requiring an agent attachment.

## Scope

- Preserve the opened checkout and select the most recent eligible siblings within a total of 25.
- Rank siblings by the last complete local HEAD reflog event timestamp, with unknown timestamps last and canonical-path ties. Plain uncommitted edits do not change ranking.
- Exclude stale/missing checkouts before allocating usable slots, preserve identity validation and truthful partial coverage.
- Include normalized blocked status in the shared In play predicate, preserving composition with other filters and attached-session matches.
- Update UI descriptions and agent contracts, add regression coverage, and measure responsiveness with 25 sources.

## Completion

Selection order, ties, missing activity evidence, stale entries, cancellation and the cap are tested. Blocked matches work in This/Across and List/Columns with Pallium absent. Independent review and applicable delivery checks pass. No live restart or installation update is included.

## Notes

Requested 2026-10-18. Discovery and plan review in `feat/recent-worktrees-and-blocked`; owning Work Record `.agent-workflow/tasks/recent-worktrees-and-blocked.md`.

## Qualification status

The 25-source selection and blocked filter are implemented in the isolated branch, with focused discovery tests and rendered This/Across List/Columns checks passing. The 25x100 performance cell passed; two concurrent cold 25x1000 snapshots exceeded the existing 30-second request deadline. A single-stage probe measured about 10 seconds in 75 serial Git identity checks out of 23 seconds total. A bounded identity-check batching correction is under review; freshness checks and deadlines must remain unchanged. Delivery remains pending this qualification issue.
