---
id: consolidate-roadmap-refresh
title: Consolidate roadmap refresh, worktree loading and participant freshness
status: done
priority: high
commitment: committed
labels:
  - reliability
  - performance
  - worktrees
---

## Summary

Consolidate the loading and refresh paths added for worktrees and Pallium so Minimap remains a responsive, minimal view over canonical files. Separate roadmap snapshots from participant observations, preserve user intent across asynchronous results, and reuse expensive read work across tabs and projects. This is a coherent implementation effort with independently reviewed delivery stages, not a new management system.

## Why

The 2026-10-08 review found inconsistent refresh policies, repeated Git and file work, missing worktree integrations, and a reproducible draft-loss race. Success means corrected behavior and measured responsiveness, not merely reorganized code.

Isolated Windows Node 24.14.1 measurements used 100 tiny committed feature files and sibling worktrees at the same HEAD. Direct aggregation took 1,641 ms for one source (9 Git processes, 104 reads), 6,779 ms for four sources (37 Git processes, 416 reads), and 6,738 ms for a repeat four-source load with the same work. Two simultaneous identical loads took 7,184 ms total and doubled work to 74 Git processes and 832 reads. Opened-only took 1,426 ms. Event-loop delays reached about 100 ms; these are module measurements, not production HTTP guarantees.

## In Scope

1. Preserve edits made while a refresh or save response is pending. Do not freeze a dirty-state decision at request start; check intent and dirty state before applying results. Include item, raw, board and scope drafts where affected.
2. Refresh participant badges consistently in This checkout and Across worktrees, in both List and Columns. Use the existing batched Pallium contract and inclusive Recent/Dormant semantics. Participants refresh independently of expensive source discovery, ancestry and file parsing.
3. Keep last successful observations during temporary failure, clearly indicating stale or incomplete data. Unavailable must never mean confirmed zero. Preserve source identity, ambiguity handling and honest In play coverage.
4. Share in-flight read work by exact scope and reuse bounded cached snapshots. Serve known data promptly while revalidating. Keep mutable roadmap freshness and effective Git-history validity explicit; object IDs alone do not validate ancestry/squash results. Include uncommitted edits, added/deleted items, config changes and worktree replacement in invalidation.
5. Batch identity discovery and reuse bounded ancestry/squash evidence within each scan. Reuse validated aggregate snapshots across requests so admitted warm reads do not repeat Git discovery or evidence collection. Bound cross-project resource use and cancel superseded work without cancelling independent subscribers. Give scans a total budget as well as per-operation limits.
6. Distinguish confirmed source movement from timeout/unavailable identity evidence. Retry only appropriate transient failures within a total budget; do not multiply expensive scans during overload.
7. Eliminate duplicate participant-detail requests and duplicate full-index loads. One item's participant lookup must not parse every item twice. Board spec enrichment must select relevant files before reading unrelated projects' complete session histories.
8. Use the loaded version's source for Open spec and all file actions. Restore source-specific Spec badges in Across; synthetic appearance identities must not break links to real files.
9. Consolidate toolbar/hash/mode-return reconciliation. Refresh changed metadata without reloading unchanged aggregates. Guard Spec loads and polls against obsolete file/mode/source responses.
10. Apply consistent completed-item candidate rules. Prioritize unfinished features before completed candidates under the 200-reference cap. Keep ambiguous feature identities unknown and expose overflow.
11. Compute one board projection per relevant reconciliation, use indexed lookups, and remove state mutation from read-style projection getters. Reuse projection results for cards, totals and selection.
12. Preserve existing safety contracts, generic fixtures, mirror parity and agent-facing documentation. Add measurement and regression coverage for the observable outcomes below.

## Out of Scope

A new presence service, scheduler, database, assignment/ownership system, automatic association deletion, automatic worktree cleanup, raising coverage limits to conceal inefficiency, weakening source/write guards, or adopting a new frontend framework.

No installed-skill refresh, shared-server restart, PATH/global configuration change or consumer rollout is authorized by this source feature. Any such delivery requires separately described environment scope and explicit approval.

## Design

Maintain two independently refreshed read models:
- Roadmap snapshot: checkout/file versions, grouping, provenance and conflict evidence.
- Participant observation: bounded feature-reference counts, lifecycle classification, observation time and availability.

Use common request ownership, freshness and reconciliation rules across modes; keep source-specific presentation where it is meaningful. The UI must not start an expensive full scan just to refresh badges or change a filter.

Caches are bounded and local to the existing process. Keys include repository/source/roadmap scope and relevant revisions; they must not leak one project's data into another. HEAD alone cannot validate mutable roadmap files. Avoid caching mutable workspace objects that aggregation later edits. Publish a scan only if its scope generation is still current: invalidation, a successful write or newer validation must prevent an older in-flight result from repopulating the cache. Record explicit freshness bounds and Manual Refresh semantics before cache implementation, with a delayed-scan regression proving publication ordering. Keep live source confinement and optimistic revision checks at writes regardless of read caching.

