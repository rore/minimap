<!-- agent-workflow:start -->
**Outcome:** Across worktrees shows each proven logical feature once while retaining all version and placement differences.
**Target:** Minimap Across worktrees board.
**Scope:** UI projection and version details, focused unit/browser regressions, canonical contract and relevant skill prose, generated runtime mirrors, and this Work Record.
**Constraints:** Preserve Git identity proofs, source-specific filtering and write guards, all versions, missing-reference coverage and nonblocking reads. Do not infer newest feature state from worktree activity or edit Pallium roadmap data.
**Completion criteria:** Hermes appears once in Parallel from Pallium main; filters and all grouping lenses produce at most one card per logical feature, independent same-ID features remain separate, and alternate placements remain inspectable. Regression and visual checks pass, followed by review, merge and authorized local update.
**Requirement baseline:**
{"source":"user:68b890cc-9ec0-484a-9365-0586f0f91313","outcome":"Across worktrees shows each proven logical feature once while retaining all version and placement differences.","scope":"UI projection and version details, focused unit/browser regressions, canonical contract and relevant skill prose, generated runtime mirrors, and this Work Record.","constraints":"Preserve Git identity proofs, source-specific filtering and write guards, all versions, missing-reference coverage and nonblocking reads. Do not infer newest feature state from worktree activity or edit Pallium roadmap data.","completion_criteria":"Hermes appears once in Parallel from Pallium main; filters and all grouping lenses produce at most one card per logical feature, independent same-ID features remain separate, and alternate placements remain inspectable. Regression and visual checks pass, followed by review, merge and authorized local update."}
**Relationships:**
{"schema_version":1,"sources":null,"pull_requests":[]}
**Risk:** High
**Complexity:** Simple
**Reason:** Canonical projection contract and browser acceptance coverage are red architecture-review surfaces; no backend identity or write contract changes.
**Discovery:** projectWorktreeGroups currently renders one card per group. Actual Pallium main board places Hermes in Parallel; sibling placements include Later. Aggregate feature versions already carry opened-first source order. Existing tests explicitly expect repeated cards, so the contract and tests must change together.
**Material assumptions:** Existing source order is stable opened-first then admitted siblings; it is a display preference, not proof of latest feature edit. If inspection disproves this, revise the plan before implementation.
**Plan:** Invoke agent-workflow and classify before edits. Obtain clean-context plan review. Project each feature once from all matching versions, selecting its first matching version for placement and default content; retain per-version filtering and all matching evidence. Remove duplicate placement cues from cards and expose placement differences in version details. Add focused regressions, update contract/prose, sync mirrors, test and visually verify both views. Obtain independent result review, publish and merge after CI, then update local service under standing authorization.
**Verification plan:** Unit tests: cross-group duplicates, derived grouping, matching sibling fallback, independent same IDs, missing refs, stable ordering, preserved conflict evidence and no mutation. Browser regression and live-data visual checks: one Hermes card in List/Columns, alternate version placement accessible. Run focused suites, mirror parity and required CI.
**Plan review:** Pending clean-context review.
**Approvals:** Approved by user 2026-10-21: "the point is for you to fix this". Existing user directive authorizes review, merge and local update without repeated approval requests.
**Exceptions:** —
**State:** Ready to implement
<!-- agent-workflow:end -->

## Implementation
Isolated branch feat/single-feature-placement from 94b92914e18caefb0abc595c0cc50406089bb8c0. No product edits yet. Source feature reference unverified; this is a user-reported UI bug, not a Pallium feature implementation.

## Checkpoint: architecture-review
Change: one visible card per proven feature, with opened-first matching placement and differences retained in details. This removes misleading repeated placement without collapsing unproven identities or inventing recency. Test filters, grouping and source selection; no migration or extra I/O.

