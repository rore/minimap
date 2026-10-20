<!-- agent-workflow:start -->
**Outcome:** Minimap routes assigned roadmap pickup, resume and completion to Pallium's canonical session participation lifecycle without duplicating its procedure.

**Target:** rore/minimap packaged roadmap skill.

**Scope:** package/minimap/skills/minimap-roadmap/SKILL.md and references/pallium-participants.md; this Work Record. Parent owns the canonical roadmap contribution update and cross-tool coordination.

**Constraints:** Documentation only. Preserve standalone/no-tools work, exact Minimap CLI item references, explicit-origin and structural-origin boundaries, honest failed-mutation reporting, and unfinished feature scope. No runtime, registry, gates, services, installed-skill sync, association mutations on others' behalf, primary/live edits, PR52 changes, push or merge.

**Completion criteria:** Pickup/resume/completion guidance directs readers to Pallium's canonical lifecycle; session-level explicit references include earlier-turn attachments, remain during owned waits, and are removed when assignment ends, cancels or transfers even if the feature remains unfinished. Minimap retains its exact item-ref procedure and unavailable-integration fallback. Independent review and scoped documentation/governance checks pass; parent supplies actual lifecycle and installed-sync evidence.

**Requirement baseline:**
{"source":"astra-reviewer:user:01a15914-d6c3-7853-8b05-d714980a32a3","outcome":"Minimap routes assigned roadmap pickup, resume and completion to Pallium's canonical session participation lifecycle without duplicating its procedure.","scope":"package/minimap/skills/minimap-roadmap/SKILL.md and references/pallium-participants.md; this Work Record. Parent owns the canonical roadmap contribution update and cross-tool coordination.","constraints":"Documentation only. Preserve standalone/no-tools work, exact Minimap CLI item references, explicit-origin and structural-origin boundaries, honest failed-mutation reporting, and unfinished feature scope. No runtime, registry, gates, services, installed-skill sync, association mutations on others' behalf, primary/live edits, PR52 changes, push or merge.","completion_criteria":"Pickup/resume/completion guidance directs readers to Pallium's canonical lifecycle; session-level explicit references include earlier-turn attachments, remain during owned waits, and are removed when assignment ends, cancels or transfers even if the feature remains unfinished. Minimap retains its exact item-ref procedure and unavailable-integration fallback. Independent review and scoped documentation/governance checks pass; parent supplies actual lifecycle and installed-sync evidence."}

**Relationships:**
{"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:harden-pallium-participant-guidance-config"}],"pull_requests":[]}

**Risk:** High

**Complexity:** Simple

**Reason:** Both intended skill documentation paths are red agent-behavior contracts requiring architecture review. The implementation is one small routing/ownership clarification across two documents, with generic lifecycle owned upstream.

**Discovery:** Current SKILL.md handoff prose restricts sender cleanup to an association it attached; the participant reference repeats attach/detach steps and says detach only an explicit association you attached. This can exclude earlier-turn session attachments. Installed collection-coordination already routes participation to Pallium and distinguishes assignment completion from feature completion. Installed Pallium work-associations.md was read during its manager-owned update and currently contains only its heading; the stable canonical entrypoint is references/work-associations.md; final approved wording is required for final acceptance and installed sync. Exact owning item was read and its tuple resolved through the existing CLI, not constructed.

**Material assumptions:** Pallium's manager will provide a stable canonical lifecycle reference covering explicit session-level refs, resume, owned waits and assignment-end cleanup. Implement the short route against the verified human lifecycle contract and stable entrypoint now; reserve final acceptance and installed sync until Pallium supplies stable approved wording. If final wording conflicts, report to parent and reconcile before acceptance; do not recreate the generic procedure locally. The parent retains sole ownership of the shared roadmap and installed/environment validation.

**Plan:** 1. Invoke agent-workflow to create and commit this expanded Work Record and classify risk before documentation edits. 2. Stop for parent-arranged clean-context plan review. 3. Once approved, implement against the verified human contract and stable canonical Pallium entrypoint; replace duplicated generic attach/detach instructions with a short route to the installed Pallium lifecycle; clarify session rather than turn scope, owned waits and assignment-end cleanup without adding a new checklist. Keep Minimap's exact CLI reference derivation and optional standalone fallback. 4. Check all handoff/participation wording in the two files, validate links and preserved boundaries, record parent lifecycle evidence separately, then obtain independent result review and run local governance checks. No runtime mirrors are changed for source skill prose.

