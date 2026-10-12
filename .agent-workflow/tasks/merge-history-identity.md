<!-- agent-workflow:start -->
**Outcome:** Correctly connect proven versions of a roadmap feature across supported Git histories without merging unrelated features.
**Target:** Minimap worktree aggregation and participant candidate selection.
**Scope:** Investigate the reported duplicate named-drafts identities; fix the shared identity matching defect, add generic regressions, and reconcile affected documentation and roadmap evidence.
**Constraints:** Preserve independent same-ID features, deletion/recreation boundaries, bounded Git work, and unknown participant semantics. Do not edit Dictation files, install tools, or restart the live service.
**Completion criteria:** Proven related versions aggregate once; ambiguous or untracked copies remain safely distinct; counts and participant eligibility agree; focused regressions and required checks pass.
**Requirement baseline:** {"source":"user-2026-10-12-investigate-and-fix","outcome":"Correctly connect proven versions of a roadmap feature across supported Git histories without merging unrelated features.","scope":"Investigate the reported duplicate named-drafts identities; fix the shared identity matching defect, add generic regressions, and reconcile affected documentation and roadmap evidence.","constraints":"Preserve independent same-ID features, deletion/recreation boundaries, bounded Git work, and unknown participant semantics. Do not edit Dictation files, install tools, or restart the live service.","completion_criteria":"Proven related versions aggregate once; ambiguous or untracked copies remain safely distinct; counts and participant eligibility agree; focused regressions and required checks pass."}
**Risk:** High
**Complexity:** Moderate
**Reason:** The fix changes documented identity support in the red-zone CONTRACT.md and lifecycle reference. Keep first-parent transition semantics and single-parent integration matching; no write authorization, persistence, or configuration change.
**Discovery:** Diagnosis /root/identity_diagnosis confirms transitionHistory uses --first-parent --diff-merges=first-parent but parses exactly one parent in commit headers. A later normal merge therefore invalidates otherwise valid squash evidence. The committed named-drafts groups have exact transition equivalence; the untracked main-only copy remains unproven. A parser fix can join the two committed groups but cannot safely promise participant eligibility while the untracked duplicate ID remains.
**Material assumptions:** A bounded Git-evidence correction can connect the committed groups without guessing identity from matching text or IDs. If disproved, return to planning and explain the limitation instead of weakening identity rules.
**Plan:** Accept one or more parent hashes in transitionHistory and retain the first parent for the already first-parent-relative changes. Keep integration matching restricted to single-parent commits so this fixes traversal without broadening identity proof. Preserve parent-chain validation and all caps. Add generic fixtures for a later ordinary merge on either side of an existing exact squash proof; assert identity/count/participant behavior, independent same-ID isolation and untracked ambiguity. Update only the corresponding history wording in CONTRACT.md and roadmap server reference, sync runtimes, and add follow-up evidence to the existing roadmap item. Obtain independent technical and required human plan review before product edits; then focused tests, isolated rendered board inspection, independent result review, and normal delivery gates.
**Verification plan:** Related history joins correctly -> generic Git fixtures exercising aggregation and participant selection. Independent or recreated identity remains separate -> existing negative tests plus missing cases. Bounded work remains -> existing cap/performance regressions. Presentation remains understandable -> rendered isolated board inspection. Delivery -> workflow, redline and CI checks.
**Plan review:** Agent technical review: /root/merge_history_plan_review approved the plan at base 75541444eb7aed5a6eba5707d402ae8ecd492e92 on 2026-10-12. Parse all parent hashes but retain first-parent transitions; explicitly exclude merge signatures as integration candidates. Cover ordinary merges on either side, merge-only negative proof, untracked duplicate ambiguity, and existing identity/cap tests. Human plan review required by High classification before product edits.
**Approvals:** User requested "ok, so let's investigate and fix" on 2026-10-12. No live environment changes authorized.
**Exceptions:** —
**State:** Blocked
<!-- agent-workflow:end -->

Source item: roadmap/features/add-worktree-aware-roadmap-view.md (existing delivered feature; this follow-up does not reopen unrelated completed work).

## Implementation
Isolated checkout: C:/Dev/rore/minimap/artifacts/merge-history-identity, branch feat/merge-history-identity, base 7554144. Investigation only; Blocked denotes pending technical and human plan review. No product edits.

## Evidence
Read-only reproduction found eight loaded checkouts, no excluded checkouts, three logical identities for the same named-drafts ID, and ambiguous participant reference selection. No user files were changed.

## Result review
Pending.
