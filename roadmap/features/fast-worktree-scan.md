---
id: fast-worktree-scan
title: Speed up real worktree scans and retain progress across tab switches
status: in-progress
priority: high
commitment: committed
---

## Summary

Pallium's 25-worktree aggregate took 37.6 seconds despite only 162 distinct features. Make the real scan faster and stop temporary browser tab hiding from canceling useful work.

## Acceptance

- Profile actual Git-history and file-read costs before optimizing; preserve exact identity/grouping results and fresh validation.
- Substantially reduce cold aggregation time on the observed repository and a generic representative history fixture.
- Switching away and back reuses the same in-flight scan or its completed result. Hidden tabs do not start repeated background refreshes.
- Changing repository/scope, explicit superseding refresh and deadline expiry retain bounded cancellation and stale-response protection.
- Cover failure recovery, source movement and concurrent reads with regressions. Inspect desktop/narrow List and Columns.
- Independent review and full CI pass before merge. No live deployment is included.

## Delivery

Work Record: `.agent-workflow/tasks/fast-worktree-scan.md`. Discovery in progress in the isolated owner checkout. Prior completion/fairness work remains delivered; this item addresses the measured real-history bottleneck and interrupted scans.

## Implementation and qualification

Read one bounded complete commit graph per scan and reuse unique common ancestors. Use shared full-history deletion evidence only to prove a range empty; possible deletions retain the original exact Git query. Incomplete, oversized, malformed or unavailable evidence falls back to native queries. The 8-child global limit, 4-pair batches, freshness checks and deadlines remain unchanged.

Temporary tab hiding keeps an existing workspace read alive under its original deadline; hidden tabs start no automatic followup reads. Explicit navigation, scope changes and superseding requests still cancel obsolete work.

Same-state Pallium comparison: 7.53 seconds optimized versus 32.62 seconds forced-native, with identical workspace, features, groups, coverage and exclusions (25 checkouts, 162 features, no uncertainty). These are aggregate timings, not full HTTP or browser timings. Earlier observed aggregate: 37.623 seconds. Unusual histories and graph limits may use the slower native fallback.
