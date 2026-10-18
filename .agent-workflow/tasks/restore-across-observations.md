# Restore Across observations

User authorization (2026-10-18): "ok, fix these issues and investigate the missing badges and related work too. add regression tests and check visually in both views. drive it through review and merge, don't leave it hanging."

This backend contribution belongs to the manager-owned `preserve-board-view-state` feature, whose verified exact reference is captured below; it is not a separate roadmap feature. UI and final visual verification remain manager-owned.

<!-- agent-workflow:start -->
**Outcome:** Across worktrees completes within its existing deadlines so feature session observations can load.

**Target:** Minimap.

**Scope:** Worktree aggregate read performance, focused backend regressions and measurement evidence, generated runtime mirrors, and investigation of missing Related work data.

**Constraints:** Preserve lineage proof, ambiguity handling, source confinement, source and workspace revalidation, bounded Git work, existing deadlines, and public response shapes. Do not change live services, user applications, configuration, data, inactivity cleanup, or infer Work Record relationships.

**Completion criteria:** A cold Pallium aggregate completes below the existing 30-second deadline; regression tests preserve lineage and bounded work; manager verifies Across session observation loading and both UI views; missing Related work is explained from declared source data.

**Requirement baseline:**
{"source":"user-request-2026-10-18","outcome":"Across worktrees completes within its existing deadlines so feature session observations can load.","scope":"Worktree aggregate read performance, focused backend regressions and measurement evidence, generated runtime mirrors, and investigation of missing Related work data.","constraints":"Preserve lineage proof, ambiguity handling, source confinement, source and workspace revalidation, bounded Git work, existing deadlines, and public response shapes. Do not change live services, user applications, configuration, data, inactivity cleanup, or infer Work Record relationships.","completion_criteria":"A cold Pallium aggregate completes below the existing 30-second deadline; regression tests preserve lineage and bounded work; manager verifies Across session observation loading and both UI views; missing Related work is explained from declared source data."}

**Relationships:**
{"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:preserve-board-view-state"}],"pull_requests":["https://github.com/rore/minimap/pull/53"]}

**Risk:** High

**Complexity:** Moderate

**Reason:** Backend aggregation and its focused tests alone were assessed Elevated. The combined PR also updates canonical contract prose for remembered board preferences; the deterministic whole-change Redline floor requires High for every changed Work Record. Lineage correctness, bounded Git work and live source validation remain protected; this classification does not expand backend scope.

**Discovery:** The direct exported loadWorktreeAggregate on Pallium timed out at 32009 ms with a 32000 ms abort. The UI and snapshot coordinator deadlines are 30000 ms. Across provisional data skips refreshBoardPresence; failed full loads set badges unavailable. The source cap admits at most 16 of 25 Pallium checkouts. Full aggregate currently awaits up to 120 lineage pairs sequentially. Existing per-scan Git caches are recreated on every scan. All 25 Pallium checkouts contain zero line-start **Relationships:** declarations in their 278–308 Work Records.

**Material assumptions:** The confirmed cold aggregate timeout is reproducible from staged direct-read timing; if another stage dominates, optimize that stage and return the concrete plan for review. Existing lineage evidence and mutable-workspace checks are required behavior; stop if a proposed optimization weakens them. Missing Work Record declarations explain absent links; do not manufacture relationships.

**Plan:** Baseline committed at 3aa319d before code. Stage-only profiling identifies sequential lineage reads as the cold-load bottleneck. In package/minimap/src/worktree-aggregate.js, separate the baseline ancestry read (merge base, immutable ancestor tree, deleted paths, live item candidate checks) from squash completion. Run baseline reads in canonical batches of four under a module-wide eight-read limit shared across aggregate calls, matching the existing coordinator's two active scans; promise-deduplicate merge-base/tree/deletion reads within the request cache. Complete squash evidence in the original canonical pair order so the existing 32-history and 8192-change budgets and uncertainty ordering remain deterministic. For identical heads, use that head as merge base; retain deletion commands even for empty ranges to preserve unavailable-source error evidence. Preserve existing errors, cancellation, identity breaks, source confinement, and final source revalidation. No cross-scan cache, dependency, or deadline change. Add focused concurrent-read bounds/deduplication/cancellation tests and run existing lineage regressions. Document and test legacy Related-work data distinctly from an empty successful or unavailable scan. Generate mirrors only via scripts/sync-mirrors.mjs. Stop and return to planning if cold completion still misses the existing deadline or the change needs protected source-bound/contract files.

