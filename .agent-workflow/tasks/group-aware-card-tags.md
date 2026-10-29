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
{"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:group-aware-card-tags"}],"pull_requests":["https://github.com/rore/minimap/pull/81"]}
**Risk:** High
**Complexity:** Moderate
**Reason:** The shared public appearance contract, agent-facing guidance and protected browser surface change; architecture review is required. The implementation is small but needs cross-mode and visual verification.
**Discovery:** buildMetadataBadgeEntries applies excludeKey only to defaults, while explicit cardFields ignores it. Shared card body separately renders default combined status, which also needs grouping-aware suppression. Read supplies only its own status exclusion and must remain independent. Milestone is already a core default field; dense unconfigured Columns intentionally show only status/priority, while explicit configured fields remain visible. No configuration-schema change is needed.
**Material assumptions:** The manager confirmed preserving existing default fields and dense-default compression; explicit configured fields remain visible, and omitted milestone must never be injected. A grouping identifies a metadata field only for a metadata lens, not a freeform Board heading with a coincidentally matching key. Exact field keys must remain distinct even when CSS-normalized tokens collide. Grouped status suppression must retain source Differences and Read's combined status.
**Plan:** Invoke Agent Workflow and classify before code edits (done). Resolve canonical item reference and preserve prior recovery evidence. Obtain one independent clean-context plan review. Root applies the trivial shared rendering correction; delegate the larger bounded browser fixture/regression draft to a lower-cost implementer, then root verifies tests/docs/visual synthesis and sync. Respect exact field identity and metadata-lens kind, reuse existing excludeKey, avoid a new option/schema/helper layer. Add focused generic-field, Board, default/configured/empty, color, Read/Edit/Raw and This/Across browser coverage using a realistic 60-item multi-group fixture. Inspect desktop/narrow List/Columns/Read captures, sync mirrors, run focused tests, obtain independent result review, then publish reviewed PR for manager-owned merge/deployment. Stop on uncovered default behavior or loss of source/status safety.
**Verification plan:** Generic grouping/order/restoration → focused browser matrix in List/Columns and This/Across, including status/kind/custom/core/Board. Metadata preservation → Read and complete Edit/Raw assertions. Appearance preservation → colorTags/cardColorBy, empty/default and exact-key browser cases. Real-world usability → inspected sixty-item long-title/milestone/lane desktop/narrow captures and overflow checks. Shared artifacts → Node appearance/lint and mirror parity. Complete regression → required CI job test before merge.
**Plan review:** Agent technical review: Independent clean-context reviewer approved ab07d7bb2039c370b791656eb3a49a6b3e8427aa and the subsequent approval/density clarification before code edits. Exact-key, Board lens, grouped status, Read/color and cross-mode checks are required. Allocation of the trivial shared patch to root and the larger test draft to a lower-cost agent is nonmaterial; behavior and review independence are unchanged.
**Approvals:** Approved by user 2026-10-29: "ok, implement the tag behavior we discussed. test it visually in both views, drive it through review and merge, and update local and the service." Exact approval forwarded by the manager; this task does not perform the manager-owned live deployment.
**Behavior changes:** [{"target":"repository-contract","path":"playwright/group-aware-card-tags.spec.js","classification":"coverage-only","before":"No dedicated grouping-aware configured/default metadata regression exists.","after":"Add isolated exact-key, Board, order/restoration, Read/Edit/Raw, color, density and realistic desktop/narrow coverage for the approved grouping behavior.","reason":"Protect the approved grouping-aware tag contract without weakening existing acceptance assertions."}]
**Exceptions:** —
**State:** Ready for review
<!-- agent-workflow:end -->

## Plan and scope

Main base is 8d009c6c9d7b891bfdfd0e4547843b233a2ce6e4. This task owns only its new canonical item and board entry in its isolated checkout. Earlier evidence and recovery refs are preserved. No installed runtime or user service is changed.

Technical plan review is approved. Exact existing human approval and manager confirmation of unchanged default/dense behavior are recorded above; no fresh permission question is required. The manager will add milestone to its own local configuration after delivery; the product must never inject omitted fields.

Intended files: package/minimap/ui/app.js; playwright/group-aware-card-tags.spec.js; README.md; package/minimap/CONTRACT.md; roadmap skill SKILL.md and references/roadmap-contract.md; generated runtime mirrors; this Work Record and canonical item/board. Existing protected browser assertions may change only if they encode the explicitly replaced grouping-badge behavior, with an exact classification and approval entry; do not weaken unrelated expectations.

## Plan review

