<!-- agent-workflow:start -->
**Outcome:** A ready-for-agent Minimap feature defines automatic related Work Record and PR discovery in feature detail.

**Target:** Minimap.

**Scope:** Add roadmap/features/show-feature-related-work.md and place its ID in roadmap/board.md; no runtime implementation.

**Constraints:** Preserve board order and the existing checkout; source relationships remain Workflow-owned; no installed app or service changes.

**Completion criteria:** The new canonical feature specifies the agreed dependency, bounded refresh and source behavior, UX, E2E and visual acceptance; Next lists its ID once in order.

**Requirement baseline:**
{"source":"work-record-initial","outcome":"A ready-for-agent Minimap feature defines automatic related Work Record and PR discovery in feature detail.","scope":"Add roadmap/features/show-feature-related-work.md and place its ID in roadmap/board.md; no runtime implementation.","constraints":"Preserve board order and the existing checkout; source relationships remain Workflow-owned; no installed app or service changes.","completion_criteria":"The new canonical feature specifies the agreed dependency, bounded refresh and source behavior, UX, E2E and visual acceptance; Next lists its ID once in order."}

**Risk:** Elevated

**Complexity:** Simple

**Reason:** The feature path is outside the documentation-only allowlist and Redline blue zones, so gray classification sets an Elevated floor. The change is one coherent roadmap definition.

**Discovery:** roadmap/board.md has Now empty and two Next items; roadmap files use required frontmatter and standard sections. Minimap CONTRACT.md already defines source-specific worktree identity, refresh and last-good behavior. The collection plan owns combined acceptance; Workflow owns source relationship production and reading.

**Material assumptions:** Workflow's source-reference format is not yet published at the linked path; if its eventual supported contract conflicts with this feature, reconcile this feature before runtime implementation.

**Plan:** Add one feature file using the existing roadmap convention, then append its ID after existing Next bullets. Keep Workflow's syntax normative and reference its plan. Stop at documentation; do not modify runtime or installed state.

**Verification plan:** Feature definition and single Next placement → inspect roadmap diff, required frontmatter/sections, and ID count.
Workflow compliance → run Redline and agent-workflow checks on the committed diff.
Review adequacy → independent reviewer checks contract ownership, acceptance completeness, and documentation-only scope.

**Plan review:** Agent technical review: /root, 2026-10-17, approved documentation-only scope after reading this Work Record and Minimap contract. Required explicit This checkout/Across behavior, bounded partial coverage, and no implicit cross-worktree mutation.

**Approvals:** Not required at this risk level.

**Exceptions:** —

**State:** Ready to implement
<!-- agent-workflow:end -->

Source item: [Minimap related work](../../roadmap/features/show-feature-related-work.md); [collection plan](https://github.com/rore/rore-collection/blob/main/plans/feature-related-work.md).

## Implementation

2026-10-17: Discovery complete. Isolated branch from origin/main; original checkout's untracked files remain untouched. Independent plan review approved; proceeding with roadmap-only edit.
2026-10-17: Added the feature definition and one Next bullet. Independent result review by /root requested two wording corrections; both were applied. No runtime or installed files changed.
