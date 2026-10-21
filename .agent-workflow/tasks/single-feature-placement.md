<!-- agent-workflow:start -->
**Outcome:** Across worktrees shows each proven logical feature once while retaining all version and placement differences.
**Target:** Minimap Across worktrees board.
**Scope:** UI projection and version details, focused unit/browser regressions, canonical contract and relevant skill prose, generated runtime mirrors, and this Work Record.
**Constraints:** Preserve Git identity proofs, source-specific filtering and write guards, all versions, missing-reference coverage and nonblocking reads. Do not infer newest feature state from worktree activity or edit Pallium roadmap data.
**Completion criteria:** Hermes appears once in Parallel from Pallium main; filters and all grouping lenses produce at most one card per logical feature, independent same-ID features remain separate, and alternate placements remain inspectable. Regression and visual checks pass, followed by review, merge and authorized local update.
**Requirement baseline:**
{"source":"user:68b890cc-9ec0-484a-9365-0586f0f91313","outcome":"Across worktrees shows each proven logical feature once while retaining all version and placement differences.","scope":"UI projection and version details, focused unit/browser regressions, canonical contract and relevant skill prose, generated runtime mirrors, and this Work Record.","constraints":"Preserve Git identity proofs, source-specific filtering and write guards, all versions, missing-reference coverage and nonblocking reads. Do not infer newest feature state from worktree activity or edit Pallium roadmap data.","completion_criteria":"Hermes appears once in Parallel from Pallium main; filters and all grouping lenses produce at most one card per logical feature, independent same-ID features remain separate, and alternate placements remain inspectable. Regression and visual checks pass, followed by review, merge and authorized local update."}
**Relationships:**
{"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:add-worktree-aware-roadmap-view"}],"pull_requests":[]}
**Risk:** High
**Complexity:** Simple
**Reason:** Canonical projection contract and browser acceptance coverage are red architecture-review surfaces; no backend identity or write contract changes.
**Discovery:** projectWorktreeGroups currently renders one card per group. Actual Pallium main board places Hermes in Parallel; sibling placements include Later. Aggregate feature versions already carry opened-first source order. Existing tests explicitly expect repeated cards, so the contract and tests must change together.
**Material assumptions:** Existing source order is stable opened-first then admitted siblings; it is a display preference, not proof of latest feature edit. If inspection disproves this, revise the plan before implementation.
**Plan:** Invoke agent-workflow and classify before edits. Obtain clean-context plan review. Project each feature once from all matching versions, selecting its first matching version for placement and default content; retain per-version filtering and all matching evidence. Remove duplicate placement cues from cards and expose placement differences in version details. Add focused regressions, update contract/prose, sync mirrors, test and visually verify both views. Obtain independent result review, publish and merge after CI, then update local service under standing authorization.
**Verification plan:** Unit tests: cross-group duplicates, derived grouping, matching sibling fallback, independent same IDs, missing refs, stable ordering, preserved conflict evidence and no mutation. Browser regression and live-data visual checks: one Hermes card in List/Columns, alternate version placement accessible. Run focused suites, mirror parity and required CI.
**Behavior changes:**
[{"target":"repository-contract","path":"playwright/worktree-ui.spec.js","classification":"requirement-change","before":"Cross-group versions render four feature cards for three proven features; alternate placement is disclosed with an Also in card cue.","after":"Cross-group versions render three feature cards for three proven features in List and Columns; checkout-version details disclose alternate placements. Known legacy placement links preserve pinned checkout selection and unavailable-source confirmation.","reason":"Implement the approved one-card-per-proven-feature outcome and its reviewed compatibility amendment.","impact":"Removes duplicate placement cards while retaining all versions and missing-reference coverage.","alternatives":"Retain repeated cards, which contradicts the approved task outcome.","authority":{"scope":"task","name":"task-owner"},"approval":{"by":"user","reference":"user:68b890cc-9ec0-484a-9365-0586f0f91313","verbatim":"the point is for you to fix this"}}]
**Plan review:** /root/placement_review approved the direction with required stable-ID and traversal-order amendments; recorded below before product edits.
**Approvals:** Approved by user 2026-10-21: "the point is for you to fix this". Existing user directive authorizes review, merge and local update without repeated approval requests.
**Exceptions:** —
**State:** Ready for review
<!-- agent-workflow:end -->

