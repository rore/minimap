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
**Plan review:** Pending clean-context non-implementer review of this record and canonical feature; no product edits until accepted.
**Approvals:** Approved by user 2026-10-08: "so open a feature with all the details so we don't lose this, then let's drive a rewrite to fix all those issues and do a proper implementation that handles all of this." Approval follows the presented review and staged consolidation plan; human result review remains required.
**Exceptions:** —
**State:** Blocked
<!-- agent-workflow:end -->

## Implementation

Planning: feature captured before implementation. Current blocker is technical plan review, not missing user consent. Manager-owned canonical item: consolidate-roadmap-refresh at roadmap/features/consolidate-roadmap-refresh.md. Shared authoritative checkout for this feature: refresh-consolidation; workers must not edit competing roadmap copies.

## Checkpoint: architecture-review

Change read orchestration and UI reconciliation while retaining source-confinement and write-revision checks. API additions should preserve old callers where practical and document differences. Compatibility risk is medium: old installed clients may still use snapshot-bound counts. Verification covers both API semantics and actual rendering, with no live deployment included.

## Evidence

Pre-implementation review evidence and measurement scope are recorded in the canonical feature. No product edits or qualification performed on this branch yet.

## Recovery

Branch feat/consolidate-roadmap-refresh based on a142984. Next: technical plan review, then assign the first correctness stage with exact paths and scope. Keep the umbrella feature in progress until every acceptance outcome is reconciled.
