# Readable roadmap card hierarchy

Canonical design: [Make roadmap cards readable at a glance](../../roadmap/features/roadmap-card-hierarchy.md).

<!-- agent-workflow:start -->
**Outcome:** Roadmap cards make titles and summaries readable without losing source, status or session context.
**Target:** Minimap.
**Scope:** Shared List/Columns card markup and styling, isolated realistic visual fixtures and regression coverage, generated runtime mirrors, canonical task documentation.
**Constraints:** Preserve appearance configuration, complete List excerpts, source/status/coverage/conflict semantics, sessions, spec links, keyboard selection and reordering. No backend expansion, real data edits or live environment changes. At most one bounded independent reviewer; root implements and tests.
**Completion criteria:** Baseline and iterative desktop/narrow renders are inspected; dense/default/configured views and live participant refresh pass focused checks; required CI, independent review and PR evidence are recorded.
**Requirement baseline:**
{"source":"User-approved manager assignment, accepted 2026-10-29","outcome":"Roadmap cards make titles and summaries readable without losing source, status or session context.","scope":"Shared List/Columns card markup and styling, isolated realistic visual fixtures and regression coverage, generated runtime mirrors, canonical task documentation.","constraints":"Preserve appearance configuration, complete List excerpts, source/status/coverage/conflict semantics, sessions, spec links, keyboard selection and reordering. No backend expansion, real data edits or live environment changes. At most one bounded independent reviewer; root implements and tests.","completion_criteria":"Baseline and iterative desktop/narrow renders are inspected; dense/default/configured views and live participant refresh pass focused checks; required CI, independent review and PR evidence are recorded."}
**Relationships:**
{"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:roadmap-card-hierarchy"}],"pull_requests":[]}
**Risk:** Elevated
**Complexity:** Moderate
**Reason:** Shared card DOM and dense/responsive CSS affect both layouts and asynchronous participant refresh. New browser acceptance coverage is a protected surface requiring architecture review; no public configuration or data contract changes.
**Discovery:** Current shared body mixes internal ID, configured metadata, source/conflict/session/spec cues; dense cards duplicate cues into a second signals row. Participant refresh writes both rows. Columns action grid narrows all content, not only title. List is a button and preserves complete summary excerpts. Actual read-only representative project example recovered from a read-only representative example.
**Material assumptions:** Existing card activation opens complete version details, so a noninteractive Differences indicator can replace redundant source-status/conflict messages without a new control; verify against current details and keyboard behavior before implementation. If context cannot be retained with existing UI, return to design rather than expanding the backend.
**Plan:** Invoke Agent Workflow and classify risk before product edits (done). Inspect shared rendering/callers and existing tests. Build isolated realistic fixture and capture baseline. Record concrete hierarchy and obtain one clean-context technical plan review. Implement the smallest shared markup/CSS change with a single live footer target, preserving empty-row suppression and appearance behavior. Iterate inspected screenshots and add focused regression checks, sync mirrors, review final committed result and publish PR for manager acceptance.
**Verification plan:** Exact representative project title/summary plus dense/long/narrow fixtures in List/Columns and default/configured appearance; compare baseline and iterations. Assert IDs remain searchable/in details, missing recovery IDs remain visible, full List summary remains, status/version details and participant refresh/count/scroll are correct, no nested List controls or empty rows, and metadata/colors/selection/drag remain. Run focused existing board/worktree/appearance tests, pure UI/lint checks and mirror parity; required complete CI remains a merge gate.
**Plan review:** Pending independent reviewer before product edits.
**Behavior changes:** [{"target":"repository-contract","path":"playwright/card-hierarchy-ui.spec.js","classification":"coverage-only","before":"No dedicated realistic card hierarchy visual and live-footer regression exists.","after":"Add isolated default/configured dense desktop/narrow card coverage without weakening existing assertions or deadlines.","reason":"Protect readability and existing interactions during shared DOM/CSS consolidation."}]
**Approvals:** Manager forwarded explicit user authorization to run the accepted design/implementation/visual iteration scope on 2026-10-29; no repeat lead approval needed. Environment changes remain excluded.
**Exceptions:** —
**State:** Planning
<!-- agent-workflow:end -->

## Proposed rendering design

- Shared body: title and existing actions in a header; summary at full card width; kind plus ordered metadata; subdued source/spec/session footer. Move Columns actions into the header rather than reserving their column beside all content. List remains one button with its noninteractive draggable span; Columns keeps its Open button and grip.
- Remove only ordinary card ID markup. Keep data IDs, search, detail fields, edit-mode IDs and missing recovery cards.
- One metadata row, never duplicate dense signals. Dense default Columns retains status/priority and kind; explicit cardFields retains every configured field in order. Keep existing summary clamping rules, including narrow List's existing three-line rule; full-width List retains its complete excerpt. Empty metadata row emits nothing. Kind is a structural label, not a newly configurable field.
- One footer target per card, initially hidden if empty so future participant refresh can populate it. Source count/branch remains; replace duplicated source-status and version messages with one Differences indicator. Its accessible label and title describe status and other conflicting fields; existing card activation opens full version details. Hidden status metadata still has this cue. Coverage notices remain at board/detail level unchanged.
- Participant refresh updates only the footer participant span, preserving other footer nodes, card identity, selection, scroll and focus; CSS hides empty footer and uses subdued inline context instead of another colorful badge tier. Preserve spec counts/unavailable title/aria-label.

## Implementation targets

package/minimap/ui/app.js; package/minimap/ui/styles.css; playwright/card-hierarchy-ui.spec.js (new fixture and visual regression); existing playwright/roadmap-ui.spec.js, appearance-ui.spec.js, snapshot-refresh.spec.js, worktree-ui.spec.js only where old duplicate-row/text/ID selectors encode the replaced presentation. Existing semantic/source/count assertions and deadlines remain. Generated runtime mirrors via sync script. No backend/config/public skill contract change; roadmap and Work Record describe this UI-only change. Evidence stays under artifacts/card-hierarchy, not shipped.

Branch feat/roadmap-card-hierarchy starts from public base 07a64fb7ad4f011fe72f3b5c379be3ba2bb82db4. Implementation uses an isolated checkout; private coordination and review provenance remain in ignored local records.
