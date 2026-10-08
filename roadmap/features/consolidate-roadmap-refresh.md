---
id: consolidate-roadmap-refresh
title: Consolidate roadmap refresh, worktree loading and participant freshness
status: in-progress
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
4. Share in-flight read work by exact scope and reuse bounded cached snapshots. Serve known data promptly while revalidating. Separate mutable working files from immutable Git evidence. Include uncommitted edits, added/deleted items, config changes and worktree replacement in invalidation.
5. Batch/reuse identity discovery, cache immutable ancestry/squash evidence, bound cross-project resource use, and cancel superseded work. Preserve independent callers when one subscriber cancels shared work. Give scans a total budget as well as per-operation limits.
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

## Notes

2026-10-08: User authorized capturing the full review and driving implementation. Manager owns this canonical feature and acceptance in the isolated refresh-consolidation checkout until delivery. Qualification must use disposable homes, ports, profiles and generic repositories. No live environment changes.

2026-10-08 progress: Delivery 1 is technically accepted at d04bc66, including the pending-source Review correction. Delivery 2c is technically accepted at 9b8044d with 45 focused checks and green PR #44 CI; it is integrated locally into draft PR #43. Git identity batching and indexed joins at 6b2a29d are technically accepted with 46 focused checks: a four-checkout aggregate uses 13 Git processes instead of 37. Snapshot coordination and common client observations are implemented but still undergoing integration qualification. New regressions cover all four mode/layout combinations, visibility, failure retention, cached/manual validation and filtered-out dirty drafts. Windows path normalization and optional cancellation plumbing defects found during integration are being corrected before performance qualification. The opt-in 1/4/16-checkout by 100/1,000-item benchmark is prepared, not yet accepted. Result approval and merge remain outstanding; no installed consumer or live server has changed.