Independent technical reviewer approved High/Moderate and the existing shared-render approach. It explicitly checked all callers, exact-key collisions in configured/default/custom paths, Board-kind gating, separately rendered default status, Read's status-only exclusion, independent border lookup, default dense CSS and complete required CI. No technical blocker remains. Protected new browser coverage must exercise these triggering paths; result review will inspect actual code, passing evidence and rendered captures.

## Implementation

2026-10-29: Shared rendering now applies exact-key exclusion in configured/default/custom paths. Only a derived metadata lens supplies an excluded field; freeform Board supplies none. The separately rendered default status follows the same rule. Read retains its status-only exclusion and original field selection, while card border colors still read original metadata. No CSS, schema, backend, dependency or live environment change. Both runtime mirrors are synchronized.

Lower-cost agent supplied the bounded browser draft; root corrected fixture completeness, selectors, meaningful metadata domains and contradictory expectations, added default/exact-key/color cases and performed actual execution/visual inspection. The draft's sandbox limitation did not change task scope or become a product blocker. Test launch uses existing Playwright and packaged lifecycle scripts in an isolated registry/port; no user service is reused or replaced.

Public README, CONTRACT and roadmap skill/reference now describe grouping-only card exclusion, grouping-independent Read, explicit milestone selection, unchanged density and independent borders. The spec-review skill has no affected appearance prose; both packaged runtime trees carry the shared fix. Old grouping-field wording was swept.

## Verification

- Focused Node appearance/filter/lint and mirror parity: 32/32 passed.
- Initial browser run: default/status/exact-key/density passed; configured and color cases failed on test sequencing, not accepted as green. Read is asynchronous, and Across Edit requires a source-specific confirmation.
- Color/empty/omitted-field and border-only regression passed its focused recheck. The complete configured grouping matrix passed its final recheck after explicitly handling the existing Edit confirmation; no test timeout, retry, product safety prompt or assertion was weakened.
- Captures inspected directly include desktop/narrow List and Columns, 12 milestone groups, 60 items, 10 freeform groups, long metadata, and Read with all enabled tags. Viewport-only mobile captures replace unreadably tall full-page evidence. Root and manager both inspected actual captures. No screenshot manipulation or real-project data edits.
- Added explicit default Board/custom-board collision coverage; it and the unchanged existing appearance/Read regressions passed 3/3 in the focused compatibility run. All three new regression cases now have passing evidence, with earlier sequencing failures recorded above. Required full CI remains a merge gate.

Canonical reference was resolved through the bundled CLI, stored/read back in Relationships and successfully attached through Pallium MCP. Earlier unrelated associations remain untouched. The manager requested canonical completion reconciliation in this PR: implementation is locally verified, the item is done and its board entry is in Done, but independent result acceptance, required CI, merge and deployment are explicitly pending. No delivered/live claim is made. Evidence remains ignored in the isolated checkout on feat/group-aware-card-tags.

## Result review

Agent technical review: Independent clean-context reviewer, completed bounded group-aware tag result review.
Reviewed revision: 1342ae32434fdc42b51e76a384d554ae89ad226d.
Verification adequacy: Approved with no actionable findings. Reviewer inspected the connected shared code and all affected callers, complete public/test diff, exact source/mirror hashes, the actual focused logs and twelve desktop/narrow List/Columns/Read captures. Exact-key/default/Board/status paths, configured order/restoration, empty/omitted fields, Read/Edit/Raw and independent border colors are covered in both layouts/modes. Protected additions are coverage-only; existing assertions are unchanged. Public privacy and ignored evidence were checked. High/Moderate and architecture review remain appropriate.

Root's original local governance check correctly blocked before this actual review was recorded; it was not treated as acceptance. This evidence-only update records the completed review and clarifies verification-method mapping without changing code, requirements or tests. Next: final history-aware local gate, reviewed PR publication and required full CI; the manager retains human result acceptance, merge and deployment. The isolated checkout remains needed for CI/review follow-up, with no uncommitted product work or live environment change.

## Publication handoff

PR: https://github.com/rore/minimap/pull/81. Its returned URL is appended to Relationships and read back against the exact canonical tuple. Final prepublication history-aware governance at a4c356140718397774aba73305827a6ce1f50f94 is advisory only, with no blocking failures; remaining advisories are the architecture checkpoint and initial record-order heuristic. Boundary/API checks pass and counted size is within policy. This final relationship/evidence edit does not alter the reviewed application or tests; required CI must pass on the resulting final head. The manager owns human acceptance, merge and deployment. No further source edits are planned unless CI/review finds a real failure.

Triggers 2/3 dropped: viewport-capture quality, test confirmation handling and delegated checkout access were fixture/runtime issues, not defects in Agent Workflow. No upstream workflow report is warranted.
