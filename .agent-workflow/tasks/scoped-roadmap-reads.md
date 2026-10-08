# Scoped roadmap read costs

<!-- agent-workflow:start -->
**Outcome:** Reduce scoped roadmap read costs without changing public participant or session semantics.
**Target:** Minimap server participant detail and roadmap Spec summary reads.
**Scope:** package/minimap/server.js; package/minimap/src/sessions.js and pallium.js; focused new Node regression test; generated runtime mirrors; this Work Record.
**Constraints:** Keep session persistence/mutation/recovery behavior and public unfiltered session listing unchanged. Preserve source/write guards and provider validation. No live environment changes, installs, schema changes or new dependencies. Qualification uses disposable data only.
**Completion criteria:** Participant detail reads the item index once and preserves missing-item errors; scoped Spec listing does not read unrelated session detail files and preserves normalization and omitted-filter behavior; pre-aborted participant detail makes zero provider calls; targeted and safety checks pass with independent review.
**Risk:** High
**Complexity:** Moderate
**Reason:** sessions.js is a red persistence surface although the change is read filtering only. Generated mirrors and server integration are included.
**Discovery:** Review of58e9e6c found detail handler calls readItemById then loadWorkspace, parsing the index twice; global Spec listing reads every session before roadmap filtering; participant detail lacks the pre-aborted signal guard already present in batched count lookup. Baselinea142984 includes isolated test setup.
**Material assumptions:** Session index keys already use normalizeFileKey; filtering must reuse that exact rule including Windows case normalization. Filtering is optional and unfiltered list behavior remains identical. If this requires changing recovery or persistence semantics, stop and revise scope.
**Plan:** Classify and commit this record before source edits. Obtain clean-context technical review. Add generic tests first: selected and unrelated sessions, case/path normalization, empty selection and unfiltered listing; instrument test-owned fs reads to prove no unrelated detail read; pre-aborted detail fetch spy must remain zero. Add optional targetFiles filtering in listFileSessions before per-session recovery/detail reads, using normalizeFileKey. Board enrichment passes the workspace file paths. Participant handler uses one loadWorkspace, validates workspace.items[id] and preserves404. Add AbortError guard before detail network work. Sync mirrors, run focused and sessions-atomic/source-bound safety checks, review docs for drift and obtain independent result review. This independently useful delivery2c does not depend on future snapshot caching.
**Verification plan:** Filtered listing -> new Node tests with real disposable sessions and fs read counts, including unfiltered/empty selection and Windows normalized keys. One index load -> isolated HTTP detail read instrumentation or equivalent real handler regression; missing item remains404. Cancellation -> pre-aborted detail test fails before fix and passes with zero fetches. Preserve session integrity -> sessions-atomic and existing session listing tests. Preserve API/source behavior -> source-bound and participant tests. Mirrors -> sync-mirrors test. No public documented semantics changed; record drift applicability.
**Plan review:** Agent technical review: clean-context non-implementer accepted fae6c9f, with own-property item checks, normalized pre-read filtering and existing disabled/unsupported precedence preserved.
**Approvals:** Approved by user 2026-10-08: "so open a feature with all the details so we don't lose this, then let's drive a rewrite to fix all those issues and do a proper implementation that handles all of this." This independent scoped-read delivery implements findings captured in the approved canonical feature; human result review remains required.
**Exceptions:** —
**State:** Ready to implement
**Requirement baseline:** {"source":"work-record-initial","outcome":"Reduce scoped roadmap read costs without changing public participant or session semantics.","scope":"package/minimap/server.js; package/minimap/src/sessions.js and pallium.js; focused new Node regression test; generated runtime mirrors; this Work Record.","constraints":"Keep session persistence/mutation/recovery behavior and public unfiltered session listing unchanged. Preserve source/write guards and provider validation. No live environment changes, installs, schema changes or new dependencies. Qualification uses disposable data only.","completion_criteria":"Participant detail reads the item index once and preserves missing-item errors; scoped Spec listing does not read unrelated session detail files and preserves normalization and omitted-filter behavior; pre-aborted participant detail makes zero provider calls; targeted and safety checks pass with independent review."}
<!-- agent-workflow:end -->

## Implementation

Planning only. Independent delivery2c of consolidate-roadmap-refresh. Canonical feature remains manager-owned at C:/Users/I347041/.codex/worktrees/refresh-consolidation/minimap/roadmap/features/consolidate-roadmap-refresh.md (PR43). Do not duplicate or modify it here.

## Recovery

Branch feat/scoped-roadmap-reads froma142984. Next: technical review, tests first, scoped source edits. No product or environment edits yet.
