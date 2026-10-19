---
id: show-feature-related-work
title: Show related Work Records and pull requests in feature detail
status: in-progress
priority: medium
commitment: committed
labels:
  - roadmap
  - collaboration
  - work-records
---

## Summary

2026-10-19 follow-up (`feat/task-count-search`, pending delivery): the collapsed task section shows its known total as `(N)`, including zero and the total across pages. Partial and stale results retain their count and status; an unknown loading or unavailable result does not imply zero. This UI correction leaves the deferred rollout scope unchanged.

2026-10-18 UI follow-up (implementation and qualification in `feat/clear-task-details`, pending merge): feature detail names linked development task records explicitly, explains missing legacy links separately from records that could not be checked, and retains partial warnings with valid results. Participant and task reads reuse exact-scope successful results for at most 30 seconds and share pending reads across brief reopen/visibility cycles; manual Refresh forces fresh reads. This slice does not complete the deferred rollout below.

Delivery update (2026-10-17): [PR #49](https://github.com/rore/minimap/pull/49) is merged and verified in the restarted shared service. Personal Spec Review and Dictation's roadmap skill are updated. The feature remains in progress for rollout reconciliation: Pallium's canonical and stable copies are deferred at its manager's request during wake-delivery diagnosis. Implementation and installed UI acceptance are complete; do not repeat them because of delayed messages.

Open a feature and see the Work Records and pull requests that cite it. Derive this view from authoritative Work Record references; neither agents nor Minimap maintain a reverse list on the feature. Updates appear while Minimap runs, without holding up startup, board reads, editing, or Refresh.

## Why

The feature file describes intended work, while delivery evidence lives in Work Records and their PR references. Following that evidence currently requires searching separately and risks losing the connection after a record changes. A read-only, disposable reverse lookup makes the connection visible without creating another task tracker or inferring feature progress.

## Dependencies and Ownership

- [Agent Workflow source relationships](https://github.com/rore/agent-workflow/blob/main/roadmap/features/add-work-record-source-relationships.md) owns the machine-readable forward relationship, its format, parser/read contract, capture instructions, and validation. A Work Record may cite zero, one, or multiple source items and PRs. Implementers first agree on the smallest supported read contract, including exact provider/repository/item identity, stable Work Record identity, PR references, legacy/invalid records, and source checkout/revision provenance. Keep its syntax normative there; Minimap consumes that contract rather than parsing another prose convention.
- [Collection feature-related-work plan](https://github.com/rore/rore-collection/blob/main/plans/feature-related-work.md) owns sequencing and combined acceptance. This item owns only Minimap's discovery, disposable reverse lookup, and feature-detail experience. Pallium is optional and requires no change.
- Workflow's producer/read contract must be agreed before Minimap implementation and validated against actual Workflow output before combined acceptance. A test fixture can unblock parallel development but cannot replace that validation. If Workflow has no supported minimal read surface, settle one with Workflow before writing a second parser or adding a mandatory Python runtime to Minimap.

## Discovery Before Implementation

Inspect `package/minimap/CONTRACT.md`, the configured roadmap and Work Record path handling, source-bound and worktree identity code, existing snapshot/observation refresh coordination, feature-detail rendering, API routes, and browser tests. Reuse existing asynchronous refresh machinery and source safety checks. Inspect Workflow's published contract and representative output, including non-default record locations, before choosing the exact index key and response shape.

Measure a representative large record corpus with concurrent board and lightweight HTTP requests before coding. Record baseline p95 board/detail/health latency, cold discovery time, refresh freshness, body reads, enumerations, subprocess counts, and peak concurrent work. Set numeric latency, freshness, and I/O budgets in the Work Record before implementation; compare final measurements to those budgets. Asynchronous execution alone does not prove related-work discovery is free.

## In Scope

### Canonical relationships and identity

- Index only Workflow-owned, machine-readable forward references from configured Work Record locations. Resolve each source by exact provider, repository, and item identity. Match the roadmap root and item identity used by Minimap; same-named items in different repositories or nested roadmaps never collide. Do not infer relationships from branch names, PR titles, prose, file proximity, or Pallium associations.
- Carry stable Work Record identity, record name, recorded state, PR references, and source checkout/revision in results. A PR link is a recorded reference, not a live PR status. A Work Record's state is recorded state, not current execution, approval, feature completion, or availability. Missing source refs yield no inferred link; multiple refs can link one record to several exact features. Legacy, malformed, oversized, unreadable, and unsupported records have explicit bounded coverage diagnostics without hiding valid records.
- This checkout uses the opened checkout's feature and configured record sources. Across worktrees preserves source-specific versions and displays conflicts with provenance; deduplicate only when Workflow/Minimap identities establish the same logical record and relationship. Never pick an assumed newest copy, merge conflicting states or PR lists, or mutate another checkout. Separate clones and unrelated repositories are not discovered implicitly.
- Use trusted configured paths and existing safe-path boundaries. Do not execute code from a viewed repository, install dependencies, require Python for board rendering, follow unsafe path escapes, or fetch remote trackers merely to show links. Validate and encode local file navigation and external PR URLs; render Unicode correctly and escape untrusted titles as text.

### Discovery and freshness

- Build a disposable reverse index asynchronously. The first board and feature detail can render while index coverage is Loading; Loading must not appear as confirmed empty. A missing Workflow installation or records leaves ordinary board, feature reading, and editing usable with an honest unsupported/empty distinction.
- Known local record writes and source/config changes invalidate the affected scope. Periodic bounded incremental reconciliation also detects external add, edit, delete, move, relationship remap, and Git checkout changes without a server restart. Optional file watchers may accelerate this but cannot be the only correctness path. Manual Refresh includes a fresh index validation and exposes its result; it need not block the board's usable snapshot.
- Coalesce concurrent requests into one refresh per exact repository/roadmap/source scope, with bounded concurrency, file size, total time, and cancellation. A repo/source switch or teardown prevents old work from publishing into a new scope; cancelling one caller does not cancel other subscribers. Unchanged records are not reread on each render or polling cycle. No per-record subprocess and no full corpus scan on every feature open, board render, or participant tick.
- Publish complete index generations atomically. On read failure, timeout, overflow, or partial coverage, retain only a same-scope last-good view labeled with error, age, and coverage. Do not silently turn unknown into zero, mix new and old generations, or repopulate a superseded cache. A successful deletion/remap removes obsolete links. Bound cached data and keep it disposable; canonical state remains in Workflow records and roadmap files.

### Feature detail

- In the existing read-first feature detail, show a compact Related work section with each record's name, recorded state, source/version when needed, Open record action, and safe PR links. Keep the ordinary feature readable while discovery runs. Distinguish Loading, confirmed none, partial/stale, unavailable, and error with a retry/Refresh path. Do not add a backlink editor or dense card badge by default.
- Preserve the selected feature/version, unsaved drafts, source confirmation, and navigation during background updates. This checkout and Across worktrees must show relationships for the selected version and clearly disclose bounded/ambiguous coverage. A source switch must not apply an old response or open a different checkout's record by accident.

## Out of Scope

An attention inbox, assignment/approval registry, automatic feature status changes, live PR polling, a persistent database, a second backlink list, new Pallium semantics, mandatory runtime/install changes, remote repository discovery, cross-worktree writes, or a new independent scheduler. A watcher dependency or parsing stack requires evidence that the existing machinery cannot meet the agreed budgets.

## Done When

1. Workflow's documented read contract and real output drive the Minimap lookup; no duplicate relationship schema or maintained reverse links exist. Zero/multiple source refs, stable record identity, PR refs, exact provider/repo/item identity, legacy and invalid input, and configured record paths have explicit behavior.
2. API and browser E2E drive an actual long-running server: create a feature and record, add a PR, change recorded state, externally add/edit/delete/move/remap records and references, then observe correct links without restart. Manual Refresh also converges. The tests assert through the same feature-detail read path users use and prove obsolete links disappear.
3. E2E covers cold Loading versus confirmed none, stale last-good with error/age, timeout, malformed/oversized/unreadable records, missing Workflow, partial/overflow coverage, Unicode identities/titles, safe and unsafe links, and source-path boundaries. Normal board and editing remain usable; failed reads do not alter canonical files.
4. This checkout and Across tests cover multiple records per feature, one record citing multiple features, identical item IDs in different repositories/roadmap roots, more than one checkout with conflicting record versions, selected-source navigation, cancellation, repo switch, teardown, and concurrent callers. Conflicts remain distinguishable; no implicit cross-worktree mutation or guessed deduplication occurs.
5. An isolated representative large-corpus run records the pre-implementation budgets and after-results for cold and incremental discovery while board requests continue. Report p95 board/detail/health latency, freshness after external changes, enumerations/body reads/subprocesses, work sharing, concurrency and timeout behavior. Meet the agreed numeric targets or document and resolve each miss before acceptance; asynchronous execution alone is insufficient evidence.
6. Capture and inspect actual List and Columns feature detail at desktop and narrow widths, including loading, empty, related links, conflicting sources, stale/error, and editing during refresh. Fix visual and keyboard/accessibility problems found; DOM assertions alone are insufficient.
7. Focused API/browser E2E, required workflow checks, package mirror synchronization and agent-facing contract/doc updates pass for the eventual runtime change. Combined acceptance uses genuine Workflow output and is linked from both feature records; this planning-only change does not claim implementation or consumer rollout.

## Notes

Implementation started on 2026-10-17. Astra accepted Workflow's shared contract proposal `60111d4`; Minimap confirmed the decoder boundary. The implementation Work Record is `.agent-workflow/tasks/implement-related-work.md` on `feat/implement-related-work`. Baseline measurements and the concrete consumer plan preceded runtime edits. The feature uses a disposable index while roadmap and Work Record files remain authoritative. The implementation and tests have made no installed-skill, shared-server, launcher, or user-environment change. The separately approved green-gated rollout remains the manager's responsibility after delivery checks pass.

The initial producer captures references in the agent's normal Work Record edit with exact read-back. This is not automatic capture or a guarantee that omitted input was detected; that limitation must remain explicit in acceptance.

The consumer implementation runs in an isolated preview and remains **in progress**. The narrower optional PR URL hostname profile was approved; the Workflow-owned decoder/fixtures now come from producer revision `87cd9df73dc7f2ddf9ce0dd28986cc929a0cce21`, which classifies safe noncanonical PR URLs as unsupported while retaining invalid results for unsafe URLs. Minimap's selected-checkout lookup is read-only, generation-bound, and caps each scan at 1,000 record bodies, 256 KiB each, 128 MiB input, and 20 visible records per page; Work Record filename order is not activity order. Missing, unverified (`sources: null`), legacy, invalid, unreadable and overflow records produce explicit incomplete coverage without inferred matches. Recorded state and PR references do not prove live activity or delivery. A genuine producer-emitted positive feature relationship was verified at Workflow checkout `f50a9f88aadf5eed1546067f64b4175b69c0c55d`: the isolated browser displayed that Work Record, its recorded state and readable body. The desktop and narrow Related work views were accepted after overflow repair. Focused final-decoder checks pass; upstream release, consumer PR/CI gates, and approved rollout remain open.

The implementation is under review in [rore/minimap#49](https://github.com/rore/minimap/pull/49), opened at consumer commit `c41ffb6c4c0457dab7785ac43ec27c9cc7de9139`. This link records delivery provenance for this feature; it is not an inferred Work Record relationship or evidence of merge. The feature remains in progress until review, CI, upstream release, and rollout are complete.

Delivery PR: https://github.com/rore/minimap/pull/60 (reviewed; CI and merge pending).
