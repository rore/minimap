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
**Material assumptions:** The manager confirmed preserving existing default fields and dense-default compression; explicit configured fields remain visible, and omitted milestone must never be injected. A grouping identifies a metadata field only for a metadata lens, not a freeform Board heading with a coincidentally matching key. Exact field keys must remain distinct even when CSS-normalized tokens collide. Grouped status suppression must retain source Differences and Read's combined status.
**Plan:** Invoke Agent Workflow and classify before code edits (done). Resolve canonical item reference and preserve prior recovery evidence. Obtain one independent clean-context plan review. Root applies the trivial shared rendering correction; delegate the larger bounded browser fixture/regression draft to a lower-cost implementer, then root verifies tests/docs/visual synthesis and sync. Respect exact field identity and metadata-lens kind, reuse existing excludeKey, avoid a new option/schema/helper layer. Add focused generic-field, Board, default/configured/empty, color, Read/Edit/Raw and This/Across browser coverage using a realistic 60-item multi-group fixture. Inspect desktop/narrow List/Columns/Read captures, sync mirrors, run focused tests, obtain independent result review, then publish reviewed PR for manager-owned merge/deployment. Stop on uncovered default behavior or loss of source/status safety.
**Verification plan:** Browser grouping matrix validates enabled-order/exclusion/restoration in List/Columns and This/Across; status/kind/custom/core/Board cases protect generic scope. Read and complete Edit/Raw checks protect metadata; colorTags/cardColorBy and empty/default cases protect appearance. Sixty-item long-title/milestone/lane desktop/narrow captures plus overflow checks protect real-world usability. Node appearance/lint and mirror parity validate shared artifacts. Required CI job test validates the complete regression surface before merge.
**Plan review:** Agent technical review: Independent clean-context reviewer approved ab07d7bb2039c370b791656eb3a49a6b3e8427aa and the subsequent approval/density clarification before code edits. Exact-key, Board lens, grouped status, Read/color and cross-mode checks are required. Allocation of the trivial shared patch to root and the larger test draft to a lower-cost agent is nonmaterial; behavior and review independence are unchanged.
**Approvals:** Approved by user 2026-10-29: "ok, implement the tag behavior we discussed. test it visually in both views, drive it through review and merge, and update local and the service." Exact approval forwarded by the manager; this task does not perform the manager-owned live deployment.
**Exceptions:** —
**State:** Ready to implement
<!-- agent-workflow:end -->

## Plan and scope

Main base is 8d009c6c9d7b891bfdfd0e4547843b233a2ce6e4. This task owns only its new canonical item and board entry in its isolated checkout. Earlier evidence and recovery refs are preserved. No installed runtime or user service is changed.

Technical plan review is approved. Exact existing human approval and manager confirmation of unchanged default/dense behavior are recorded above; no fresh permission question is required. The manager will add milestone to its own local configuration after delivery; the product must never inject omitted fields.

Intended files: package/minimap/ui/app.js; playwright/group-aware-card-tags.spec.js; README.md; package/minimap/CONTRACT.md; roadmap skill SKILL.md and references/roadmap-contract.md; generated runtime mirrors; this Work Record and canonical item/board. Existing protected browser assertions may change only if they encode the explicitly replaced grouping-badge behavior, with an exact classification and approval entry; do not weaken unrelated expectations.

## Plan review

Independent technical reviewer approved High/Moderate and the existing shared-render approach. It explicitly checked all callers, exact-key collisions in configured/default/custom paths, Board-kind gating, separately rendered default status, Read's status-only exclusion, independent border lookup, default dense CSS and complete required CI. No technical blocker remains. Protected new browser coverage must exercise these triggering paths; result review will inspect actual code, passing evidence and rendered captures.