## Implementation
Isolated branch feat/single-feature-placement from 94b92914e18caefb0abc595c0cc50406089bb8c0. Root resolved the owning feature on pickup: roadmap/features/add-worktree-aware-roadmap-view.md, with the exact Minimap reference in Relationships. No Pallium roadmap data changed.

Implementation: project once per proven feature after per-version filtering; retain matching conflict/status evidence and full version access. Keep stable canonical card IDs and normalize known legacy placements before visible-selection validation, transferring pinned source preferences. Preserve canonical board and derived traversal order. Count distinct source keys and disclose differing placements in version details. Contract, README, agent-facing roadmap prose and root-owned feature contribution note updated; both generated runtime mirrors synced.

## Evidence
- `node --test test/ui-worktrees.test.js test/ui-filters.test.js test/ui-lint-promises.test.js test/sync-mirrors.test.js`: 43 passed, zero failed.
- `node scripts/sync-mirrors.mjs`: both runtime trees synced. `git diff --check`: clean.
- Configured behavior-contract verification identifier: `test`. Focused browser command: `node C:/Dev/rore/minimap/node_modules/@playwright/test/cli.js test --config .local/placement-playwright.config.mjs playwright/worktree-ui.spec.js --grep 'cross-group versions|legacy placement|unavailable version on'`, using the existing Chromium cache through process-local PLAYWRIGHT_BROWSERS_PATH and isolated preview port 4371: 3 passed in 20.5s. Sandbox attempts failed before behavior checks (browser-cache location and temporary Git permissions); elevated isolated-fixture execution passed. Initial browser assertions needed popovers closed before layout clicks and canonical source selection by branch rather than raw Windows path; corrected and rerun.
- Root real-Pallium QA on isolated port 4371: exactly one Hermes in Parallel in List and Columns, all 12 checkout versions retained, Later placements inspectable. Root evidence: C:/Dev/rore/minimap/.local/single-placement-evidence/before-merge-list.png, before-merge-columns.png, before-merge-versions.png and accompanying JSON. Root visually inspected Columns.
- Skill-doc drift sweep found no old multiple-placement/card-disclosure claims in skill prose; existing exact-quote and single-line mentions concern unrelated spec tooling and remain valid.

Handoff: independent result review, full required checks, publication, merge and authorized local update remain root-owned. Implementation performed no installs or persistent environment changes.

## Result review
Agent technical review: /root/placement_review, approved 2026-10-21 with no blocking findings.
Reviewed revision: a64ca93 (final source/test/docs diff).
Verification adequacy: 43 focused checks, three browser regressions and real Pallium List/Columns/version-detail verification cover the duplicate-card trigger, filters, ordering, source selection and unavailable-source guard. Root inspected all three visual captures. Full CI remains the merge gate. Standing user authorization covers driving this fix through merge and the local service update without another approval loop.

## Checkpoint: architecture-review
Change: one visible card per proven feature, with opened-first matching placement and differences retained in details. This removes misleading repeated placement without collapsing unproven identities or inventing recency. Test filters, grouping and source selection; no migration or extra I/O.

## Plan review amendment
Project each proven feature key once after filtering versions individually. Its first matching version chooses placement and default content; all matching evidence and full version access remain. Canonical card IDs use the feature key and its first unfiltered version's board kind/group, independent of filters and lenses. Normalize only known board/derived placement aliases before visible-selection validation, transferring pinned source preferences and preserving unavailable-source guards. Precompute choices, then emit in existing aggregate group/item traversal (board cards at their chosen placement), never aggregate feature-array order. Count distinct source keys when one source has multiple memberships. Actual Pallium main places Hermes in Parallel; old siblings place it in Later; neither proves feature-edit recency. Root owns publication, merge, live verification and local update.

