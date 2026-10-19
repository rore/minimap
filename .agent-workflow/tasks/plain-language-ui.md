<!-- agent-workflow:start -->
**Outcome:** Use plain, familiar UI language and concise defaults without obscuring saved status, conflicts, uncertainty, source identity or actions that can change data.

**Target:** Minimap board, feature detail, source picker, linked sessions, linked tasks and spec review UI.

**Scope:** UI copy, existing disclosures and small layout adjustments; every wording consumer and affected acceptance test; relevant guidance and canonical roadmap note; generated runtime mirrors.

**Constraints:** Preserve status derivation, per-version filtering, source and revision guards, provider lifecycle, In play membership, request behavior and all data writes. Unknown is not empty or zero. Retain conflicts, selected-file metadata, source paths and saved-record provenance. Keep discard/apply/revert/recovery confirmations and actionable errors. No backend changes, live environment edits, new services or dependencies. Work only in the isolated plain-language-ui branch.

**Completion criteria:** Default statuses use familiar labels such as Active, Queued, Blocked and Done, with both active and blocked and visible conflicting-version cues preserved. Board, source and detail wording clearly distinguishes loading, incomplete selection, unavailable sources and earlier results without repetitive qualifiers. Linked sessions and tasks stay concise while exact references, timestamps, saved-record caveats and recovery details remain accessible. Spec language describes comment or suggestion locations accurately for sections as well as quoted text. All wording consumers are updated without weakening safety assertions, and complete affected browser files plus desktop/narrow List/Columns and spec visuals pass review.

**Requirement baseline:**
{"source":"work-record-initial","outcome":"Use plain, familiar UI language and concise defaults without obscuring saved status, conflicts, uncertainty, source identity or actions that can change data.","scope":"UI copy, existing disclosures and small layout adjustments; every wording consumer and affected acceptance test; relevant guidance and canonical roadmap note; generated runtime mirrors.","constraints":"Preserve status derivation, per-version filtering, source and revision guards, provider lifecycle, In play membership, request behavior and all data writes. Unknown is not empty or zero. Retain conflicts, selected-file metadata, source paths and saved-record provenance. Keep discard/apply/revert/recovery confirmations and actionable errors. No backend changes, live environment edits, new services or dependencies. Work only in the isolated plain-language-ui branch.","completion_criteria":"Default statuses use familiar labels such as Active, Queued, Blocked and Done, with both active and blocked and visible conflicting-version cues preserved. Board, source and detail wording clearly distinguishes loading, incomplete selection, unavailable sources and earlier results without repetitive qualifiers. Linked sessions and tasks stay concise while exact references, timestamps, saved-record caveats and recovery details remain accessible. Spec language describes comment or suggestion locations accurately for sections as well as quoted text. All wording consumers are updated without weakening safety assertions, and complete affected browser files plus desktop/narrow List/Columns and spec visuals pass review."}

**Relationships:**
{"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:polish-worktree-view-usability"}],"pull_requests":[]}

**Risk:** High

**Complexity:** Moderate

**Reason:** Protected Playwright acceptance contracts and agent-facing guidance may change. Shared UI copy reaches board, source/detail and spec flows; all existing safety and unknown/partial distinctions must survive the wording pass.

**Discovery:** Base a2de8ac contains the merged compact summary: shared recordedStatusSummary emits Marked labels; board source status repeats loading/partial/last-known qualifiers and details include healthy session and placement prose. Source UI mixes checkout and worktree. Linked sessions already have nested details but technical/reference copy is long; tasks repeat saved-record explanations and action prefixes. Spec location warnings must cover section targets, not just selected text. The previous task demonstrated that copy consumers include unit tests, whole badge/header comparisons and later serial browser cases, not only literal label assertions.

**Material assumptions:** This is a presentation pass, not a new state model. A worktree limit is an omitted selection, not a load failure. Earlier results do not prove a failed refresh. Partial session lookup does not prove a missing link. Saved task/PR data is not live GitHub state; retain that fact on demand. Provider recent/dormant/closed values are not execution evidence. Comment locations can be sections, quoted text or whole-file targets. Review exact copy and conditions before product edits.

**Plan:** First invoke agent-workflow, create and commit this Work Record and classify risk before code. Await parent-reviewed exact copy shortlist and independent plan review. Then update shared UI text and existing disclosures with the smallest changes, retaining state predicates and all exact-source/write guards. Inventory every consumer of each changed label and markup comparison before editing tests; record exact protected paths and classification first. Reconcile only this contribution in the owning roadmap note, check guidance drift, sync mirrors, run unit/lint/mirror checks and complete affected browser test files. Inspect desktop/narrow List/Columns, source/detail/session/task and spec views, obtain independent result review, and hand delivery to parent. No PR before review and no live update.

**Verification plan:** test: Shared status label matrix still covers aliases, mixed/conflicting states, unknown and per-version scope. test: Loading versus partial selection versus unavailable worktrees versus earlier results; unknown/zero/partial/stale linked counts and exact source paths remain distinct. test: Entire affected Playwright files, including metadata/header comparisons, request counts, editing guards, source selection, task pagination, session references and spec recovery/apply/revert behavior. test: UI escaping/promise lint, relevant units and mirror identity. manual: Actual desktop/narrow List/Columns plus relevant detail/source/task/session/spec captures, with no clipping or contradictory primary cues. test: Workflow/Redline final evidence and full CI gate, without substituting changed labels for safety checks.

