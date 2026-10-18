# Restore Across observations

User authorization (2026-10-18): "ok, fix these issues and investigate the missing badges and related work too. add regression tests and check visually in both views. drive it through review and merge, don't leave it hanging."

This backend contribution belongs to the manager-owned `preserve-board-view-state` feature. Exact feature reference is pending manager resolution; it is not a separate roadmap feature. UI and final visual verification remain manager-owned.

<!-- agent-workflow:start -->
**Outcome:** Across worktrees completes within its existing deadlines so feature session observations can load.

**Target:** Minimap.

**Scope:** Worktree aggregate read performance, focused backend regressions and measurement evidence, generated runtime mirrors, and investigation of missing Related work data.

**Constraints:** Preserve lineage proof, ambiguity handling, source confinement, source and workspace revalidation, bounded Git work, existing deadlines, and public response shapes. Do not change live services, user applications, configuration, data, inactivity cleanup, or infer Work Record relationships.

**Completion criteria:** A cold Pallium aggregate completes below the existing 30-second deadline; regression tests preserve lineage and bounded work; manager verifies Across session observation loading and both UI views; missing Related work is explained from declared source data.

**Requirement baseline:**
{"source":"user-request-2026-10-18","outcome":"Across worktrees completes within its existing deadlines so feature session observations can load.","scope":"Worktree aggregate read performance, focused backend regressions and measurement evidence, generated runtime mirrors, and investigation of missing Related work data.","constraints":"Preserve lineage proof, ambiguity handling, source confinement, source and workspace revalidation, bounded Git work, existing deadlines, and public response shapes. Do not change live services, user applications, configuration, data, inactivity cleanup, or infer Work Record relationships.","completion_criteria":"A cold Pallium aggregate completes below the existing 30-second deadline; regression tests preserve lineage and bounded work; manager verifies Across session observation loading and both UI views; missing Related work is explained from declared source data."}

**Relationships:**
{"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:preserve-board-view-state"}],"pull_requests":[]}

**Risk:** Elevated

**Complexity:** Moderate

**Reason:** Backend aggregation and its focused tests are gray paths; lineage correctness and bounded Git work must survive the performance change. Generated runtime paths are watched. No boundary changes or protected acceptance tests are planned.

**Discovery:** The direct exported loadWorktreeAggregate on Pallium timed out at 32009 ms with a 32000 ms abort. The UI and snapshot coordinator deadlines are 30000 ms. Across provisional data skips refreshBoardPresence; failed full loads set badges unavailable. The source cap admits at most 16 of 25 Pallium checkouts. Full aggregate currently awaits up to 120 lineage pairs sequentially. Existing per-scan Git caches are recreated on every scan. All 25 Pallium checkouts contain zero line-start **Relationships:** declarations in their 278–308 Work Records.

**Material assumptions:** The confirmed cold aggregate timeout is reproducible from staged direct-read timing; if another stage dominates, optimize that stage and return the concrete plan for review. Existing lineage evidence and mutable-workspace checks are required behavior; stop if a proposed optimization weakens them. Missing Work Record declarations explain absent links; do not manufacture relationships.

**Plan:** Commit this immutable baseline before code. Profile stages using an isolated temporary module/harness, then record the smallest evidence-backed optimization and submit it for manager and clean-context technical review before production edits. Preserve shared Git work bounds, identity evidence, and revalidation.

**Verification plan:** Measure one cold direct Pallium aggregate with timings and a bounded abort; add a focused performance/bounded-work regression; run existing worktree aggregation, source, snapshot, participant, and Related-work tests relevant to the change; run mirror sync and workflow checks. Manager owns integration and visual verification of both views.

**Plan review:** Pending profiling and concrete-plan review; production edits have not begun.

**Approvals:** Not required at this risk level. User authorization above covers repository fixes and isolated tests; it does not authorize live environment changes.

**State:** Blocked
<!-- agent-workflow:end -->

## Implementation

- Created isolated `feat/restore-across-observations` worktree from `5072122c7353f7519c1aeda4fcac072682b55b26`. This initial record precedes production edits. Next: isolate stage cost and obtain concrete plan review.

## Evidence

- Read-only direct aggregate: `loadWorktreeAggregate("C:/Dev/rore/Pallium", { signal: AbortSignal.timeout(32000) })` returned `{"ms":32009,"error":"TimeoutError","code":23,"message":"The operation was aborted due to timeout"}`. No HTTP or service mutation.
- Related-work inspection: enumerate `git -C C:/Dev/rore/Pallium worktree list --porcelain`, read each checkout's `.agent-workflow/tasks/*.md`, and count records matching `(?m)^\*\*Relationships:\*\*`; output only checkout names and counts. All 25 checkouts had zero declarations; canonical checkout had 307 records. Scanner and codec exclude legacy records from declared source matches; route requires exact provider/scope/local reference. Related-work details render only after opening a feature preview and begin collapsed.
- Exact source reference: manager supplied the CLI-verified tuple from `C:/Dev/rore/minimap/.local/preserve-board-view-state/roadmap/features/preserve-board-view-state.md` at `de22d97`: provider `minimap`, scope `roadmap:v1:git:github.com/rore/minimap#roadmap`, local `item:v1:preserve-board-view-state`. Captured verbatim and read back in Relationships; canonical merge remains manager-owned.

## Recovery

Branch: `feat/restore-across-observations`. Base: `5072122c7353f7519c1aeda4fcac072682b55b26`. No production changes. Continue with isolated stage timing, then manager/technical plan review.
