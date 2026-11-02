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
**Discovery:** Pending focused inspection of related-work render/load/Open callers, source/version projection, styles and existing regression fixtures.
**Material assumptions:** Existing API and source/revision validation suffice; if reproduction requires changing a backend safety guarantee or public contract, stop affected work and return to planning with owner review.
**Plan:** Invoke Agent Workflow and classify before product edits (done). Complete focused discovery and a clean-context technical plan review before implementation. Reuse existing refresh/navigation machinery and stable identities; no speculative abstraction or scheduler.
**Verification plan:**
- Disclosures, focus, scroll and stale refresh isolation -> focused related-work browser interaction regressions.
- Correct first Open and unchanged source/revision safety -> focused UI/API version/navigation regressions and existing related-work/source safety checks.
- Compact readable real-board layout -> inspected desktop/narrow List/Columns captures with many items, lanes, milestones and task versions.
- Packaging and complete required regression gate -> sync-mirrors and required CI test.
**Plan review:** Pending clean-context technical review after discovery; no product edits permitted yet.
**Approvals:** Not required at this risk level; task owner explicitly assigned this scoped fix. No live changes authorized.
**Exceptions:** —
**State:** Blocked
<!-- agent-workflow:end -->

## Implementation

Created isolated branch feat/linked-task-refresh from current main 468997992ebbd455a59f77cd06580a82c8c05912. This Work Record and immutable requirement baseline precede product edits. Initial planning gate is pending focused discovery and independent technical review, not human approval. Canonical source: roadmap/features/show-feature-related-work.md; its broader unfinished rollout is not owned by this fix.

## Evidence

No implementation or passing-test claim yet. Qualification will use disposable repositories/homes and supported packaged lifecycle scripts; private operational evidence stays ignored.

## Result review

Pending.
