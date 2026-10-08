<!-- agent-workflow:start -->
<!-- A `**Label:**` at the start of a line inside this block is parsed as a field
     header; an unexpected one (unknown or duplicate) fails the record. Keep bold
     sub-headings out of a field's prose value (put such structure below the block,
     or use plain text). -->
**Outcome:**
Refresh Minimap's repo-managed agent-workflow copies to approved upstream revision c9040a7682d9cf0d7b4a8e5e955c00be86294c3f while preserving local setup.

**Target:**
Minimap consumer package copies at `.agents/skills/agent-workflow/` and `.claude/skills/agent-workflow/`, plus the active root vendored reporter at `scripts/agent-redline-report.py`.

**Scope:**
Apply the 18-file `dist/agent-workflow/` delta from approved base 468f1d5fa5cf856bfd45ebb4ff041bbacc714b02 to pin c9040a7682d9cf0d7b4a8e5e955c00be86294c3f in both package roots, and update the root reporter mirror because runtime and CI execute it. Do not add absent `scripts/agent-workflow-tune.py`.

**Constraints:**
Keep main checkout and existing untracked artifacts untouched. No global skills, actual hooks or settings, root configuration, CI workflow, server restart, product roadmap alignment, other consumer repos, or historical Work Record migration. Do not change upstream checkout. Save rollback copies before overwriting.

**Completion criteria:**
Both package roots match the pinned package; the root reporter matches the pinned packaged reporter; every overwritten file matched the approved base after CRLF normalization; rollback copies exist; only the package delta plus root reporter change; normal workflow and redline gates pass.

**Requirement baseline:**
{"source":"User approval relayed by manager: \"approved\"; approved source PR51 c9040a7682d9cf0d7b4a8e5e955c00be86294c3f; installed base 468f1d5fa5cf856bfd45ebb4ff041bbacc714b02","outcome":"Refresh Minimap's repo-managed agent-workflow copies to approved upstream revision c9040a7682d9cf0d7b4a8e5e955c00be86294c3f while preserving local setup.","scope":"Apply the 18-file dist/agent-workflow/ delta from approved base 468f1d5fa5cf856bfd45ebb4ff041bbacc714b02 to pin c9040a7682d9cf0d7b4a8e5e955c00be86294c3f in both package roots, and update the root reporter mirror because runtime and CI execute it. Do not add absent scripts/agent-workflow-tune.py.","constraints":"Keep main checkout and existing untracked artifacts untouched. No global skills, actual hooks or settings, root configuration, CI workflow, server restart, product roadmap alignment, other consumer repos, or historical Work Record migration. Do not change upstream checkout. Save rollback copies before overwriting.","completion_criteria":"Both package roots match the pinned package; the root reporter matches the pinned packaged reporter; every overwritten file matched the approved base after CRLF normalization; rollback copies exist; only the package delta plus root reporter change; normal workflow and redline gates pass."}

**Risk:**
High

**Complexity:**
Simple

**Reason:**
The active root redline reporter affects fail-closed governance evidence, so High is appropriate under the redline risk floor and upstream PR49 precedent. The exact pinned-package copy is mechanically simple; downstream compatibility is established by the full base comparison and destination checks.

**Discovery:**
Pinned PR51 changes the package to revision c9040a7682d9cf0d7b4a8e5e955c00be86294c3f. Manager verified both installed package roots exactly match base 468f1d5fa5cf856bfd45ebb4ff041bbacc714b02 after CRLF normalization. Independent check: 71 base package files, zero missing or differing files in each root. The pinned delta contains 18 files (+489/-125): additions `dist/agent-workflow/.gitattributes`, `dist/agent-workflow/templates/agent-workflow-consumer.gitattributes`; modifications to the reporter, pre-push template, two extension scaffolds, bootstrap/operating docs, merge helper, manifest, tune helper, workflow template, agents-section/bootstrap-summary templates, plan-and-review/review-result docs, and both Work Record templates. Root `scripts/agent-redline-report.py` exactly matches the base packaged reporter, differs from the pin, and is invoked by `scripts/agent-workflow-runtime.py`, local redline wrapper, and CI. Root scripts/agent-workflow-tune.py is absent and has no consumer callsite; do not create it. Existing runtime, local wrapper, and CI callers retain their current CLI flags, which the pinned reporter accepts; they do not pass --head-ref, so the new verified-head suppression-catalog path remains unused. Do not upgrade CI or wrappers in this task. Existing package updater guidance is in pinned `core/skill/bootstrap-mode.md` step 4.0: refresh both package roots and verify manifests, preserving configuration, hooks, and Work Records. The source repo's `install-skill-locally.sh` only updates its own checkout; `package-skill.sh --dest` wipes its target and must only run against fresh scratch storage.

