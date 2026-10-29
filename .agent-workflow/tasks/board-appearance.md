# Board appearance

Canonical design: [Customize card fields and tag colors](../../roadmap/features/board-appearance.md). Manager-owned planning checkout: C:/Users/I347041/.codex/worktrees/board-appearance/minimap. The feature file is the single design source.

<!-- agent-workflow:start -->
**Outcome:** Users can control visible card metadata and distinguish field values with tag or card-border colors.
**Target:** Minimap.
**Scope:** Optional board appearance configuration, shared badge/card rendering, regression and visual checks, public and agent documentation, generated runtime mirrors.
**Constraints:** Preserve existing defaults, data, filters, grouping, status resolution, source safety and performance; isolate all tests from user installations and real roadmap data. No live updates.
**Completion criteria:** Configured and default boards work in both layouts and worktree modes without cross-board leakage; isolated regression checks and inspected desktop/narrow visuals pass; public instructions and independent review are complete.
**Requirement baseline:**
{"source":"user:77b0e70b-cc6c-462f-86f0-a67fa7a95183","outcome":"Users can control visible card metadata and distinguish field values with tag or card-border colors.","scope":"Optional board appearance configuration, shared badge/card rendering, regression and visual checks, public and agent documentation, generated runtime mirrors.","constraints":"Preserve existing defaults, data, filters, grouping, status resolution, source safety and performance; isolate all tests from user installations and real roadmap data. No live updates.","completion_criteria":"Configured and default boards work in both layouts and worktree modes without cross-board leakage; isolated regression checks and inspected desktop/narrow visuals pass; public instructions and independent review are complete."}
**Relationships:**
{"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:board-appearance"}],"pull_requests":[]}
**Risk:** High
**Complexity:** Moderate
**Reason:** New public configuration contract and canonical/agent contract documentation are protected surfaces; multiple rendering modes require consistent treatment.
**Discovery:** Existing getBadgeTone/renderBadge and buildMetadataBadgeEntries in app.js centralize colors and fields. Default cards cap custom metadata at two. readRoadmapConfig in src/roadmap.js normalizes config. Existing localStorage preferences are view-specific and should not become a second appearance source. KEIR repo uses scalar repo metadata and currently neutral tags.
**Material assumptions:** Existing snapshot transport can carry opened-board appearance without extra reads; inspect all provisional/full paths before implementation. If unsupported, adjust reviewed plan before adding a new endpoint or persistence mechanism. Current user approval covers the discussed design/implementation scope, not live environment changes.
**Plan:** First invoke Agent Workflow to create this record and classify risk before code edits (done). Review canonical feature design against current rendering/config/snapshot code; resolve gaps with a clean-context non-implementer. Normalize optional appearance configuration using a bounded named palette; thread opened-board config through existing snapshots; share metadata/border helpers across modes and detail. Add focused Node and browser regressions, inspect actual screenshots, document configuration, sync mirrors. Stop for data mutation or architectural expansion beyond this scope. Developer owns implementation after acceptance; manager owns design and review.
**Verification plan:** Node tests cover normalization/fallback and malicious config; browser tests cover two boards, both layouts/modes, field ordering/hiding, mapped/unmapped colors, status and selection precedence, refresh/navigation, and details. Inspect desktop/narrow screenshots and palette contrast. Run required regression/CI and mirror/workflow checks; keep isolated MINIMAP_HOME and fixture repositories.
**Plan review:** Pending clean-context technical design review.
**Approvals:** Approved by user 2026-10-29: "Okay, so design this feature, think about it some more, say that we don't have any gaps, say that it's properly designed, then drive the implementation. You have the minimal dev that you can use as a developer, as always make sure we have tests, make sure we do actual visual testing to see how it really looks and not just rely on code. Make sure we see behavior across boards and views, see that this works okay. And when we, like part of the done should also be documentation and to see that we have proper public documentation regarding this functionality."
**Exceptions:** —
**State:** Blocked
<!-- agent-workflow:end -->

## Implementation

2026-10-29: planning only; awaiting technical review and minimap-dev acceptance before code edits. User has authorized the design and implementation; no further approval requested for this same scope. Worktree branch feat/board-appearance, base 2dd85bb758a871cb6a70fcc2f0d59e7e9c9b9cd4. Root user's checkout and live service untouched. Next: review design, then implement in this isolated checkout or developer-owned child branch.

## Evidence

Pending.

## Result review

Pending.
