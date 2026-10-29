# Group-aware card tags

Canonical item: [Hide redundant card tags for the current grouping](../../roadmap/features/group-aware-card-tags.md).

<!-- agent-workflow:start -->
**Outcome:** Cards omit redundant grouping tags while feature Read consistently shows all enabled tags.
**Target:** Minimap.
**Scope:** Shared card metadata rendering, focused realistic browser regressions, public appearance documentation and roadmap-skill guidance, generated runtime mirrors and canonical roadmap records.
**Constraints:** Preserve configured field order, empty/absent fields, milestone configurability, primary Read status, complete Edit/Raw metadata, source/conflict cues, colors, This/Across and existing density rules. No schema/backend change, dependencies, real-project data edits or live environment changes.
**Completion criteria:** Generic grouping suppression and restoration pass in List/Columns and This/Across; Read remains grouping-independent; colors and empty/default configuration remain correct; desktop/narrow large-board renders are inspected; docs, mirrors, independent review and required CI are recorded.
**Requirement baseline:**
{"source":"User-approved group-aware tag assignment, 2026-10-29","outcome":"Cards omit redundant grouping tags while feature Read consistently shows all enabled tags.","scope":"Shared card metadata rendering, focused realistic browser regressions, public appearance documentation and roadmap-skill guidance, generated runtime mirrors and canonical roadmap records.","constraints":"Preserve configured field order, empty/absent fields, milestone configurability, primary Read status, complete Edit/Raw metadata, source/conflict cues, colors, This/Across and existing density rules. No schema/backend change, dependencies, real-project data edits or live environment changes.","completion_criteria":"Generic grouping suppression and restoration pass in List/Columns and This/Across; Read remains grouping-independent; colors and empty/default configuration remain correct; desktop/narrow large-board renders are inspected; docs, mirrors, independent review and required CI are recorded."}
**Relationships:**
{"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:group-aware-card-tags"}],"pull_requests":[]}
**Risk:** High
**Complexity:** Moderate
**Reason:** The shared public appearance contract, agent-facing guidance and protected browser surface change; architecture review is required. The implementation is small but needs cross-mode and visual verification.
**Discovery:** buildMetadataBadgeEntries applies excludeKey only to defaults, while explicit cardFields ignores it. Shared card body separately renders default combined status, which also needs grouping-aware suppression. Read supplies only its own status exclusion and must remain independent. Milestone is already a core default field; dense unconfigured Columns intentionally show only status/priority, while explicit configured fields remain visible. No configuration-schema change is needed.
**Material assumptions:** Preserve existing default fields and dense-default compression; the manager has been told the milestone finding before changing density behavior. A grouping identifies a metadata field only for a metadata lens, not a freeform Board heading with a coincidentally matching key. Grouped status suppression must retain source Differences and Read's combined status.
**Plan:** Invoke Agent Workflow and classify before code edits (done). Resolve canonical item reference and preserve prior recovery evidence. Obtain one independent clean-context plan review. Delegate only the small app.js rendering correction to a lower-cost implementer; root owns tests/docs/visual synthesis and sync. Respect field identity and metadata-lens kind, reuse existing excludeKey, avoid a new option/schema/helper layer. Add focused generic-field, Board, default/configured/empty, color, Read/Edit/Raw and This/Across browser coverage using a realistic 60-item multi-group fixture. Inspect desktop/narrow List/Columns/Read captures, sync mirrors, run focused tests, obtain independent result review, then publish reviewed PR for manager-owned merge/deployment. Stop on uncovered default behavior or loss of source/status safety.
**Verification plan:** Browser grouping matrix validates enabled-order/exclusion/restoration in List/Columns and This/Across; status/kind/custom/core/Board cases protect generic scope. Read and complete Edit/Raw checks protect metadata; colorTags/cardColorBy and empty/default cases protect appearance. Sixty-item long-title/milestone/lane desktop/narrow captures plus overflow checks protect real-world usability. Node appearance/lint and mirror parity validate shared artifacts. Required CI job test validates the complete regression surface before merge.
**Plan review:** Pending independent technical plan review; implementation has not begun.
**Approvals:** User implementation, visual testing, review and delivery approval explicitly attested by the manager, 2026-10-29; exact human wording requested for accurate High-risk recording, not repeat approval.
**Exceptions:** —
**State:** Blocked or returned to planning
<!-- agent-workflow:end -->

## Plan and scope

Main base is 8d009c6c9d7b891bfdfd0e4547843b233a2ce6e4. This task owns only its new canonical item and board entry in its isolated checkout. Earlier evidence and recovery refs are preserved. No installed runtime or user service is changed.

Current block is the independent technical plan review and accurate transcription of the already-granted human approval. The default milestone/density finding is disclosed to the manager; preserve existing behavior unless explicitly clarified. Scope does not require a fresh permission question to the user.

Intended files: package/minimap/ui/app.js; playwright/group-aware-card-tags.spec.js; README.md; package/minimap/CONTRACT.md; roadmap skill SKILL.md and references/roadmap-contract.md; generated runtime mirrors; this Work Record and canonical item/board. Existing protected browser assertions may change only if they encode the explicitly replaced grouping-badge behavior, with an exact classification and approval entry; do not weaken unrelated expectations.
