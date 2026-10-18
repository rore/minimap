---
id: nonblocking-performance-pass
title: Keep service and board responsive during slow work
status: done
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

Completed 2026-10-18 in [PR #55](https://github.com/rore/minimap/pull/55), merged as `961422a444005ac003f94272e870e74ae64f2370` after independent review, human result approval and green full CI. Owning Work Record: `.agent-workflow/tasks/nonblocking-performance-pass.md`. The 16-source bound remains unchanged.

Shipped: cooperative Spec anchor batches, transient line/heading indexes, content-only single reads, one List rebuild and no board rebuild for unchanged search results. Qualification passed concurrent independent HTTP requests, exact anchor-result equivalence and desktop/narrow browser checks. Full CI passed; the product-code run recorded 445 Node tests passed, one skipped, and 203 browser tests passed.

Remaining limits: changed-result renders produced roughly 90ms long tasks in the dense fixture; an admitted independent workspace request took 1.34s under heavy Spec processing. Fresh item-index reads, single-call parsing/hashing/serialization and Spec HTTP disconnect cancellation are not solved by this slice. No universal nonblocking guarantee, live restart or installation change is claimed.
