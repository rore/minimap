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

Draft delivery: https://github.com/rore/minimap/pull/57. Selection, blocked-filter and bounded UI changes have passed focused tests and desktop/narrow visual checks. Earlier concurrent cold 25x1000 tests timed out; wider file-read batches were slower and rejected.

The user approved a focused cold-load correction: default eight filesystem workers before packaged startup, a bounded 96 MiB serialized roadmap cache, and draining started read batches before failure. The disposable prototype passed both concurrent cold loads (26.1/26.4 seconds under the unchanged 30-second deadline), retained both snapshots without Git rescans, and kept other cached projects responsive. Actual implementation at `6e441b2` passes lifecycle and regression checks, but its final 25x1000 concurrent qualification still timed out on both requests. The prototype did not provide reliable margin. The controlled pool-size comparison, rolling read queue and synchronous-read diagnostic did not solve it and were not adopted. Subsequent stage profiling led to the approved completion/fairness correction below. Detailed experiments and evidence remain in the owning Work Record.

Identity checks and fresh rereads stay unchanged. File-read batches remain 32. The cache limit does not bound total process memory. No merge, live restart or installation change is included.

The approved completion/fairness correction gives full Across scans 60 seconds and reserves one lane for This/opened-checkout reads alongside at most two regular scans. Other deadlines remain unchanged. Actual qualification completed both cold 25x1000 scans in32.2/32.8seconds, with a never-loaded third checkout opening in556ms before either completed. Coverage and retained snapshot reuse passed, with zero Git processes on retained reads. Large-run health/cached-view p95 was70/121ms; isolated tails reached476ms and the smaller run missed its cached-view p95 target on one outlier. Peak sampled RSS was about613MiB. Focused regressions and desktop/narrow List/Columns visual checks passed. Independent exact-revision review and human result approval are complete; final CI remains before merge. This establishes bounded completion and progress, not faster full-scan throughput or zero blocking.
