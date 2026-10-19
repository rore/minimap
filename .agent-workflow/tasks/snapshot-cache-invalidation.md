<!-- agent-workflow:start -->
**Outcome:** Cached snapshot reads reload invalidated generations directly instead of admitting and returning an obsolete snapshot that forces a server retry.

**Target:** Shared roadmap snapshot coordinator cached-read admission.

**Scope:** Add invalidation/epoch eligibility checks before cached admission and after its await; focused unit regressions, generated runtime mirrors, owning roadmap contribution note and applicable documentation drift check.

**Constraints:** Preserve ordinary age-stale cache reuse, admission validation, cancellation ownership, scan sharing, cache accounting/limits and manifest guards. Do not widen deadlines, weaken server/source/write checks, add abstractions/dependencies, change UI or install/update/restart any live runtime. Work only in the isolated snapshot-cache-invalidation checkout; parent owns delivery and any environment approval.

**Completion criteria:** An already invalidated cached entry never invokes admit and reloads at the current generation. Invalidation during awaited admission cannot return the old entry and instead reloads the current generation. Unchanged age-stale entries remain reusable after successful admission. Existing coalescing, cancellation, eviction/accounting and manifest-isolation tests remain passing; mirror parity, independent review and workflow evidence pass before parent delivery.

**Requirement baseline:**
{"source":"work-record-initial","outcome":"Cached snapshot reads reload invalidated generations directly instead of admitting and returning an obsolete snapshot that forces a server retry.","scope":"Add invalidation/epoch eligibility checks before cached admission and after its await; focused unit regressions, generated runtime mirrors, owning roadmap contribution note and applicable documentation drift check.","constraints":"Preserve ordinary age-stale cache reuse, admission validation, cancellation ownership, scan sharing, cache accounting/limits and manifest guards. Do not widen deadlines, weaken server/source/write checks, add abstractions/dependencies, change UI or install/update/restart any live runtime. Work only in the isolated snapshot-cache-invalidation checkout; parent owns delivery and any environment approval.","completion_criteria":"An already invalidated cached entry never invokes admit and reloads at the current generation. Invalidation during awaited admission cannot return the old entry and instead reloads the current generation. Unchanged age-stale entries remain reusable after successful admission. Existing coalescing, cancellation, eviction/accounting and manifest-isolation tests remain passing; mirror parity, independent review and workflow evidence pass before parent delivery."}

**Relationships:**
{"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:consolidate-roadmap-refresh"}],"pull_requests":[]}

**Risk:** Elevated

**Complexity:** Simple

**Reason:** Coordinator source, its unit file and owning roadmap note are gray; generated runtime copies are watch paths. No protected test contract, API, identity/write guard, persistence, security, policy or dependency change is planned. The shared cache race requires independent review despite a two-condition fix.

**Discovery:** Fetched origin/main and created this checkout from verified 283995cf8f3aae279fc51d55eb39f2c7e67b6874; primary remains untouched. createRoadmapSnapshotCoordinator.read currently allows an invalidated/old-epoch entry into admit and returns it as stale if admitted, checking only cache identity and expiry after the await. invalidateAll increments epoch and marks entries; getManifest already rejects invalidated/old-epoch entries. Workspace/Across and related-work snapshot callers share this coordinator; participant reads use retain=false and bypass cached reuse. Existing unit coverage includes age-stale reuse, admission failure, detached values, sharing, subscriber cancellation, invalidated in-flight scans, eviction/byte limits and manifest isolation. Owning roadmap item was read and its exact tuple resolved with the CLI.

**Material assumptions:** Invalidation is different from elapsed freshness: only invalidated/old epochs must be excluded. A race during admission must fall through to the existing fresh enqueue/coalescing path, without removing a newer replacement entry. No change to invalidateAll, retention bookkeeping, getManifest or server 409 guards is required. If tests show a broader coordinator/state issue, stop and return to planning.

**Plan:** First invoke agent-workflow, classify and commit this Work Record before product/test edits. Pause for parent-arranged independent plan review. After approval, add two deterministic fail-before unit regressions with the existing deferred fixture: invalidation before admission (admit count remains zero), and invalidation during a held admission (fresh current generation and old manifest unavailable). Add invalidation/epoch eligibility to the existing pre-admission and post-await cache conditions; use the current enqueue, removal and sharing paths without a new helper. Run the complete coordinator unit file, relevant snapshot server/deadline checks and mirror parity; reuse the existing age-stale/accounting/cancellation cases rather than duplicating them. Check skill-doc old wording; change prose only if it actually contradicts the fixed internal behavior. Update the owning roadmap contribution, obtain independent result review, commit and hand parent PR/CI/merge. No live update.

**Verification plan:** test: New pre-admission regression fails on the base and passes with admit not invoked and fresh/current generation returned. test: New held-admission race fails on the base and passes with no obsolete return and valid current manifest. test: Complete roadmap-snapshots.test.js retains unchanged age-stale reuse, byte/accounting, cancellation and coalescing coverage. test: Relevant roadmap snapshot server/deadline tests keep HTTP/source guards intact; runtime mirrors match canonical source. test: Diff/skill-doc drift checks and final workflow evidence. Independent agent plan/result review and parent CI remain delivery gates.