**Plan review:** Pending independent review of the exact copy shortlist and this committed baseline; no product edits yet.

**Approvals:** User 2026-10-19: "i want a pass to see if we're doing things like this in other places. instead of being simple we're complicating the user, create obscure language and long descriptions that no one will read. this is not a good ui behavior. i want to remove those things". Parent authorizes UI text/disclosure/layout changes and necessary text expectations within the constraints above; implementation and tests only, no live environment changes.

**Exceptions:** —

**State:** Ready to implement
<!-- agent-workflow:end -->

## Implementation

Planning only. Isolated checkout `C:/Dev/rore/minimap/.local/plain-language-ui`, branch `feat/plain-language-ui`, base `a2de8ac`. No product or test edits. Canonical owning item `roadmap/features/polish-worktree-view-usability.md` was read; the exact tuple above was resolved with the existing CLI. Parent owns the broader audit/design, independent review, CI and merge. Await reviewed copy shortlist before implementation.

## Proposed exact copy for review

| Surface / condition | Existing wording | Proposed wording / disclosure |
| --- | --- | --- |
| Primary saved statuses | Marked active / queued / blocked / done | Active / Queued / Blocked / Done. Preserve aliases and mixed Active · Blocked. |
| Mixed versions | Statuses differ | Keep Statuses differ visibly on the existing versions entry. |
| Unknown status | Status unavailable | Keep Status unavailable; do not invent Queued. |
| Worktree terminology | This checkout, Checkout path, N checkouts | This worktree, Worktree path, N worktrees. Runtime keys and branch semantics stay unchanged. |
| Full board scan running | Loading other worktrees… / Updating… plus repeated qualifiers | Loading worktrees…; keep Current worktree only accessible for a provisional view. |
| General partial selection | Partial coverage / Partial discovery | Some worktrees not shown. Exact omitted/unreadable reasons and counts remain in details. |
| Proven load failure | Worktree discovery unavailable / unavailable source | Couldn’t load worktrees; retain existing last usable choices and specific reasons in details. |
| Stale or retained view | Last-known view / last-known results | Showing earlier results. Do not claim a failed refresh unless one occurred. |
| Selected detail scope | Opened checkout only | Current worktree only, adjacent to summary while coverage is incomplete. |
| Source selection limit | Long 25-checkout selection explanation | Limited to this worktree and up to 24 recent worktrees. Exact selected/excluded counts and reasons remain available. |
| Healthy board/session detail | Placement/group metrics and healthy session-availability paragraphs | Remove these redundant paragraphs; retain meaningful coverage, exclusions, unknown, limit and recovery information. |
| Partial session observation | Partial session coverage | Some session links couldn’t be checked. No claim that an unobserved link is absent. |
| Session technical disclosure | Reference and guidance | Technical details. Exact scope/item IDs and guidance remain inside. |
| Session association | Association updated | Feature link updated. Keep timestamp and origin. |
| Session classification | Lifecycle | Session status inside Session details; retain recent/dormant/closed values, not a live-activity claim. Reviewer may prefer omitting redundant healthy destination/state labels. |
| Selected literal status | Selected version status | This version’s status, still separate from the combined primary summary. |
| Task header/actions | Tasks linked to this feature / Open task record | Linked tasks (N) / Open task. Retain pagination total, unknown count behavior and task contents. |
| Task state label | Task record state: X | X, with saved-record meaning available in short Task details guidance. |
| Task boilerplate | Development task records… Task states and PR links reflect saved records. | Remove permanent paragraph. On-demand caveat: Saved task records; PR status may have changed. Preserve selected-worktree provenance. |
| Incomplete task list | Multiple long legacy/unreadable explanations | Some linked tasks may be missing. Keep legacy versus unreadable reasons in details and retry action. |
| Spec orphan target | Anchor orphan | Comment location not found / Suggestion location not found, according to the object. |
| Spec ambiguous target | Anchor ambiguous | More than one matching location. |
| Spec missing location / updated target | Anchor unavailable / re-anchored after edit | Location unavailable / Location updated after edit. Preserve recovery controls. |
| Whole-file comment | Global comment | Whole file comment. |
| Display-only margin terminology | gutter | margin, only where it names the actual UI margin. Do not rename selectors or low-level identifiers. |
| Spec authorship | Actor | Author, only user-facing labels; preserve actor identity and underlying field. |
| Whole-file location mode | Global | Whole file, only when the existing global mode means the whole file; retain enum global. |
| Location selectors | Comment anchor mode / Suggestion anchor mode | Comment location / Suggestion location. |
| Suggestion explanation | Rationale | Reason. |
| Location hints | Anchored to section / Anchored to selected text | Section / Selected text; preserve the exact underlying target and recovery controls. |

Exact condition precedence and on-demand placement require reviewer confirmation. In play membership and its underlying status/session predicate remain unchanged; do not replace it with a falsely narrower Active filter. Keep existing plain controls and all destructive-action confirmations. This is a bounded shortlist, not permission to rewrite unrelated help or backend errors.
