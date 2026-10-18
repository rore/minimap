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

Draft delivery: https://github.com/rore/minimap/pull/57. Bounded identity batching is implemented at `70c711a`; concurrent qualification and independent result review remain pending.

After batching, cold full loading improved from 26.3s to 18.2s. Requalification still returned one 503 at 30.1s for two concurrent 25x1000 projects; PR #57 remains draft and performance acceptance is blocked. The user requested renewed investigation rather than accepting this limitation.

Renewed review found quadratic feature lookups in card rendering and metadata grouping, hidden-card DOM creation for collapsed groups, and payload expansion before the stale-request guard. The 500-item ancestry evidence bound also leaves the large fixture as 25,000 distinct features with a 33.5 MB response; it must not be bypassed by guessing identity. A synthetic 32 MB snapshot publication delayed a timer by 56.4 ms. Hash-only validation and alternative read APIs showed no useful improvement in bounded diagnostics. Further correction must preserve identity, fresh rereads, cancellation and deadlines; no live environment change is included.

Approved UI corrections are now implemented: indexed lookups, omitted collapsed-card markup and canceled-response expansion guard. Focused checks passed 37 unit/lint and 3 browser cases, with actual desktop/narrow visuals inspected. Wider file-read batches failed isolated full qualification (both concurrent requests timed out and cached-other response p95 was 215 ms), so production remains at 32. The concurrent cold-load acceptance blocker remains; no merge or live update is claimed.
