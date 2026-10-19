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

**Plan review:** Agent technical review: `/root/done_color_review` APPROVED this bounded plan on 2026-10-19, forwarded by parent. Use only nonempty unanimous normalized done; preserve active/blocked precedence, labels and represented version scope. Parent authorizes implementation. No additional plan gate.

**Approvals:** Approved by user 2026-10-19: "so let's fix". Parent scopes this authorization to the Done badge color regression, preserving exact done semantics and existing safety/request behavior. No live update is authorized.

**Behavior changes:** [{"target":"repository-contract","path":"playwright/roadmap-ui.spec.js","classification":"requirement-change","before":"The semantic badge-tone case explicitly expects neutral Done on the card and selected detail while checking commitment/priority metadata.","after":"The same case expects the existing green status-done class for Done, preserving all metadata and visibility assertions.","reason":"The user authorized fixing the Done color regression; neutral Done is the reported defect.","impact":"Presentation only; no status, filtering, data or request semantics change.","alternatives":"Leaving the neutral expectations would preserve the bug; broad alias or palette changes are unnecessary.","authority":{"scope":"task","name":"task-owner"},"approval":{"by":"user","reference":"2026-10-19 current Done color task authorization, forwarded by parent","verbatim":"so let's fix"}},{"target":"repository-contract","path":"playwright/snapshot-refresh.spec.js","classification":"coverage-only","before":"Snapshot scenarios cover represented active/blocked, conflicts and retained scope without a dedicated green Done rendering check.","after":"Focused scenarios verify unanimous normalized Done uses the existing green class across This/Across List/Columns/detail, while mixed/unknown scope remains neutral and active/blocked precedence is retained.","reason":"Add regression evidence for the authorized shared-tone fix without weakening existing acceptance."}]

**Exceptions:** —

**State:** Ready for review
<!-- agent-workflow:end -->

## Implementation

Isolated checkout `C:/Dev/rore/minimap/.local/done-status-color`, branch `feat/done-status-color`, base `96e7fc2`. The initial planning record was committed as `dfcc19a` before product/test edits. Owning roadmap item: `roadmap/features/polish-worktree-view-usability.md`; exact CLI-returned reference appears in Relationships. Parent owns independent review, PR/CI/merge and any later environment approval.

Plan approved; beginning the two shared production changes and focused verification. The other tone consumer adds a board-card-status-done class with no matching CSS, so the existing card accent behavior stays unchanged; only the existing status-done badge palette is reused.

Implemented the two shared expressions: only one distinct normalized status equal to done yields the done tone; shared markup maps that tone to the existing green badge class. Labels, metadata, filters, source selection and active/blocked precedence are unchanged. Unit coverage includes case/whitespace normalization, done/unknown, done/queued, done/complete, done/shipped, repeated unrecognized complete, and empty/unknown sets. Existing semantic browser metadata assertions remain intact. Four new rendered scenarios cover This/Across × List/Columns, desktop/narrow card/detail, computed green, mixed/unknown neutral and done-only version filtering. No CSS, new helpers, dependencies, backend or request logic changed. Mirrors were regenerated with the existing sync script.

The owning roadmap note now records PR65 merged at 96e7fc2 and this separate contribution awaiting review/delivery. The known narrow-spec layout limitation is preserved. UI-only color semantics do not reach a documented skill API; the old-keyword sweep found no Done-neutral documentation requiring changes.

## Verification evidence

- `node --test test/ui-worktrees.test.js test/ui-lint-html-escape.test.js test/ui-lint-promises.test.js test/sync-mirrors.test.js`: 18 passed, 0 failed, 0 skipped.
- Browser command targeting the new Done scenarios, existing represented-activity scenarios, finished-representative linked-count scenario and semantic metadata scenario: initial 8-case run had 7 passed and 1 test-only interaction failure. Across Columns attempted toolbar Refresh through the normal open item overlay; its backdrop correctly intercepted the click. No product assertion failed before that interaction.
- Corrected the new test to close the overlay with Escape before Refresh and reopen Alpha for each detail check. Reran only the two affected Across cases: 2 passed, 0 failed. All 8 distinct focused browser cases therefore have passing evidence. Initial and corrected logs remain uncommitted under `tmp/done-status-evidence/browser.log` and `across-rerun.log`; no failed run is represented as a single clean 8-case invocation.
- Computed badge colors are `rgb(21, 121, 90)` for unanimous Done and `rgb(108, 115, 133)` for mixed saved statuses. Done-only source filtering restores green; adding an unknown represented version stays neutral. Existing Active/Blocked and selected metadata checks passed.
- Case-insensitive Done/neutral assertion and caller sweep found only the intentional expectations migrated here; labels and remaining neutral conflict assertions stay unchanged. `git diff --check` passed; mirrors match canonical sources.

Actual desktop/narrow This/Across List/Columns cards and detail captures are retained uncommitted under `tmp/done-status-evidence/screenshots/`. The implementing agent inspected green Done and neutral mixed captures. Parent independently inspected Across Columns narrow detail, This List desktop and Across List mixed-neutral and accepted readability/layout. Source hashes for result review: app.js `6C38806C32429C4C1A003DE5487DBA68EF1769F04EC49B862CBE6DD99945FEE1`; worktrees.js `533570FA6832C6142B4E0F8126E6E88CE6E7F75437CEE43584362DD161E238C5`.

## Result review

Agent technical review: `/root/done_color_review` APPROVED the final technical/architecture result on 2026-10-19, forwarded by parent, with no blockers. Reviewer independently inspected the green narrow detail and mixed gray capture. Parent also accepted the bounded visual evidence. No source changes followed the reviewed production expressions.

Reviewed revision: final implementation diff from `dfcc19a`; app.js SHA256 `6C38806C32429C4C1A003DE5487DBA68EF1769F04EC49B862CBE6DD99945FEE1`, worktrees.js SHA256 `533570FA6832C6142B4E0F8126E6E88CE6E7F75437CEE43584362DD161E238C5`, with identical generated mirrors.

Verification adequacy: 18 unit/lint/mirror checks passed; all 8 distinct focused browser scenarios have passing evidence across the initial 7-pass/1-test-interaction-failure run and corrected 2-pass Across run. Existing semantic metadata, active/blocked precedence, linked count and source-filter assertions remain intact. Actual desktop/narrow List/Columns/detail captures verify the existing green palette and neutral mixed state. Scope, labels, aliases, requests and data semantics remain unchanged. Parent owns PR/CI/merge and the real architecture-review checkpoint; no live update is authorized or performed.

## Pre-edit checkpoint

Protected acceptance paths are red/High and require architecture-review visibility at PR time. The user has authorized replacing the intentional neutral Done expectation with the existing green palette. All other status/metadata/source/write assertions remain binding. API, persistence, security, dependencies and runtime lifecycle are outside scope. Generated mirrors are derived through the existing sync script only.
