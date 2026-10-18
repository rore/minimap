---
id: nonblocking-performance-pass
title: Keep service and board responsive during slow work
status: in-progress
priority: high
commitment: committed
labels:
  - performance
---

## Summary

Measure and fix unnecessary service and UI blocking across roadmap, worktree, participant, and related-work loading. Keep Minimap a small view over files.

## Why

Bounded asynchronous Git reads improved worktree completion, but do not prove independent requests and browser interactions remain responsive under concurrent projects and refreshes.

## In Scope

- Trace slow I/O, synchronous CPU work, request dependency chains, cache reuse, cancellation, and shared concurrency.
- Reproduce actual bottlenecks with isolated representative fixtures before changing code.
- Apply the smallest demonstrated fixes and regression coverage; inspect both board layouts visually.

## Out of Scope

Live service or installation changes, new dependencies, arbitrary checkout-cap increases, and a wholesale framework rewrite.

## Done When

- Measurements show independent requests and board interaction remain responsive during expensive operations.
- Cache and refresh behavior preserve source validation, freshness, and truthful partial results.
- Each fix has focused regressions and reviewed evidence; remaining limits are documented.

## Notes

Requested 2026-10-18. Implemented and independently reviewed in [PR #55](https://github.com/rore/minimap/pull/55), awaiting full CI and human result approval; owning Work Record `.agent-workflow/tasks/nonblocking-performance-pass.md`. The 16-source bound remains unchanged.

The approved implementation targets measured Spec anchor CPU stalls, discarded anchor work in content reads, duplicate List rendering and unchanged-result search redraws. Qualification includes concurrent independent HTTP requests, exact anchor-result equivalence, and desktop/narrow browser interaction checks. Repeated fresh item-index reads and changed-result board rendering remain measured limits to evaluate, not assumed fixed by asynchronous I/O.