**Material assumptions:**
Both consumer package trees are exact copies of the approved base; verified for 71 files per root after CRLF normalization. Any missing or unexpected path stops overwrites.
Root reporter is a managed mirror of the packaged reporter; verified by normalized exact match to base and runtime/CI callsites.
The upstream technical and human reviews for PR49, PR50, and PR51 apply to the exact pinned package outputs; manager destination review is recorded below.

**Plan:**
1. Obtain manager destination plan review before package edits; upstream review evidence covers the unchanged source revisions PR49/PR50/PR51.
2. Use the pinned package artifact as source; update only the 18 approved package paths in both roots and the active reporter mirror. Keep hooks, settings, CI, global skills, and other root scripts untouched.
3. Before overwrites, save exact recoverable copies under a task-specific backup path; recheck each target against base and stop on drift.
4. Verify both roots against the pin, root reporter parity, exact changed path set, and rollback inventory; run repository workflow and redline checks.
Key conventions: the two consumer roots mirror the package manifest; root reporter is an active vendored mirror, not a config file; preserve the rest of the repository's local harness.
Target paths: the 18 paths under `dist/agent-workflow/` applied to each package root, plus root `scripts/agent-redline-report.py`.
Stop conditions: any preflight drift, source revision/output change, or requirement to alter hooks/settings/config/CI/global state.

**Verification plan:**
When the refresh completes, each package root shall match all pinned package files byte-for-byte → raw full-tree comparison and manifest verification. CRLF normalization is used only for preflight base comparison.
When the refresh completes, active root reporter shall match pinned packaged reporter byte-for-byte → raw content comparison. Existing runtime, wrapper, and CI argument shapes shall remain accepted → invoke the reporter with those exact legacy flags and then run the fresh repository redline gate.
When changes are reviewed, only 18 package delta paths in each root, the root reporter, and this Work Record shall differ → staged/unstaged path inventory plus ignored-path inventory.
When local gates run, Work Record and redline requirements shall pass or report their exact status → repository workflow runtime check and fresh redline check.

**Plan review:**
Agent technical review: upstream PR49 merge 2908156, PR50 merge 06d8e63, and PR51 merge c9040a7; manager destination review confirms compatibility, scope, and verification on 2026-10-08. Human plan review: upstream PR49/50/51 reviews cover unchanged package application; destination update was approved by the user on 2026-10-08.

**Approvals:**
Approved by user 2026-10-08: "approved"

**Exceptions:**
—

<!-- Plan review complete; ready to apply the approved pin. -->
**State:** Ready to implement
<!-- agent-workflow:end -->

## Implementation

Destination plan reviewed by manager. User authorization was relayed as the exact response “approved”. Isolated worktree: `C:/Dev/rore/minimap/artifacts/workflow-consumer-refresh-20261008`; branch `feat/workflow-consumer-refresh`; base `d1ed842262cb042b4f174e38460ee14f1d63f612`.

## Evidence

Upstream source review evidence: Workflow PR49 merge `2908156`, PR50 merge `06d8e63`, and PR51 merge `c9040a7` (manager-confirmed independent reviews; PR49/50 full checks). Package delta verified with `git diff --stat 468f1d5fa5cf856bfd45ebb4ff041bbacc714b02 c9040a7682d9cf0d7b4a8e5e955c00be86294c3f -- dist/agent-workflow`: 18 files, +489/-125.

Consumer comparison: 71 base package files in each installed root, zero differing/missing after CRLF normalization. Active root reporter equals base package reporter and differs from pin; runtime, local redline wrapper, and CI use it. Root tune helper is absent.

## Result review

Pending implementation and result review.