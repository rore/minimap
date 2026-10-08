# Consolidate roadmap refresh and worktree reads

<!-- agent-workflow:start -->
**Outcome:** Consistent participant freshness and responsive file-backed roadmap views without losing drafts or source safety.
**Target:** Minimap roadmap, worktree, participant and Spec integration read paths.
**Scope:** roadmap/features/consolidate-roadmap-refresh.md; roadmap/board.md; package/minimap/server.js; package/minimap/src/worktree-*.js, roadmap.js, pallium.js, sessions.js; package/minimap/ui/app.js, api.js, worktrees.js and focused leaf helpers; relevant test and playwright coverage; CONTRACT.md, README.md, skill references and generated mirrors.
**Constraints:** Preserve canonical files, identity ambiguity, source confinement, revision/write guards, unknown metadata, bounded provider queries and existing acceptance obligations. No governance edits, installed tools/skills, live service or global configuration changes; disposable qualification only. No new service, scheduler, database or framework.
**Completion criteria:** All acceptance criteria in roadmap/features/consolidate-roadmap-refresh.md are verified, including draft races, cross-mode freshness, scoped caching/cancellation, source-specific Spec behavior, bounded query coverage, measured multi-project performance and rendered desktop/narrow List/Columns acceptance.
**Requirement baseline:** {"source":"work-record-initial","outcome":"Consistent participant freshness and responsive file-backed roadmap views without losing drafts or source safety.","scope":"roadmap/features/consolidate-roadmap-refresh.md; roadmap/board.md; package/minimap/server.js; package/minimap/src/worktree-*.js, roadmap.js, pallium.js, sessions.js; package/minimap/ui/app.js, api.js, worktrees.js and focused leaf helpers; relevant test and playwright coverage; CONTRACT.md, README.md, skill references and generated mirrors.","constraints":"Preserve canonical files, identity ambiguity, source confinement, revision/write guards, unknown metadata, bounded provider queries and existing acceptance obligations. No governance edits, installed tools/skills, live service or global configuration changes; disposable qualification only. No new service, scheduler, database or framework.","completion_criteria":"All acceptance criteria in roadmap/features/consolidate-roadmap-refresh.md are verified, including draft races, cross-mode freshness, scoped caching/cancellation, source-specific Spec behavior, bounded query coverage, measured multi-project performance and rendered desktop/narrow List/Columns acceptance."}
**Risk:** High
**Complexity:** Large
**Reason:** Shared read/API contracts, mutable-file caching and asynchronous editor behavior affect correctness and source safety; protected browser tests and normative docs require architecture review. Several independently verifiable delivery outcomes.
**Discovery:** The canonical feature records the reviewed call paths, measured repeated-scan costs, reproduced draft race and source-path error, missing Spec integration, duplicate queries, coverage starvation and unresolved passive badge-loss report. Review baseline 58e9e6c; implementation baseline a142984 includes isolated test setup.
**Material assumptions:** Existing batched Pallium API suffices; if not, coordinate a concrete dependency before changing its semantics. Bounded in-process read reuse suffices; worker/service changes require measured justification and revised review. Cache freshness must include dirty files; HEAD-only validation is unacceptable. User approval authorizes source work, not live rollout.
**Plan:** Invoke agent-workflow and classify before code edits. Capture feature and obtain clean-context review of this plan. Implement in four independently reviewed stages from the feature: correctness; shared server read orchestration; common participant refresh and source-aware summaries/projection; integrated qualification/documentation. Use existing async APIs and source guards, source-of-truth files under package/minimap, and sync-mirrors for derived runtimes. For each implementation stage, record specific decisions, changed paths, tests and remaining scope before advancing. Stop on uncovered safety/contract changes, failed assumptions or missing measurable acceptance; never weaken tests to fit implementation.
**Verification plan:** Draft preservation under delayed workspace/item/save responses -> targeted browser races. Correct source actions and stale-response rejection -> generic sibling checkout and file-switch tests. Consistent participant semantics -> This/Across List/Columns provider fixtures and bounded request assertions. Shared reads/cancellation/invalidation -> deterministic concurrency, file/config/source-change and subscriber cancellation tests. Multi-project responsiveness -> isolated HTTP benchmark with scan work counts, event-loop/endpoint latency and documented targets. Actual UI usability -> inspected screenshots at desktop/narrow in loading/settled/stale states. Preserve source/write safety -> existing source-bound and atomic-session suites. Final test verification identifier test plus browser CI, mirrors and doc drift checks.
**Plan review:** Agent technical review: clean-context non-implementer accepted the revised staged plan and Delivery 1 at 89a935d; see Plan review. Later concrete delivery design gates remain applicable.
**Approvals:** Approved by user 2026-10-08: "so open a feature with all the details so we don't lose this, then let's drive a rewrite to fix all those issues and do a proper implementation that handles all of this." Approval follows the presented review and staged consolidation plan; human result review remains required.
**Exceptions:** —
**State:** Ready to implement
<!-- agent-workflow:end -->

## Implementation

Planning: feature captured before implementation. Current blocker is technical plan review, not missing user consent. Manager-owned canonical item: consolidate-roadmap-refresh at roadmap/features/consolidate-roadmap-refresh.md. Shared authoritative checkout for this feature: refresh-consolidation; workers must not edit competing roadmap copies.

## Checkpoint: architecture-review

Change read orchestration and UI reconciliation while retaining source-confinement and write-revision checks. API additions should preserve old callers where practical and document differences. Compatibility risk is medium: old installed clients may still use snapshot-bound counts. Verification covers both API semantics and actual rendering, with no live deployment included.