**Plan review:** Agent technical review: `/root/snapshot_cache_review` APPROVED 00ce54e on 2026-10-19, forwarded by parent. Implement only the two cache eligibility conditions and deterministic regressions, preserving all existing guards, removal and accounting. Parent authorizes implementation; no further plan gate.

**Approvals:** Approved by user 2026-10-19: "so we should do it". Parent authorizes this narrow repository fix, tests, review and merge; parent owns any separately approved local update. No environment change is part of this implementation.

**Exceptions:** —

**State:** Ready for review
<!-- agent-workflow:end -->

## Implementation

Checkout `C:/Dev/rore/minimap/.local/snapshot-cache-invalidation`, branch `feat/snapshot-cache-invalidation`, base `283995cf`. Initial Work Record committed at `00ce54e` before product/test edits. Exact owning item is `roadmap/features/consolidate-roadmap-refresh.md`, with the CLI-returned tuple in Relationships. Parent owns independent review, PR/CI/merge and live environment decisions.

Plan approved; beginning fail-before unit regressions before the two production condition changes.

## Scope checkpoint

Expected product diff: only the two existing cached-read conditions in `package/minimap/src/roadmap-snapshots.js`, then derived mirrors via sync. New tests use the current pure coordinator fixture and do not start a server or touch user data. No new public behavior or documented API promise is introduced; the existing server invalidation guards stay unchanged. Review any discovered broader requirement before expanding scope.


## Implemented contribution

Only the two existing cached-read conditions changed: an entry must be non-invalidated and match the current epoch before admission, and those conditions are checked again after admission resolves. Existing cache identity/expiry, signal checks, touch/removal, enqueue/coalescing, byte accounting and manifest logic are untouched. Both runtime mirrors were regenerated from the canonical coordinator. No new helper, API/UI behavior, dependency, deadline or identity/write guard was introduced.

Two deterministic deferred-fixture regressions were added. The pre-invalidated case verifies admit is not called and a fresh/current generation is loaded. The during-admission case invalidates while admit is held and verifies a new current generation/manifest instead of the old entry. Existing age-stale, retention/accounting, cancellation, scan sharing and obsolete-publication tests remain unchanged.

## Verification evidence

Fail-before: both new regressions failed against unchanged source. Pre-invalidated admission ran once instead of zero; during-admission invalidation returned the old run instead of performing the second fresh load. Retained log: ignored `tmp/snapshot-cache-evidence/before.log`.

Pass-after: `node --test test/roadmap-snapshots.test.js test/sync-mirrors.test.js` passed 22/22, no failures/skips (`after-unit.log`). This includes all existing ordinary age-stale cache reuse, coalescing, subscriber cancellation, invalidated scan/publication, manifest isolation and cache byte/entry accounting tests. `node --test test/roadmap-snapshot-server.test.js test/roadmap-snapshot-deadline.test.js test/related-work-server.test.js` passed 10/10, no failures/skips, using isolated packaged-server fixtures (`server.log`). These retain HTTP invalidation/source guards, deadlines and related-work generation behavior. Total: 32 passing checks; no browser or live-server test was needed for this internal cache-only fix.

`git diff --check` passed. Skill-doc/CONTRACT keyword sweep found only correct existing source/manifest invalidation and legitimate in-flight409 retry guidance; no document promises reuse of invalidated cached entries. No normative skill/API documentation change is needed. Owning roadmap contribution note is updated without reopening the completed broader feature or claiming a live update. Final source SHA256: `D533FE3724D96C99AF5EB041EB512F6B2BB57153774A7C13BB746175B2F4879F`, identical in both runtime mirrors. Independent result review and final workflow check remain delivery gates.

## Result review

Agent technical review: `/root/snapshot_cache_review` APPROVED the final diff, logs and verification on 2026-10-19, forwarded by parent, with no findings. Reviewer confirmed all three source/runtime hashes and the 32 passing checks. No source changes followed result approval.

Reviewed revision: final implementation diff from `00ce54e`; canonical roadmap-snapshots.js and both generated mirrors SHA256 `D533FE3724D96C99AF5EB041EB512F6B2BB57153774A7C13BB746175B2F4879F`.

Verification adequacy: both deterministic new regressions failed before the fix and pass afterward. The complete coordinator/mirror run passed 22 checks, retaining ordinary age-stale reuse, sharing, cancellation, accounting and manifest coverage. Isolated server/deadline/related-work checks passed 10 checks, retaining existing HTTP/source invalidation guards. Only two eligibility conditions changed; existing removal, enqueue and accounting paths remain intact. No API/UI, dependency or live-runtime change occurred. Parent owns PR/CI/merge and any environment update.

Local workflow check: Redline report and `agent-workflow-runtime.ps1 codex check` passed with exit 0 against implementation commit `fa6b2e28b9d8fcb6aec25a6ce67000d8cc721498` and base `283995cf`. Evidence is retained under ignored `tmp/snapshot-cache-evidence/governance/`. Tracked checkout was clean after the implementation commit; this final documentation note records the successful delivery gate. No push or live environment change was performed.