Prefer existing helpers, in-memory maps, batched Git operations and bounded asynchronous work. Add a worker pool or new dependency only after measurements establish a need and technical review accepts it.

## Delivery Stages

1. Correct asynchronous draft preservation, selected-source file actions, stale Spec responses and duplicate detail refresh ownership.
2. Consolidate server read orchestration: reuse scans, bounded cache/invalidation, cancellation, budgets, identity batching/evidence reuse, scoped item/spec queries.
3. Wire consistent participant freshness and source-aware Spec summaries into both modes; unify transition reconciliation and reuse projections.
4. Complete integrated performance, failure, safety and visual acceptance. Every earlier delivery includes its own required tests, relevant contract/docs updates and generated mirrors; this stage reconciles combined acceptance and delivery evidence.

Keep each independently reviewable delivery explicit in Notes with its PR, tested revision and remaining scope. The umbrella stays in progress until the full acceptance matrix is satisfied. Do not split changes merely to bypass workflow limits or weaken tests to fit implementation.

## Done When

- Refresh begun with a clean editor cannot overwrite edits typed during either workspace or item response; edits during save settlement, source switches and background refresh are preserved.
- This/Across and List/Columns update participant badges while visible and after returning, without one request per card or a full Git scan per participant tick. Hidden views do not cause needless polling.
- Board counts and details use the same reference/classification semantics; differing observation times are explicit. Recent-only, dormant-only, mixed, missing/reassigned aliases, closed/detached sessions, partial/disabled/unavailable providers and lifecycle transitions are covered.
- Worktree inventory, file additions/deletions, uncommitted metadata, branch/HEAD movement and configuration changes eventually appear within the documented freshness policy. Manual Refresh requests fresh validation and remains responsive.
- Identical concurrent callers share expensive work; a cancelled caller does not invalidate another subscriber. Switching projects or sources cannot apply an old response or show another scope's cached data.
- Temporary failures retain usable same-scope content and drafts with concise stale/incomplete information. Genuine source changes remain fail-closed for edits. Timeouts are not mislabeled as confirmed changes.
- Sibling Open spec and Spec badges target the actual selected source. Spec mutations reconcile summaries through toolbar and hash navigation; unchanged navigation avoids unnecessary full scans.
- Completed features do not starve unfinished participant candidates; overflow and identity ambiguity remain visible.
- Automated before/after measurements cover 1/4/16 checkouts, 100/1,000 items, repeated reads, simultaneous same-project tabs, multiple independent projects, slow Pallium and cancellation. Record first usable cards, full convergence, warm response, request/subprocess/read counts, event-loop delay and ordinary HTTP endpoint latency under scan load.
- Before declaring performance done, publish measured budgets and results. Warm snapshot responses and lightweight endpoints should target p95 below 200 ms, and visible interactions below 100 ms in the isolated reference fixture. These are targets to validate, not current guarantees; document any miss and resolve it before acceptance or seek an explicit scope decision.
- Actual screenshots and interaction checks cover List/Columns at desktop and narrow widths, loading/stale/partial states, source choice, participant changes and draft retention. Inspect rendered output, not HTML alone.
- Focused regressions, required unit/browser checks, mirror sync, documentation drift review, clean-context result review and applicable human result approval pass.
- Audit the existing regression suites against every acceptance outcome and retain a coverage map in the Work Record. Add missing tests before the corresponding fixes where practical; demonstrate that confirmed-bug regressions fail against the old behavior and pass after the fix. Include positive and failure/race paths, not only mocked rendering. Preserve existing assertions; do not loosen timeouts or skip checks to hide regressions. Keep deterministic work-count/concurrency assertions in routine CI and a reproducible isolated latency benchmark for performance qualification.

## Review Evidence and Known Limits

Review baseline: source revision 58e9e6c; test-isolation prerequisite merged in PR #42 as a142984. The original full-snapshot badge-loss report remains unconfirmed. A prior generic nine-checkout fixture with 7 visible features out of 161 in six groups retained source and participant badges through tab visibility, freeze/resume, filtering, resizing, hash replay and delayed failure. Do not claim that symptom fixed without a causal reproduction or clearly bounded new evidence.

Confirmed draft race was reproduced with actual loading functions in an isolated harness. The incorrect sibling Spec action constructed the opened repository's path; source guards are expected to reject it, not evidence of wrong-file modification. Aggregation uses asynchronous Git/filesystem APIs; repeated work and synchronous parsing/joins are performance concerns, not proof of a global synchronous Git lock.

## Final qualification — 2026-10-08

Implemented in draft PR #43: common snapshot/observation refresh, draft and source-intent preservation, bounded shared scans, cached inventory, request-local Git evidence reuse, and compact retained snapshots with legacy compatibility. Qualification additionally fixed repeated enumeration after the ancestor limit, cache eviction between large projects, interrupted validation stuck at Updating, and fast full-scan failures suppressing the opened-checkout fallback.