**Verification plan:**
- Cold full snapshots and observations complete within existing deadlines with full admitted coverage → bounded direct aggregate timing and disposable packaged-server qualification against Pallium with a healthy mock provider.
- Two simultaneous fresh distinct-checkout snapshots complete within existing deadlines → disposable packaged-server concurrent request timings and exact loaded/excluded/features/uncertainty counts.
- Git reads remain bounded and cancellable without abandoned children → scheduler unit tests and actual six-source aggregate concurrency/abort regression in test/worktree-aggregate.test.js.
- Lineage proof and deterministic squash budgets remain intact → existing aggregate tests for deletion/recreation, ID changes, squash equivalence, independent identities, and raw/global history limits; existing worktree-evidence-performance.test.js for local immutable memo limits.
- Badge references and source/workspace guards remain valid → snapshot, worktree-source HTTP, worktree-squash HTTP, participant-presence and payload HTTP suites.
- Missing Related-work data is distinguished from known empty or unavailable results without inference → scanner legacy/unverified tests and related-work-server.test.js exact-match/stale-refresh regressions.
- Runtime mirrors and workflow integrity remain correct → scripts/sync-mirrors.mjs, test/sync-mirrors.test.js, fresh Redline verdict and Agent Workflow check.
- Both board views remain usable → manager-owned integrated visual verification; this backend contribution leaves canonical feature reconciliation to the manager.

**Plan review:** Agent technical review: /root/related_work_result_review at b724e2c, PASS, relayed by manager /root. Narrow global-eight/per-scan-four delta approved by the same reviewer through manager /root on 2026-10-18 after the global-four contention failure. Preserve mutable-item and final source/workspace validation; cancellation removes queued jobs and starts no more Git work; batch failures must be fully handled. Verify actual aggregate-path concurrency, waiter cleanup, both fresh distinct-key full snapshots under 30 seconds with coverage and healthy observations. Eight cat-file buffers can exceed 64 MiB once concatenation copies are included; the child bound is not a total memory claim.

**Approvals:** Approved by user 2026-10-18: "ok, fix these issues and investigate the missing badges and related work too. add regression tests and check visually in both views. drive it through review and merge, don't leave it hanging." This covers the planned repository fixes and isolated tests; it does not authorize live environment changes. Separate human result review is pending on the combined PR.

**State:** Ready for review
<!-- agent-workflow:end -->

## Implementation

- Created isolated `feat/restore-across-observations` worktree from `5072122c7353f7519c1aeda4fcac072682b55b26`. This initial record precedes production edits. Next: isolate stage cost and obtain concrete plan review.
- Discovery profiling used a temporary module copied into the isolated worktree with stage/count output only. Discovery finished at 2226 ms (16 sources); workspaces loaded at 3252 ms; lineage pair 11:15 began at 34965 ms; bounded abort fired at 35007 ms before lineage completion or final revalidation. This establishes the cold lineage loop as the bottleneck. Temporary instrumentation will not ship.
- Initial plan review passed at b724e2c for a four-child global ceiling covering actual Git reads (including squash commands and ancestor blobs), not merely baseline tasks. That initial ceiling was later replaced by the reviewed eight-global/four-per-scan adjustment below. Squash completion remains canonical and serial per scan.
- First implementation: direct cold aggregate completed at 18429 ms, 16 loaded sources, 9 capped exclusions, 162 features, zero identity uncertainties. An isolated packaged server with a disposable MINIMAP_HOME and mock participant provider completed full cold snapshot at 25219 ms, observation at 25252 ms, HTTP 200/status ok/32 rows/sample count 2. However, two simultaneous fresh snapshots for distinct opened Pallium checkouts both timed out at 30013–30014 ms under global four-read contention. The four-slot throughput assumption failed; implementation paused for review of the narrow eight-global/four-per-scan adjustment. Existing deadlines remain unchanged.
- Approved eight-global/four-per-scan implementation preserves canonical squash completion and request-local in-flight evidence memoization. Owned Git reads now settle only after child close, including abort/error paths; failed ancestry batches drain all branches before rejecting. Real-process regression verifies one scan uses at most four lineage children, two opened-checkout scans overlap above four but never exceed eight, and cancellation returns with zero owned children and no post-abort starts. A bounded Windows fixture-cleanup retry handles transient EBUSY after the zero-child assertion; it does not replace that assertion.
- Final packaged-server qualification used a disposable MINIMAP_HOME, ephemeral loopback port, and test participant provider; normal lifecycle scripts started/stopped only that server. The live Minimap/Pallium services and data were untouched. Final full snapshot plus observation: cold 21471/21491 ms; simultaneous fresh main 24299/24330 ms and linked checkout 25179/25184 ms. All snapshots: HTTP 200, 16 loaded, 9 capped exclusions, 162 features, zero identity uncertainties. All observations: HTTP 200, status ok, 32 rows, sample participant count 2. Provider received exactly three calls. Disposable server stopped and home removed.

## Evidence