## Evidence

Pre-implementation review evidence and measurement scope are recorded in the canonical feature. No product edits or qualification performed on this branch yet.

## Recovery

Branch feat/consolidate-roadmap-refresh based on a142984. Next: technical plan review, then assign the first correctness stage with exact paths and scope. Keep the umbrella feature in progress until every acceptance outcome is reconciled.

## Regression coverage audit and delivery boundaries

Audit performed on a142984 before implementation. Existing tests remain acceptance obligations, not evidence that newly identified races are already covered.

| Outcome | Retained coverage | Required additions |
| --- | --- | --- |
| Drafts and asynchronous intent | async-worktree-ui: dirty source switch, consecutive saves, explicit close; worktree-ui: raw source replacement and scope drafts | Clean-start Refresh then type during workspace and item responses; edits during save response; board/scope drafts begun while refresh pending |
| Source confinement and correct file target | source-bound-context, source-bound-http-race, source-bound; worktree-ui bound routes | Sibling selected version Open spec targets its source; stale Spec file/mode response cannot apply |
| Participant modes and lifecycle | board-participant-e2e, in-play, board-presence-performance, pallium-participants | Same freshness in This/Across, visibility return, stale/error retention, single detail request owner, pre-aborted detail |
| Feature identity and provenance | worktree-aggregate, worktree-squash-http, worktree-presence | Cached results retain ambiguity/source identity and normalized IDs; unfinished candidates survive completed overflow |
| Provisional and failed snapshots | async-worktree-ui recovery, late mode/repo responses, opened-only interaction | Independent participant refresh does not delay board; failed refresh preserves prior snapshot and honest coverage |
| Shared cache and invalidation | No equivalent existing contract | One scan for concurrent identical requests; scope isolation; dirty/add/delete/config/source invalidation; TTL/eviction; detached/removed worktrees |
| Publication ordering and cancellation | Existing UI stale-response guards only | Old delayed scan cannot publish after invalidation/write/newer validation; one subscriber abort preserves another; abandoned scan stops; overall deadline |
| Spec summaries and navigation | roadmap-ui hash-return badges; worktree-ui unchanged Spec return | Same source-aware badge behavior in both modes; toolbar/hash mutation reconciliation; unrelated session histories not read |
| Projection and rendering | ui-worktrees and desktop/narrow worktree-ui | One projection per reconciliation, no getter mutation, preserved focus/scroll/selection and consistent totals |
| Shared server performance | board-presence-performance checks batched provider calls | Reproducible multi-project HTTP load and 1/4/16-source fixtures; deterministic work counts/caps in normal CI |
| Safety and packaging | sessions-atomic, source-bound suites, sync-mirrors, portability, runtime lifecycle tests | Retain assertions and no live environment qualification; new read caches must never bypass mutation guards |

Delivery 1 (this initial implementation slice): app.js asynchronous draft safety, selected-source Open spec, Spec response generations and exactly-once participant detail refresh; one dedicated browser regression file plus applicable existing suites, mirrors and any affected docs. It is independently useful before caching or polling changes. Add coverage-only behavior entries for new regression contracts. User-approved strengthened refresh behavior must be recorded separately where existing polling assertions later change.

Delivery 2a: shared source identity/immutable Git evidence reuse and indexed aggregation, with deterministic identity/budget tests. Delivery 2b: bounded mutable snapshot orchestration, shared subscribers, cancellation/deadlines and HTTP freshness contract; only publish with its complete client-compatible endpoint behavior and invalidation tests. Delivery 2c: targeted participant/spec read costs, scoped tests and contract documentation. Review each concrete design before its product edits.

Delivery 3: common participant refresh and source-aware summaries across modes, with API/client compatibility, participant and transition regressions, projection reuse, mirrors and matching documentation. It depends on the snapshot identity/read contract from Delivery 2b. Delivery 4 performs integrated qualification; it must not be used to defer required tests/docs/mirrors from earlier deliveries.

Each independently useful delivery may use its own PR and Work Record referencing this feature; do not arbitrarily split source and tests to avoid limits. Count source, tests and generated mirrors in size estimates; if a coherent delivery exceeds policy, surface the constraint instead of weakening scope or changing policy.

## Cache publication and freshness design gate

Before Delivery 2b implementation, record and review explicit freshness durations, memory/entry limits, scan concurrency/budget and Manual Refresh behavior. Last-known read results may be served with age/stale metadata while revalidation runs. Manual Refresh must request new validation (and may share validation already in progress), never claim a cached response freshly validated without evidence.

Every scope has an invalidation generation. An in-flight scan captures it; publish only if that generation is still current and no newer validation has published. Successful writes and explicit invalidation advance it. Add a deterministic delayed-old-scan test proving invalidated data cannot repopulate the cache after a write or newer scan. File/config fingerprints and bounded revalidation include uncommitted changes; write-time source/revision guards always read current evidence.

## Plan review

Clean-context review of 7f7f702 required clearer independent delivery boundaries, explicit existing/new regression mapping and cache publication ordering. These are addressed above and in the feature; no product edits yet. High/Large classification and previously recorded user approval remain applicable. Delivery 2b concrete policy remains a technical design checkpoint, not permission for live changes.


Technical acceptance: revised plan and Delivery 1 accepted at 89a935d by a clean-context non-implementer. Explicit acceptance covers response-time draft checks, identity-bound save settlement, selected-source Spec actions, stale Spec response rejection and one detail refresh owner. Existing user approval applies. Delivery 2b still requires its concrete cache policy review; this is not result acceptance.