Final runtime `3f675f9`, Windows, Node 24.14.1, Git 2.56.0.windows.1. Generic isolated fixtures. First usable/full are single observations; warm p95 is the empirical nearest-rank value of five reads, including transfer and client JSON parsing.

| Checkouts × items each | First usable ms | Full load ms | Warm p95 ms |
| --- | ---: | ---: | ---: |
| 1 × 100 | 561.53 | 811.83 | 8.69 |
| 1 × 1,000 | 1,284.44 | 1,522.90 | 33.33 |
| 4 × 100 | 656.88 | 3,748.83 | 61.81 |
| 4 × 1,000 | 1,333.40 | 5,230.47 | 91.84 |
| 16 × 100 | 673.50 | 10,722.30 | 153.37 |
| 16 × 1,000 | 1,515.05 | 20,088.84 | **339.96** |

Every warm read reused its snapshot with zero Git. Four largest-board callers share one scan. Two independent largest snapshots both remain cached under the unchanged 64MiB limit; their combined wire size is 43.7MB. All sufficiently sampled lightweight endpoint p95s meet 200ms; largest-case health and other-project reads are 57.34ms and 100.95ms. Insufficient small-cell samples are raw observations, not percentile claims.

Baseline `a142984` full reads were 1,691/2,764/6,490/10,583/26,896/69,170ms in the same cells. Its largest run failed a concurrent other-project request; later phases are censored, and no successful multi-project comparison or speedup ratio is claimed. Other baseline repeated reads still performed full scans.

Actual List/Columns desktop and narrow screenshots were inspected, including 390px expanded version controls. Ten 390px layout-to-paint samples gave p95 51.6ms against 100ms. Regressions cover mode parity, source confinement, mutation ordering, lifecycle/partial availability, admission/eviction, shared cancellation and delayed editor intent. Runtime CI passed 416 unit tests. The Work Record tracks final browser CI and review.

A real held-provider HTTP regression independently verifies that five cached board/health probes complete before a blocked Pallium response is released, preserving snapshot identity with zero Git. Those paired probes measured 17.66–21.63ms in the small fixture; observations then returned the expected counts.

Full integrated CI at aad8e20 passed 416 unit tests, 195 browser tests, mirror parity and workflow/redline checks. Technical review found no remaining correctness blocker.

**Accepted result:** on 2026-10-08 the user replied "approved" to the final result and merge request, explicitly including the documented 339.96ms worst-case warm response exception to the 200ms target. All implementation and verification scope is complete; PR #43 delivers it. The original passive badge-loss symptom remains unconfirmed. No installed consumer, live server or global configuration changed.

## Earlier qualification checkpoints (superseded by the result above)

Latest qualification: the large repeated-read miss is cache eviction, not admission failure: the expanded 16-checkout/1,000-item snapshot consumes almost the entire 64MiB cache, and a second project evicts it. A reviewed compact representation removes repeated source context and group versions without dropping uncertain identities or increasing the limit; legacy callers retain the expanded contract. Final multi-project measurements remain required. Browser qualification also fixed fast full-scan failures suppressing the opened-checkout fallback; seven related async/inventory regressions now pass. The full CI rerun and result approval remain outstanding.

Integrated qualification update: independent source review accepted the shared snapshot/observation implementation at 94be067 after five backend findings were resolved. Draft PR #43 remains open. Full CI and performance acceptance are still in progress. The 16-checkout/1,000-item run exposed repeated enumeration after an ancestor evidence limit; the request-local limit memo at 9582f91 lets the cold scan complete, but a repeated-read cache miss remains under investigation. Browser qualification additionally reproduced and fixed a cancelled retry leaving Updating stuck after tab return; equivalent Spec-navigation paths are being checked. The 85-feature/two-checkout visual fixture passes at desktop and narrow sizes, with ten 390px layout-to-paint samples giving empirical p95 50.1ms. Do not interpret these intermediate results as completion or authorization to change installed consumers.

2026-10-08: User authorized capturing the full review and driving implementation. Manager owns this canonical feature and acceptance in the isolated refresh-consolidation checkout until delivery. Qualification must use disposable homes, ports, profiles and generic repositories. No live environment changes.

2026-10-08 progress: Delivery 1 is technically accepted at d04bc66, including the pending-source Review correction. Delivery 2c is technically accepted at 9b8044d with 45 focused checks and green PR #44 CI; it is integrated locally into draft PR #43. Git identity batching and indexed joins at 6b2a29d are technically accepted with 46 focused checks: a four-checkout aggregate uses 13 Git processes instead of 37. Snapshot coordination and common client observations are implemented but still undergoing integration qualification. New regressions cover all four mode/layout combinations, visibility, failure retention, cached/manual validation and filtered-out dirty drafts. Windows path normalization and optional cancellation plumbing defects found during integration are being corrected before performance qualification. The opt-in 1/4/16-checkout by 100/1,000-item benchmark is prepared, not yet accepted. Result approval and merge remain outstanding; no installed consumer or live server has changed.