- Read-only direct aggregate: `loadWorktreeAggregate("C:/Dev/rore/Pallium", { signal: AbortSignal.timeout(32000) })` returned `{"ms":32009,"error":"TimeoutError","code":23,"message":"The operation was aborted due to timeout"}`. No HTTP or service mutation.
- Related-work inspection: enumerate `git -C C:/Dev/rore/Pallium worktree list --porcelain`, read each checkout's `.agent-workflow/tasks/*.md`, and count records matching `(?m)^\*\*Relationships:\*\*`; output only checkout names and counts. All 25 checkouts had zero declarations; canonical checkout had 307 records. Scanner and codec exclude legacy records from declared source matches; route requires exact provider/scope/local reference. Related-work details render only after opening a feature preview and begin collapsed.
- Exact source reference: manager supplied the CLI-verified tuple from `C:/Dev/rore/minimap/.local/preserve-board-view-state/roadmap/features/preserve-board-view-state.md` at `de22d97`: provider `minimap`, scope `roadmap:v1:git:github.com/rore/minimap#roadmap`, local `item:v1:preserve-board-view-state`. Captured verbatim and read back in Relationships; canonical merge remains manager-owned.
- Initial implementation checks passed: 33 aggregate lineage tests, 27 snapshot/source/presence/Related-work HTTP/payload/mirror tests, nine scheduler/Related-work checks. After close-draining and global-eight changes, real aggregate concurrency/abort and known-deletion failure regressions passed; final focused suite is recorded below when complete.
- Existing Related-work coverage: `test/related-work.test.js` unverified-source test prohibits inferred links; `test/related-work-server.test.js` distinguishes unverified empty results from confirmed zero, validates exact nested-root matching, and preserves stale last-good data after invalid refresh. Added legacy/no-declaration regression distinguishes partial legacy coverage from successful empty and unavailable/missing-workflow scans.
- Skill-doc drift sweep searched sequential/serial/concurrency/deadline/worktree-cap phrases in both skill docs/reference trees. Existing source limits, deadlines, manifest observations, and unknown/partial semantics remain accurate; no behavioral contract or skill-doc edit is needed.
- Final focused suite on production commit 3f7868273a81ac79f648d962f88143fb0dcf7b43: `node --test --test-concurrency=2 test/worktree-aggregate.test.js test/worktree-git-read.test.js test/worktree-evidence-performance.test.js test/related-work.test.js test/related-work-server.test.js test/worktree-squash-http.test.js test/worktree-source-http.test.js test/worktree-payload-server.test.js test/sync-mirrors.test.js test/worktree-presence.test.js test/roadmap-snapshots.test.js` — 70 passed, zero failed/skipped/cancelled, 170938 ms.
- `git diff --check` passed. Fresh Redline evidence from base 5072122 and the production commit reports no boundary violation or required checkpoint, with the existing gray/Elevated floor. Workflow check passed clean, exit 0, after using the already-installed `C:/Dev/rore/agent-workflow/.venv/Scripts/python.exe` through process-local PYTHON and the fresh explicit verdict; nothing was installed or changed persistently. Default Python discovery was unavailable, which was not treated as a reason to alter the environment.
- Reproducible temporary qualification harness and fresh risk evidence remain under this isolated checkout's ignored `tmp/measure-across-http.mjs` and `tmp/backend-qualification/`. The temporary instrumented production-module copy was removed before mirror generation; it is neither tracked nor present in either runtime.

## Result review

Agent technical review: /root/related_work_result_review, PASS, relayed by manager /root on 2026-10-18.

Reviewed revision: 3f7868273a81ac79f648d962f88143fb0dcf7b43; production source SHA256 9B532AEA4AA5E95699C7F5E6558D945D1DB67E8886F23307E47198353268A1D0, with matching generated mirrors.

Verification adequacy: The independent reviewer accepted the actual child-process bound/cancellation checks, preserved lineage regressions, Related-work data findings, and cold/concurrent snapshot-plus-observation timings. Baseline and task context remain unchanged. Final focused suite passed all 70 tests; manager-owned integrated visual checks remain separate evidence.

## Recovery

PR #53 CI at `25dcefc` passed 437 Node tests, skipped one and failed one stale command-count assertion in `test/git-read-consolidation.test.js`. The same-HEAD optimization legitimately removes merge-base: the test now explicitly requires zero merge-base calls and 12 total commands, retaining its coverage and repeated-read assertions. Focused suite passed 6/6. Independent delta review by `/root/related_work_result_review` passed; no production change. Full CI is rerun on the updated head before merge.

Branch: `feat/restore-across-observations`. Base: `5072122c7353f7519c1aeda4fcac072682b55b26`. Backend implementation and focused regressions are complete; final verification, result review and manager integration remain. Do not push, merge, or replace any live runtime from this branch. Canonical feature reconciliation and both-view visual checks belong to the manager.
