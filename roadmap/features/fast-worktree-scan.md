---
id: fast-worktree-scan
title: Speed up real worktree scans and retain progress across tab switches
status: in-progress
priority: high
commitment: committed
---

## Summary

Pallium's25-worktree aggregate took37.6seconds despite only162distinct features. Make the real scan faster and stop temporary browser tab hiding from canceling useful work.

## Acceptance

- Profile actual Git-history and file-read costs before optimizing; preserve exact identity/grouping results and fresh validation.
- Substantially reduce cold aggregation time on the observed repository and a generic representative history fixture.
- Switching away and back reuses the same in-flight scan or its completed result. Hidden tabs do not start repeated background refreshes.
- Changing repository/scope, explicit superseding refresh and deadline expiry retain bounded cancellation and stale-response protection.
- Cover failure recovery, source movement and concurrent reads with regressions. Inspect desktop/narrow List and Columns.
- Independent review and full CI pass before merge. No live deployment is included.

## Delivery

Work Record: `.agent-workflow/tasks/fast-worktree-scan.md`. Discovery in progress in the isolated owner checkout. Prior completion/fairness work remains delivered; this item addresses the measured real-history bottleneck and interrupted scans.
