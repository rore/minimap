<!-- agent-workflow:start -->
**Outcome:** Restore the existing green Done badge when every represented saved status is normalized done, without implying completion for mixed or unknown versions.

**Target:** Shared recorded-status summary and its board/detail rendering in Minimap.

**Scope:** The smallest shared tone and rendering correction, focused unit/browser expectations, generated runtime mirrors, and the owning roadmap contribution note.

**Constraints:** Preserve status labels, per-version placement/filter scope, active/blocked precedence, uncertainty and source provenance. Only normalized done qualifies; do not add complete/shipped aliases or infer completion from sessions. Reuse existing status-done CSS. No new helpers, dependencies, backend/provider/request changes, unrelated UI changes or live environment edits. Work only in the isolated done-status-color checkout.

**Completion criteria:** This worktree and Across show green Done in List, Columns and selected detail when every represented saved status is done. Mixed done/queued, done/unknown and unrecognized completion words remain neutral unless existing active/blocked precedence applies. Existing semantic metadata, source/filter and unknown distinctions remain verified. Focused tests, mirror/lint checks, actual captures, independent review and workflow evidence pass before delivery to parent.

**Requirement baseline:**
{"source":"work-record-initial","outcome":"Restore the existing green Done badge when every represented saved status is normalized done, without implying completion for mixed or unknown versions.","scope":"The smallest shared tone and rendering correction, focused unit/browser expectations, generated runtime mirrors, and the owning roadmap contribution note.","constraints":"Preserve status labels, per-version placement/filter scope, active/blocked precedence, uncertainty and source provenance. Only normalized done qualifies; do not add complete/shipped aliases or infer completion from sessions. Reuse existing status-done CSS. No new helpers, dependencies, backend/provider/request changes, unrelated UI changes or live environment edits. Work only in the isolated done-status-color checkout.","completion_criteria":"This worktree and Across show green Done in List, Columns and selected detail when every represented saved status is done. Mixed done/queued, done/unknown and unrecognized completion words remain neutral unless existing active/blocked precedence applies. Existing semantic metadata, source/filter and unknown distinctions remain verified. Focused tests, mirror/lint checks, actual captures, independent review and workflow evidence pass before delivery to parent."}

**Relationships:**
{"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:polish-worktree-view-usability"}],"pull_requests":[]}

**Risk:** High

**Complexity:** Simple

**Reason:** Protected Playwright acceptance currently explicitly requires neutral Done and must change under the authorized bug fix. Production UI and unit files are gray; generated runtime mirrors are watch paths. No dependencies or boundary changes.

**Discovery:** Base 96e7fc2 contains recordedStatusSummary in ui/worktrees.js, returning only blocked/progress/empty tones. buildRecordedStatusMarkup in ui/app.js maps those tones to existing badge classes and is shared by dense/normal List, Columns and detail/source changes. getBoardCardStatus also consumes the summary tone; current card accent CSS covers active/blocked, while the existing green badge palette is badge-tone-status-done. getBadgeTone recognizes only exact normalized done, not complete/shipped. Unit done+done and roadmap semantic-tone browser expectations explicitly require neutral. The canonical owning item was read and its exact tuple resolved through the existing CLI. PR65 is verified merged at 96e7fc2; its contribution note still says awaiting CI/merge and needs scoped reconciliation. The separate known narrow-spec layout failure remains unchanged.

**Material assumptions:** Green communicates unanimous represented saved done, not current execution or provider lifecycle. matchingVersions remains authoritative for Across placement/filter scope; empty/unknown sets cannot qualify. If callers require a wider state interpretation or a new palette, stop and return to planning instead of adding aliases or CSS.

**Plan:** First invoke agent-workflow, classify and commit this Work Record before product/test edits. Stop for parent-arranged independent plan review. After approval, add unanimous done tone to the existing shared summary and map it to the existing green class in the shared markup renderer; do not change labels or filtering. Update the explicit neutral expectations and extend the current status matrix with done/unknown/queued/unrecognized cases. Add or reuse a focused mocked snapshot scenario for This/Across List/Columns/detail, including mixed/unknown states and source-specific filtering. Sync mirrors, run focused units/browser/lint checks, inspect actual captures, update this record and the owning roadmap note, obtain independent result review, commit and hand parent delivery. No live update.

**Verification plan:** test: Existing unit matrix preserves active/in-progress normalization and blocked precedence while covering normalized done unanimity, empty, unknown, mixed and unrecognized completion words. test: Protected semantic-tone case retains priority/commitment assertions and now expects the existing green class. test: Focused snapshot cases exercise This/Across List/Columns/detail and filtered represented versions, with no source/label/request behavior changes. test: Diff-derived assertion scan finds every intentional neutral Done expectation; HTML escaping, promise and mirror checks pass. manual: Desktop/narrow card/detail captures show green Done and neutral mixed/unknown badges. test: Final workflow/Redline evidence and parent CI/merge; no installed server changes.

**Plan review:** Pending parent-arranged independent technical review; stop before product or test edits.

**Approvals:** Approved by user 2026-10-19: "so let's fix". Parent scopes this authorization to the Done badge color regression, preserving exact done semantics and existing safety/request behavior. No live update is authorized.

**Behavior changes:** [{"target":"repository-contract","path":"playwright/roadmap-ui.spec.js","classification":"requirement-change","before":"The semantic badge-tone case explicitly expects neutral Done on the card and selected detail while checking commitment/priority metadata.","after":"The same case expects the existing green status-done class for Done, preserving all metadata and visibility assertions.","reason":"The user authorized fixing the Done color regression; neutral Done is the reported defect.","impact":"Presentation only; no status, filtering, data or request semantics change.","alternatives":"Leaving the neutral expectations would preserve the bug; broad alias or palette changes are unnecessary.","authority":{"scope":"task","name":"task-owner"},"approval":{"by":"user","reference":"2026-10-19 current Done color task authorization, forwarded by parent","verbatim":"so let's fix"}},{"target":"repository-contract","path":"playwright/snapshot-refresh.spec.js","classification":"coverage-only","before":"Snapshot scenarios cover represented active/blocked, conflicts and retained scope without a dedicated green Done rendering check.","after":"Focused scenarios verify unanimous normalized Done uses the existing green class across This/Across List/Columns/detail, while mixed/unknown scope remains neutral and active/blocked precedence is retained.","reason":"Add regression evidence for the authorized shared-tone fix without weakening existing acceptance."}]

**Exceptions:** —

**State:** Ready to implement
<!-- agent-workflow:end -->

## Implementation

Planning only. Isolated checkout `C:/Dev/rore/minimap/.local/done-status-color`, branch `feat/done-status-color`, base `96e7fc2`. No product or test edits. Owning roadmap item: `roadmap/features/polish-worktree-view-usability.md`; exact CLI-returned reference appears in Relationships. Parent owns independent review, PR/CI/merge and any later environment approval. Next action is independent plan review of this record; implementation is paused until parent forwards approval.

## Pre-edit checkpoint

Protected acceptance paths are red/High and require architecture-review visibility at PR time. The user has authorized replacing the intentional neutral Done expectation with the existing green palette. All other status/metadata/source/write assertions remain binding. API, persistence, security, dependencies and runtime lifecycle are outside scope. Generated mirrors are derived through the existing sync script only.
