<!-- agent-workflow:start -->
**Outcome:** Across worktrees automatically recovers from transient snapshot consistency failures while retaining the visible complete board.
**Target:** Minimap Across worktrees UI; roadmap/features/load-worktree-board-progressively.md
**Scope:** Across full-snapshot UI recovery in package/minimap/ui/app.js, focused Playwright coverage, README, generated runtime mirrors and this Work Record.
**Constraints:** Keep the identity consistency guard; never modify live services, installed tools or global settings. Preserve unsaved edits/navigation; do not claim the unproven return-to-tab badge disappearance is fixed.
**Completion criteria:** Retry source-changed-during-read at most twice automatically; no transient error banner; show Updating while retrying; retain complete cards/counts; persistent failures show stale state and Refresh guidance; non-race errors do not retry; stale loads cannot replace newer navigation; initial provisional view remains incomplete.
**Requirement baseline:** {"source":"work-record-initial","outcome":"Across worktrees automatically recovers from transient snapshot consistency failures while retaining the visible complete board.","scope":"Across full-snapshot UI recovery in package/minimap/ui/app.js, focused Playwright coverage, README, generated runtime mirrors and this Work Record.","constraints":"Keep the identity consistency guard; never modify live services, installed tools or global settings. Preserve unsaved edits/navigation; do not claim the unproven return-to-tab badge disappearance is fixed.","completion_criteria":"Retry source-changed-during-read at most twice automatically; no transient error banner; show Updating while retrying; retain complete cards/counts; persistent failures show stale state and Refresh guidance; non-race errors do not retry; stale loads cannot replace newer navigation; initial provisional view remains incomplete."}
**Risk:** Elevated
**Complexity:** Moderate
**Reason:** app.js is gray and Playwright acceptance tests are red (architecture-review); no identity, persistence, API or governance contract changes. Bounded asynchronous recovery requires navigation and edit-state coverage.
**Discovery:** loadWorkspace retains same-scope snapshots already. Full API returns HTTP200 with workspace:null and unavailable.reason=source-changed-during-read; present currently discards the reason and throws. Initial progressive fallback is provisional and must not be advertised as complete. Across visibility preservation already exists.
**Material assumptions:** The retryable reason is a read consistency failure and may also mean identity lookup failed. If other structured failure shapes appear, keep them non-retryable and update tests.
**Plan:** Use existing loadWorkspace generation and stillCurrent guard. Retry only the full aggregate response with the exact structured consistency reason, twice with short bounded delays. Reuse worktreeLoading indicator, showing Updating for retained complete boards and during recovery; keep provisional coverage labels. Throw a reason-bearing error only after exhaustion to render concise accurate stale guidance. Reuse synchronous card/count preservation and existing dirty-item reconciliation. Add focused mocked aggregate route tests in playwright/async-worktree-ui.spec.js, document recovery in README, sync mirrors. No new dependencies, background scheduler, backend guard edits or weakened existing tests. Stop on verification/review findings or scope expansion.
**Verification plan:** When consistency fails then succeeds, no red banner and board/counts persist → deterministic Playwright test. When consistency repeatedly fails, requests stop after3 and Refresh remains usable → deterministic test. Non-race errors receive no retry → deterministic test. Navigation supersedes pending retry and unsaved edits survive retry completion → focused Playwright tests. Initial fallback remains honestly incomplete → deterministic test. Desktop/narrow List/Columns recovery remains usable → four screenshots plus overflow assertions. Existing Across visibility regression, relevant UI units, mirror byte parity and workflow check.
**Plan review:** Pending clean-context agent technical review; see Plan review below.
**Approvals:** Not required at this risk level. User explicitly approved bounded recovery and end-to-end repository delivery/merge; parent owns final acceptance and merge.
**Exceptions:** —
**Behavior changes:** []
**State:** Blocked
<!-- agent-workflow:end -->

## Implementation
2026-10-07: Isolated branch feat/worktree-snapshot-retry created from main d11bd657 before source changes. This Work Record precedes implementation. No live environment changes.
## Plan review
Pending technical review.
## Evidence
Pre-implementation isolated visibility test reproduced initial consistency rejection, not complete-snapshot badge loss. Server-free aggregate regression passed.
## Result review
Pending.
