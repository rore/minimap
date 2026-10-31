---
id: superseding-feature-status
title: Resolve superseded feature states across worktrees
status: active
priority: high
commitment: committed
---

## Summary

Across worktrees should use newer, proven superseding feature state rather than treating clean historical states as current conflicts.

## In Scope

Feature-revision ancestry despite divergent checkout HEADs; consistent combined status, detail, filtering and sorting; inspectable historical versions; conservative treatment of reopenings, concurrent, dirty and unknown evidence; bounded reads and existing caches.

## Out of Scope

Project data edits, branch synchronization, status precedence, timestamp ranking, deployment and service changes.

## Done When

Generic ancestry, reopen, conflict, dirty, incomplete-history, filter and performance regressions pass. Both layouts and This/Across are visually checked on a realistic board; docs, runtime mirrors and independent review are complete.

## Notes

Investigation accepted. The task branch owns this canonical item; merge and deployment remain manager-owned.
