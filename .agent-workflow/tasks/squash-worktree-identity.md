# Squash-integrated worktree feature identity

<!-- agent-workflow:start -->
**Outcome:** Newly introduced features integrated by a squash merge appear once Across worktrees, retaining distinct versions after subsequent edits and protecting unrelated ID collisions.
**Target:** Minimap linked-worktree aggregation.
**Scope:** package/minimap/src/worktree-aggregate.js; test/worktree-aggregate.test.js; package/minimap/CONTRACT.md; relevant skill reference prose; generated runtime mirrors. Generic rendered UI acceptance without changing protected test obligations.
**Constraints:** No persistent identity registry, new dependencies, lifecycle changes, roadmap edits, or write-target changes. Existing source and participant semantics remain intact. Missing or ambiguous evidence fails closed. No automatic service replacement.
**Completion criteria:** A generic squash fixture produces one feature and source-specific versions, including later edits and checkout newline differences. Independent ID/path collisions and delete/recreate remain separate. Evidence work is bounded and cached. List and Columns are visually inspected with screenshots. Required checks and independent result review pass.
**Requirement baseline:** {"source":"work-record-initial","outcome":"Newly introduced features integrated by a squash merge appear once Across worktrees, retaining distinct versions after subsequent edits and protecting unrelated ID collisions.","scope":"package/minimap/src/worktree-aggregate.js; test/worktree-aggregate.test.js; package/minimap/CONTRACT.md; relevant skill reference prose; generated runtime mirrors. Generic rendered UI acceptance without changing protected test obligations.","constraints":"No persistent identity registry, new dependencies, lifecycle changes, roadmap edits, or write-target changes. Existing source and participant semantics remain intact. Missing or ambiguous evidence fails closed. No automatic service replacement.","completion_criteria":"A generic squash fixture produces one feature and source-specific versions, including later edits and checkout newline differences. Independent ID/path collisions and delete/recreate remain separate. Evidence work is bounded and cached. List and Columns are visually inspected with screenshots. Required checks and independent result review pass."}
**Risk:** High
**Complexity:** Moderate
**Reason:** Canonical identity contract changes; matching versions controls participant attribution. Git squash equivalence cannot prove user intent.
**Discovery:** Existing sharedPaths requires merge-base item ID/path and rejects deletion histories. Actual integration's complete six-path binary/full-index patch equals original branch base-to-tip patch; newly added item is absent at merge-base. Checkout newline variation is already normalized only for display conflicts. Canonical owner item: roadmap/features/add-worktree-aware-roadmap-view.md (owner updates designated main checkout).
**Material assumptions:** Complete repository change equivalence is an acceptable squash-equivalence signal, despite indistinguishability from independently reproduced identical complete changes. If rejected, stop and report explicit-provenance alternatives. Bounded first-parent history reaches merge-base; unavailable, capped, merge-crossing, malformed, or incomplete evidence retains separation. Current ID/path must agree with parsed historically added item; delete/recreate remains separate.
**Plan:** Preserve ancestor rule. Add bounded, cached, whole-repository raw transition evidence from first-parent history (maximum 64 commits per side and existing 4MiB Git output cap). Compare exact complete changed-path/mode/old-blob/new-blob maps of merge-base-to-branch prefixes against individual single-parent commits in the opposite history. Parse matched introduced roadmap blobs in one batch, then extend sharedPaths only for same added ID/path, with existing deletion exclusions. Do not use matching file contents or whitespace-insensitive patch IDs. Stop if reviewer or owner rejects the observational-equivalence boundary. Edit top-level source, synchronize runtime mirrors, audit skill prose. Preserve participant and source APIs. Add generic regression cases and use isolated acceptance fixture.
**Verification plan:** When a new item is squash-integrated, aggregate shall show one logical feature with both source versions → focused worktree-aggregate fixture. When either side later edits metadata or body, versions and conflicts shall remain source-specific → regression fixture. When templates collide independently or an item is deleted/recreated, aggregate shall retain distinct identities and unknown participant attribution → aggregate and presence tests. When evidence is missing or exceeds 64 commits/4MiB, identity shall stay separate and disclose uncertainty → boundedness tests. When worktree files differ only in newline formatting, display shall have no conflict and raw revisions shall remain distinct → regression. Render List and Columns on generic fixture → actual screenshots and UI inspection. Run node scripts/sync-mirrors.mjs; focused aggregate/presence/UI tests, required node suite and workflow check; independent result review.
**Plan review:** Agent technical review: ## Plan review below; reviewed c209581efa1eb4002c914101b2198eca3de7adbe. Conditional on separate human acceptance of observational-equivalence boundary. Additional global work budget and participant attribution coverage required before implementation.
**Approvals:** Pending human review of exact equivalence boundary and plan.
**Exceptions:** —
**State:** Blocked
<!-- agent-workflow:end -->

## Implementation

Planning only. No product code edited. Isolated branch feat/squash-worktree-identity starts at afbec2142c6674fde9e4b643dbf4e13b3284bc7c.

## Evidence

Read-only actual-history comparison: complete integration parent-to-commit patch equals original merge-base-to-branch-tip patch. This proves change equivalence, not causal user intent. Six paths changed together; matching only the new item blob would discard that context.

## Recovery

Next action: clean-context plan review and owner disposition of the indistinguishable independently identical complete-change case. No implementation or shared service change until the High gate is satisfied.

## Plan review

Clean-context non-implementer technical review of c209581efa1eb4002c914101b2198eca3de7adbe inspected this record, aggregation source, canonical contract, existing collision tests, and plan checkpoint. Disposition: conditional. Equal complete Git transitions prove observational equivalence, not causal shared identity. Accepting that signal narrows the independent-collision guarantee; the human must approve that exact boundary. Without acceptance, retain fail-closed separation and report explicit provenance alternatives.

Reviewer requires a global bounded work budget and attribution checks. Proposed additional bound: no more than 32 cached history loads and 8192 total raw change records per aggregate, with existing per-history 64-commit and 4MiB limits. A limit retains separation and reports uncertainty. Participant tests must cover count/detail attribution for accepted squash-equivalent versions and denial for separate ambiguous same-ID features. These refinements remain subject to the pending human plan review.
