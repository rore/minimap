<!-- agent-workflow:start -->
**Outcome:** Combined cards disclose different active or blocked represented versions, board headers remain readable while coverage loads, participant freshness names session activity, and merged delivery notes are accurate.

**Target:** Minimap combined roadmap board and participant detail.

**Scope:** Shared card signals, board-header CSS, shared participant labels/hint and recency reference, focused browser regressions plus mechanical label expectations, owning roadmap notes and generated runtime mirrors.

**Constraints:** Preserve selected-version document/status and per-version filtering; no newest-wins selection, fabricated merged status, provider lifecycle changes, association deletion, backend scans or per-card reads. Do not update live installations, primary checkout or shared service. Keep partial/stale observations truthful.

**Completion criteria:** A queued representative with active and blocked matching siblings shows both explicit other-version signals while its selected document remains queued. Long provisional/updating coverage fits the header without clipping/overlapping controls in desktop/narrow List/Columns and settles on success/error. Seen <24h labels explicitly mean session last-seen at the provider observation, and refreshed recent/dormant counts follow provider data. PR60/61 notes distinguish merged repository work from pending live rollout.

**Requirement baseline:** 
{"source": "work-record-initial", "outcome": "Combined cards disclose different active or blocked represented versions, board headers remain readable while coverage loads, participant freshness names session activity, and merged delivery notes are accurate.", "scope": "Shared card signals, board-header CSS, shared participant labels/hint and recency reference, focused browser regressions plus mechanical label expectations, owning roadmap notes and generated runtime mirrors.", "constraints": "Preserve selected-version document/status and per-version filtering; no newest-wins selection, fabricated merged status, provider lifecycle changes, association deletion, backend scans or per-card reads. Do not update live installations, primary checkout or shared service. Keep partial/stale observations truthful.", "completion_criteria": "A queued representative with active and blocked matching siblings shows both explicit other-version signals while its selected document remains queued. Long provisional/updating coverage fits the header without clipping/overlapping controls in desktop/narrow List/Columns and settles on success/error. Seen <24h labels explicitly mean session last-seen at the provider observation, and refreshed recent/dormant counts follow provider data. PR60/61 notes distinguish merged repository work from pending live rollout."}

**Relationships:** 
{"schema_version": 1, "sources": [{"provider": "minimap", "scope_ref": "roadmap:v1:git:github.com/rore/minimap#roadmap", "local_ref": "item:v1:polish-worktree-view-usability"}, {"provider": "minimap", "scope_ref": "roadmap:v1:git:github.com/rore/minimap#roadmap", "local_ref": "item:v1:distinguish-recent-dormant-participants"}, {"provider": "minimap", "scope_ref": "roadmap:v1:git:github.com/rore/minimap#roadmap", "local_ref": "item:v1:show-feature-related-work"}], "pull_requests": []}

**Risk:** High

**Complexity:** Moderate

**Reason:** Protected Playwright acceptance paths and agent-facing recency reference; the implementation remains bounded to shared UI rendering and layout.

**Discovery:** Combined cards project opened-first summary status; matchingVersions already retains exact represented versions and conflicts. getBoardCardStatus reads only representative metadata and Status differs gives no direct activity signal. CSS shares fixed 44px panel-header height with wrapping board coverage, allowing tall provisional text to overlap following controls. Existing Across full scan has a 60s abort deadline and clears loading on success/error; no stuck-live-read bug is established. Root verified Pallium uses an inclusive 24h session last-seen window; screenshot session age 22h22 at observation is correctly recent. Roadmap notes for merged PR60 and61 still say pending merge/delivery.

**Material assumptions:** Only matchingVersions on the current card contribute other-version signals; filters must not expose unrelated hidden placements. Provider lifecycle and asOf remain authoritative; labels describe last observation rather than a client clock reclassification. Held/failing fixture tests will distinguish slow provisional loading from an actual stuck state; change lifecycle code only with a reproduced defect.

**Plan:** First retain current card representative and add deduplicated active/in-progress/blocked sibling status badges from matchingVersions, excluding identical representative status; concise another-version wording, source details in accessible title. Scope auto-height/min-height44 and shrink-safe wrapping to board header. Rename shared Recent badge to Seen <24h with explicit session-lastseen accessible text and matching detail hint; keep provider lifecycle untouched. Add combined-card/filter and held/failing header/refresh lifecycle cases, update only affected existing label assertions, capture desktop/narrow List/Columns, reconcile merged notes and sync mirrors. No new services or backend changes.

**Verification plan:** test: Represented sibling activity and preserved selected status/filter boundaries -> focused browser cases. test: Held provisional and failure settlement/header bounds -> List/Columns desktop/narrow browser cases, plus existing hidden/error/recovery regressions. test: Provider recent-to-dormant transition and stale retention -> refreshed observation fixture and shared-label acceptance cases. manual: Inspect actual desktop/narrow screenshots. test: UI filters/worktrees/lint/mirror checks and affected browser suites; workflow/redline checks. manual: Reconcile PR60/61 merged notes without claiming live rollout.

**Plan review:** Pending independent technical plan review before product edits.

**Approvals:** Approved by user 2026-10-19: "please take care of all these issues" (source request 582822ff-27a6-424f-9a1f-0692efc1d005). Parent approved the bounded scope and retained provider/source semantics.

**Exceptions:** —

**State:** Ready to implement
<!-- agent-workflow:end -->

## Implementation

Isolated checkout `.local/board-activity-clarity`, branch `feat/board-activity-clarity`, starts at merged `79370e8`. Local origin/main initially lagged, so fetched and fast-forwarded only this new checkout before planning. Product edits await plan review. Intended files: canonical `ui/app.js`, `ui/styles.css`, `ui/index.html`, generated mirrors, recency reference, seven Playwright label-assertion paths (`async-worktree-ui`, `board-participant-e2e`, `board-presence-performance`, `in-play`, `roadmap-ui`, `snapshot-refresh`, `worktree-ui`), and owning roadmap notes `polish-worktree-view-usability`, `distinguish-recent-dormant-participants`, `show-feature-related-work` and the directly stale PR61 search note.
