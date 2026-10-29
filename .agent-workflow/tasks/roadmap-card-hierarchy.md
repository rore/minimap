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
**Risk:** High
**Complexity:** Moderate
**Reason:** Shared card DOM and responsive/async rendering plus user-approved Read tag selection behavior affect the public appearance contract and protected browser/agent documentation surfaces; architecture review is required. Configuration schema and item data remain unchanged.
**Discovery:** Current shared body mixes internal ID, configured metadata, source/conflict/session/spec cues; dense cards duplicate cues into a second signals row. Participant refresh writes both rows. Columns action grid narrows all content, not only title. List is a button and preserves complete summary excerpts. Actual read-only representative project example recovered from a read-only representative example.
**Material assumptions:** Existing card activation opens complete version details, so a noninteractive Differences indicator can replace redundant source-status/conflict messages without a new control; verify against current details and keyboard behavior before implementation. If context cannot be retained with existing UI, return to design rather than expanding the backend.
**Plan:** Invoke Agent Workflow and classify risk before product edits (done). Inspect shared rendering/callers and existing tests. Build isolated realistic fixture and capture baseline. Record concrete hierarchy and obtain one clean-context technical plan review. Implement the smallest shared markup/CSS change with a single live footer target, preserving empty-row suppression and appearance behavior. Iterate inspected screenshots and add focused regression checks, sync mirrors, review final committed result and publish PR for manager acceptance.
**Verification plan:** Exact representative project title/summary plus dense/long/narrow fixtures in List/Columns and default/configured appearance; compare baseline and iterations. Assert IDs remain searchable/in details, missing recovery IDs remain visible, full List summary remains, status/version details and participant refresh/count/scroll are correct, no nested List controls or empty rows, and metadata/colors/selection/drag remain. Run focused existing board/worktree/appearance tests, pure UI/lint checks and mirror parity; required complete CI remains a merge gate.
**Plan review:** Agent technical review: Independent technical reviewer APPROVED planning revision the original plan before product edits. Elevated/Moderate confirmed. Result must include initially empty footer 0→positive→0, retained scroll/focus/card identity, hidden-status differences, configured order/colors and full-width content below header actions.
**Behavior changes:** [{"target":"repository-contract","path":"playwright/card-hierarchy-ui.spec.js","classification":"coverage-only","before":"No dedicated realistic card hierarchy visual and live-footer regression exists.","after":"Add isolated default/configured dense desktop/narrow card coverage without weakening existing assertions or deadlines.","reason":"Protect readability and existing interactions during shared DOM/CSS consolidation."}]
**Approvals:** Manager forwarded explicit user authorization to run the accepted design/implementation/visual iteration scope on 2026-10-29; no repeat lead approval needed. Environment changes remain excluded.
**Exceptions:** —
**State:** Ready to implement
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

## Implementation

2026-10-29: shared body now removes ordinary IDs, moves kind into metadata, uses one metadata row and one source/differences/spec/session footer, and places Columns actions only beside the title. Default dense cards retain status/priority; explicit configured fields remain ordered and visible. Participant refresh updates one footer without recreating card nodes. List remains a button without nested controls. Added a guard so double-clicking relocated Columns actions does not also activate the parent preview handler. Backend, config and details are unchanged. Target paths remain as listed above; no helpers or dependencies were added.

Visual fixture qualification: initial captures under baseline/iteration-1 are superseded, not valid configured evidence. Initial fixture lacked tracked empty ideas directories, then config writer omitted required roadmapPath; both fixture issues were corrected. The unchanged 07a64fb packaged runtime was extracted into an isolated artifacts/card-hierarchy-baseline tree and used for corrected baseline capture with the same current fixtures; no checkout rollback or live runtime swap. Configured captures now assert exactly status/priority/repo plus blue Repo color and settled worktree data before capture. Normal-density and 15-item dense cases both contain the exact representative project title and full source Summary. Source edits began while the unchanged-runtime baseline was being prepared, before its successful final capture; no modified runtime was used for that baseline.

Iteration-3 desktop/narrow renders inspected directly: ordinary ID and duplicate conflict messages no longer compete with content; title uses the header, summary/metadata/footer use full card width; blue Repo configuration survives both views. Added focused-column capture using actual collapse controls; narrow and ordinary dense summary clamping are preserved. Footer type size adjusted to match the existing source context size after rendered inspection. Existing protected tests only migrate presentation selectors/text, retaining semantic/count/source checks and deadlines.

## Evidence

- Focused Node checks: 50/50 pass (appearance, filters, worktree projection, HTML escaping, promise catches). A first HTML fragment lint failure was fixed by using the existing safe fragment convention; no lint rules or allowlist changed.
- Corrected unchanged-runtime visual baseline matrix: 2/2 pass, 16 desktop/narrow List/Columns captures under artifacts/card-hierarchy/baseline-corrected. Exact field-order/color and settled-data assertions gate configured captures.
- Iteration-3: 3/4 passed; empty-footer failure was an observation mock mismatch (This uses itemId, Across featureKey). After correcting the test double to match the real interface, the isolated empty-footer test passed 1/1: 0→2→0 in both layouts, no empty metadata row, same card, focus and scroll retained; missing recovery ID remains visible. Final complete focused run remains pending.

## Result review

Pending final committed revision and independent reviewer verification.

## User-approved scope extension and reviewed-plan addendum

2026-10-29 manager forwarded the user's Read screenshot/request: "if i remove the tag from the card, shouldn't it also be removed here? (in this case, we removed commited)". User explicitly authorized applying cardFields selection to Read tags; manager directed incorporation now without another permission gate. Original baseline remains above; addendum outcome is consistent card/Read tag selection, with primary combined status always visible and complete Edit/Raw metadata unchanged. Scope now also includes README.md, package/minimap/CONTRACT.md, roadmap skill SKILL.md/references/roadmap-contract.md, and matching appearance browser expectations. This supersedes the earlier UI-only/no-public-contract assumption. High/Moderate reassessment is intentional; no data schema/backend change, option or migration.

Addendum plan: extend existing pure badge entry options with an explicit Read selection mode (not cardMode, which affects status and default custom-field caps). Both modes use the normalized same cardFields array; Read excludes status from the selected list, while no configuration uses its unchanged full-metadata default. renderPreview uses that mode for its tag row and keeps primary combined-status/selected-version status UI unchanged. Update exact docs claims about full detail metadata to identify Edit/Raw, not hidden Read tags. Add default/configured/empty, ordered fields, colors, reopen, This/Across/source switch, complete Edit/Raw checks and actual detail screenshots. Existing single reviewer must review this expanded plan before its implementation; current broad card-only regressions may finish independently.

Additional visual consideration from manager: evaluate kind after configured metadata rather than before, giving status/repo first-glance priority. Compare real renders; keep it a structural non-configurable label and do not add a row/control. Capture direct featured-card baseline/final screenshots (no image editing).
