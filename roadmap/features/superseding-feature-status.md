---
id: superseding-feature-status
title: Resolve superseded feature states across worktrees
status: done
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

Status-only implementation, local verification and independent technical review are complete. Full CI, human result acceptance, merge and live delivery remain pending; this is not a release claim. Historical content/search, non-status placement, board order and all version inspection remain unchanged. The task branch owns this canonical item; delivery remains manager-owned.

Supported-limit follow-up required: the single 25-worktree/hundred-feature differing-history qualification preserved all 2,500 versions, resolved 1,200 historical statuses and passed correctness/deadline assertions, but missed the existing 200 ms health/peer responsiveness targets (p95 206.02/471.96 ms). First usable HTTP snapshot was 924.52 ms; full background validation 14,335.04 ms. No deadline was relaxed. The task owner requires a focused fix before merge, not acceptance of these misses. Measured Windows Git launch bursts are addressed by an independently reviewed cooperative launch gate; affected correctness and unchanged-target supported-limit qualification remain pending. Passing functional tests is not a complete performance pass.

Delivery: [PR 83](https://github.com/rore/minimap/pull/83).
