# Linked task refresh and layout

<!-- agent-workflow:start -->
**Outcome:** Linked task refresh preserves the user's disclosures, focus and scroll, and Open task selects the intended unchanged source version reliably in a compact readable layout.
**Target:** minimap
**Scope:** Related-work UI rendering, refresh reconciliation and task navigation; generic focused regression/browser tests; generated runtime mirrors and canonical feature progress notes.
**Constraints:** Preserve stable feature/record/source identity, revision checks, stale/partial coverage, differing task versions, safe links and read-only source boundaries. No canonical project data, installed tools, settings, dependencies, live services, APIs or validation guarantees change.
**Completion criteria:** Same-scope refresh, stale responses and interaction preserve disclosures, focus and scroll without leaking state to another feature/source; first Open targets the chosen valid version and rejects genuinely changed source/revision evidence; task title appears once with compact branch/state/Open/PR rows while differing titles and coverage remain inspectable; realistic List/Columns desktop/narrow interaction checks, mirrors, independent review and required CI pass.
**Requirement baseline:** {"source":"Owner-assigned linked-task refresh follow-up, 2026-11-02","outcome":"Linked task refresh preserves the user's disclosures, focus and scroll, and Open task selects the intended unchanged source version reliably in a compact readable layout.","scope":"Related-work UI rendering, refresh reconciliation and task navigation; generic focused regression/browser tests; generated runtime mirrors and canonical feature progress notes.","constraints":"Preserve stable feature/record/source identity, revision checks, stale/partial coverage, differing task versions, safe links and read-only source boundaries. No canonical project data, installed tools, settings, dependencies, live services, APIs or validation guarantees change.","completion_criteria":"Same-scope refresh, stale responses and interaction preserve disclosures, focus and scroll without leaking state to another feature/source; first Open targets the chosen valid version and rejects genuinely changed source/revision evidence; task title appears once with compact branch/state/Open/PR rows while differing titles and coverage remain inspectable; realistic List/Columns desktop/narrow interaction checks, mirrors, independent review and required CI pass."}
**Relationships:** {"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:show-feature-related-work"}],"pull_requests":[]}
**Risk:** Elevated
**Complexity:** Moderate
**Reason:** Gray UI reconciliation/navigation paths and red browser acceptance tests; async interaction and source-version identity require focused independent review. No contract or safety-guard change is planned.
**Discovery:** renderRelatedWork replaces host.innerHTML and retains only Task details; nested worktree/PR disclosures, focused nodes and reading scroll are lost. renderPreview replaces the enclosing section and carries its outer open state without a same-feature guard. Across buttons use numeric version positions. Source review also identifies a concrete unchanged-Open race: fresh related-work publication replaces the prior same-key manifest before a captured-generation Open reaches lookup. Expired-generation and actual changed-byte reads share the same error, while list responses omit the hash; client retry based on title/state would be unsafe. Existing server hash/path/source/config/HEAD checks suffice if an exactly unchanged index retains its generation. No API or safety guarantee needs changing.
**Material assumptions:** Existing API and source/revision validation suffice; if reproduction requires changing a backend safety guarantee or public contract, stop affected work and return to planning with owner review.
**Plan:** Invoke Agent Workflow and classify before product edits (done). Before implementation, obtain focused independent technical review. In app.js preserve the connected linked-task section during same-feature preview rebuilds and reconcile its keyed fragment without replacing unchanged interactive nodes; scope disclosures by stable feature and record/source identities, retain native open state, focus and ancestor scroll, and prevent state leaking to another feature/source. Replace numeric Open version selection with an exact stable source/item/record identity while still capturing the rendered generation. Render each task title once, with compact branch/state/Open/safe-PR rows, distinct titles and coverage retained; styles.css handles wrapping. Opt only the existing related-work snapshot coordinator into generation reuse when current non-invalidated same-epoch index value, manifest and admission bytes are exactly identical; fresh validation still runs and changed body/hash/config/source still rejects the old generation. Keep all default coordinator semantics, capacity/deadline/eviction rules and server read guards unchanged; no blind retry, alternate-source substitution, new cache or scheduler. Add fail-before/pass-after focused snapshot/server and browser interaction regressions, inspect realistic desktop/narrow List/Columns, sync both runtimes and run required CI. Target files: ui/app.js, ui/styles.css, ui/related-work.js if a shared pure identity helper is warranted, src/roadmap-snapshots.js, server.js opt-in, test/roadmap-snapshots.test.js, test/related-work-server.test.js, focused new browser regression, both generated runtimes and canonical feature notes. Stop for any safety/contract departure or uncovered material assumption.
**Verification plan:**
- Disclosures, focus, scroll and stale refresh isolation -> focused related-work browser interaction regressions.
- Correct first Open and unchanged source/revision safety -> focused UI/API version/navigation regressions and existing related-work/source safety checks.
- Compact readable real-board layout -> inspected desktop/narrow List/Columns captures with many items, lanes, milestones and task versions.
- Packaging and complete required regression gate -> sync-mirrors and required CI test.
**Behavior changes:** [{"target":"repository-contract","path":"playwright/linked-task-refresh.spec.js","classification":"coverage-only","before":"No dedicated refresh-during-interaction linked-task regression covers nested disclosures and first Open.","after":"Add realistic task-version refresh, focus/scroll, source identity, stale response and layout coverage without changing existing assertions.","reason":"Protect the assigned interaction fix and preserve existing source and revision safety."}]
**Plan review:** Pending clean-context technical review after discovery; no product edits permitted yet.
**Approvals:** Not required at this risk level; task owner explicitly assigned this scoped fix. No live changes authorized.
**Exceptions:** —
**State:** Blocked
<!-- agent-workflow:end -->

## Implementation

Created isolated branch feat/linked-task-refresh from current main 468997992ebbd455a59f77cd06580a82c8c05912. This Work Record and immutable requirement baseline precede product edits. Initial planning gate is pending focused discovery and independent technical review, not human approval. Canonical source: roadmap/features/show-feature-related-work.md; its broader unfinished rollout is not owned by this fix.

Discovery: a bounded read-only cheaper-model diagnosis confirms the manifest-rollover interleaving and the lack of client evidence for a safe retry. Default coordinator behavior stays untouched; an opt-in exact-byte unchanged-index identity reuse is the smallest proposed correction, without retaining additional manifests or relaxing any source/content guard. The focused plan review must assess that option against scope, invalidation/expiry safety and current tests. Product/test implementation has not started.

## Checkpoint: architecture-review

What is changing: additive browser acceptance coverage and narrow related-work interaction reconciliation; unchanged related-work snapshots may reuse the same generation only after real validation and exact evidence equality. Why: prevent lost user interactions and false first-open failures without accepting changed record bytes. Compatibility risk: low-to-medium; defaults, public shapes, resource bounds and source/write guards are unchanged. Verify old-generation unchanged reads succeed while body-only edits, deletions, source/config changes, invalidation and capacity eviction still fail safely. Protected browser edits are coverage-only, not relaxed acceptance.

## Evidence

No implementation or passing-test claim yet. Qualification will use disposable repositories/homes and supported packaged lifecycle scripts; private operational evidence stays ignored.

## Result review

Pending.