**Verification plan:** manual: Compare the final two-file diff with canonical Pallium lifecycle and collection-coordination; verify pickup/resume, earlier-turn explicit attachment, owned wait, completed/cancelled/transferred assignment with unfinished feature, structural ref exclusion, capacity/mutation failure, missing tools and exact CLI tuple remain covered without copied generic steps. Run targeted case-insensitive wording/link sweeps and git diff --check. Run fresh Redline/workflow checks; architecture-reviewed checkpoint remains parent-owned at PR. Parent validates actual attach/resume/detach and installed doc-only sync; do not claim local mutation evidence from this worker.

**Plan review:** Agent technical review: /root/participation_review APPROVED amended sequencing at c269c2a on 2026-10-20, forwarded by parent. Implement the short route now against the verified human lifecycle contract and stable entrypoint; reserve final acceptance and installed sync until Pallium wording is stable and approved. No findings.

**Approvals:** Approved by user 2026-10-20: "ok, coordinate these changes with the managers across the tools. keep it short and don't duplicate instructions, sync the installed skills, and validate the actual attach/resume/detach flow so we know it works". Parent verified astra-reviewer user item 01a15914-d6c3-7853-8b05-d714980a32a3 and delegated only this Minimap repository contribution; parent owns installation and actual lifecycle validation.

**Exceptions:** —

**State:** Ready for review
<!-- agent-workflow:end -->

## Implementation

Isolated checkout `C:/Dev/rore/minimap/.local/participation-lifecycle`, branch `feat/participation-lifecycle`, base `19f70122057666d3a499741a872e4773757b9c04`. Initial Work Record was committed at `c269c2a` before skill-doc edits; source documentation implementation and scoped checks are complete at `408729c`. Next action: finish independent result review, reconcile stable approved Pallium wording and run fresh governance checks. Parent owns publication under the verified user task, actual lifecycle validation and scoped installed-document sync; this worker does not push. Primary/live and unfinished PR52 checkout remain untouched.

Owning roadmap item: `roadmap/features/harden-pallium-participant-guidance-config.md`, currently done; this contribution must not reopen or imply unfinished broader work. Parent owns its contribution note. CLI resolution: `node package/minimap/cli.js roadmap item-ref harden-pallium-participant-guidance-config --repo C:/Dev/rore/minimap/.local/participation-lifecycle --json`, returning the exact tuple recorded above. No injected exact session identity was supplied for this worker; no scoped Pallium association call was guessed or attempted.

## Checkpoint: architecture-review

What is changing: short Minimap skill routes and removal of duplicated generic participation procedure. Why: cleanup must follow the session assignment lifecycle, including explicit associations from prior turns. Affected contract: agent-facing participation and handoff guidance. Compatibility risk: low runtime risk, meaningful instruction risk if Pallium is missing; preserve optional fallback and exact-source boundaries. Verification: scoped doc review/sweeps and local governance; parent owns real lifecycle and installation evidence.

## Implementation update

Plan review approved the amended sequencing before skill-doc edits. Replaced the SKILL handoff turn-local cleanup wording with a route to the participation reference. Replaced its duplicated generic procedural list with the canonical Pallium lifecycle route, a concise session-scope/owned-wait/assignment-end summary and standalone callable-tools fallback. Exact CLI derivation and all read-only UI/provider semantics are untouched. Parent reports successful attach/resume UI evidence with the exact reference retained; one refresh timeout was followed by a successful retry. Detach is not yet due while the assignment remains owned. Final approved upstream wording, independent result review and governance remain acceptance gates; no installation sync performed.

## Documentation verification

`git diff --check` passed. Scoped wording checks passed for the canonical lifecycle route, earlier-turn/session scope, owned waits, assignment-end cleanup despite unfinished feature, producer-owned structural refs, no eviction and successful-result authority; obsolete turn-local cleanup restrictions are absent. Referenced local document targets exist. Exact CLI procedure and all participant observation/provider prose are unchanged. No runtime tests or mirror generation are needed for this docs-only diff. Final acceptance remains pending stable approved Pallium wording and independent result review; parent owns actual flow and installed sync.

## Review corrections and governance checkpoint

Applied reviewer-requested wording refinements: participation applies under the existing triggers, and an exact listed structural pair is reused without adding an explicit duplicate. Updated initial recovery prose to reflect implemented source and parent-owned publication. Preliminary fresh Redline/workflow run identified only the expected pending independent result-review blocker and architecture-review label advisory; a verification-method formatting advisory was corrected. Final governance is rerun after this commit. Stable approved Pallium wording, detach-at-assignment-end evidence and parent-owned scoped installed sync remain final acceptance conditions.
