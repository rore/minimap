<!-- agent-workflow:start -->
**Outcome:** Install Agent Workflow and its Node Redline profile in Minimap.
**Target:** minimap, feat/adopt-agent-workflow
**Scope:** Bootstrap inspection and approved installation of identical skills, configs, policy, checker and runtime adapters, owned agent guidance, checkpoint documentation, and CI workflow if confirmed.
**Constraints:** Preserve existing instructions and tests. Keep roadmap files canonical. No application behavior changes or shared-server restart. Do not modify branch protection or CODEOWNERS; propose them. Obtain bootstrap policy and CI confirmations before installation.
**Completion criteria:** Approved repository-specific Node policy, complete matching skill installations, valid configuration, successful backend probe, documented runtime coverage limits, bootstrap summary, and green resulting PR checks.
**Requirement baseline:** {"source":"work-record-initial","outcome":"Install Agent Workflow and its Node Redline profile in Minimap.","scope":"Bootstrap inspection and approved installation of identical skills, configs, policy, checker and runtime adapters, owned agent guidance, checkpoint documentation, and CI workflow if confirmed.","constraints":"Preserve existing instructions and tests. Keep roadmap files canonical. No application behavior changes or shared-server restart. Do not modify branch protection or CODEOWNERS; propose them. Obtain bootstrap policy and CI confirmations before installation.","completion_criteria":"Approved repository-specific Node policy, complete matching skill installations, valid configuration, successful backend probe, documented runtime coverage limits, bootstrap summary, and green resulting PR checks."}
**Risk:** High
**Complexity:** Moderate
**Reason:** Bootstrap changes governance and CI for a canonical package with live consumers.
**Discovery:** Inspecting released Agent Workflow 468f1d5fa5cf856bfd45ebb4ff041bbacc714b02 and Minimap's current source, tests, instructions, and GitHub rules.
**Material assumptions:** Node zone-only profile fits the owned JavaScript packages. Verify manifests and existing boundary tools; stop and revise if evidence contradicts this.
**Plan:** Follow bootstrap phases: inspect, propose, adapt, write, confirm CI, self-summary. Obtain required confirmations at phase boundaries.
**Verification plan:** Approved Node policy -> configuration and policy schema validation. Complete skill installations -> both manifests and source-byte comparison. Backend reachability -> installed adapter probe with real reporter evidence. Documentation exemptions -> positive documentation-only and negative mixed-change checks. Delivery -> resulting PR test, redline, and agent-workflow checks. Runtime limits -> record native hooks as degraded unless actual interception is demonstrated.
**Plan review:** Agent technical review: /root/bootstrap_review. Approved Phase 4 on 2026-10-01 after inspecting the record, both configuration drafts, repository instructions and CI. Preserve pending behaviorContracts until combined harness evidence, test documentation-only versus mixed-change applicability, and identify the external interpreter in probe evidence. No unresolved installation findings.
**Approvals:** Approved by user 2026-10-01: "yes, and also relax documentation only changes". Approval covers the presented Node shadow policy direction, workflow behavior protection, ordinary-documentation relaxation, and read-only calibration. Approved by user 2026-10-01: "yes, go" in response to the explicit CI installation proposal. Approved by user 2026-10-01: "approve" for adoption result and architecture-reviewed label.
**Exceptions:** —
**State:** Ready for review
<!-- agent-workflow:end -->

## Implementation

Bootstrap record created before repository inspection. Approved policy, configuration, skills, and local adapters are now installed. CI installation was separately approved and completed.

## Phase 1 findings

User confirmed Phase 1 on 2026-10-01: "ok, let's go". Preparing inert Phase 2 drafts; no active configuration or hooks written.

- Existing Agent Workflow/Redline: absent. Existing agent instructions: root AGENTS.md; preserve them.
- Source package: package/minimap/package.json (ES modules, cli.js bin), root package.json drives CI. Two skill runtime copies are generated, not additional owned packages.
- Authoritative sources: roadmap/ feature and scope files; package/minimap/CONTRACT.md; packaged skill instructions and references. Architecture/layout guidance is in AGENTS.md. No standalone decisions ledger found in the inspected tracked documentation.
- CI: .github/workflows/ci.yml, Node 22, npm test, Playwright, mirror parity. PR-driven: 30 recent merged PRs inspected, 74 commits in the three-month window.
- Protection: main has an active ruleset requiring test and an up-to-date branch. Classic protection endpoint returns 404; the ruleset still protects main. No CODEOWNERS found. Owner is a user account, so the org-scoped tuner does not apply.
- Extension: node, zone-only; no existing import-boundary backend, TypeScript/bundler configuration, YAML formatter gate, or pre-push hook found.
- Behavior-contract candidates: package/minimap/CONTRACT.md, packaged skill references, test/source-bound*.test.js, test/sessions-atomic.test.js, test/runtime-compatibility.test.js, test/restart-race.test.js, test/sync-mirrors.test.js, and playwright/*.spec.js. Existing test check executes the test suites, but combined harness evidence and protection choice remain unresolved. These are candidates, not an installed policy.
- Documentation-only exemption candidates for review: README.md and ordinary roadmap planning edits. Contract changes, acceptance-criteria changes, agent instructions, and governance are not automatically exempt. Direct-main exemption is disallowed by existing protection.
- Watch candidates: manifests/lockfile, playwright.config.js, CI, and both runtime mirrors. Generated copies remain classified and parity remains enforced.
- Phase 1 deferred choices were subsequently resolved in Phase 2/3 below; separate CI installation confirmation remains pending.

## Phase 2 and 3

User approved the proposed policy direction and workflow protection, adding relaxed documentation-only handling. The checker emitted an approved exemption fragment for README.md, roadmap/board.md, docs/images/, and docs/demo-spec/: workflowRequired=false, directDefaultBranchAllowed=false. Feature requirements, acceptance criteria, normative contracts, and agent instructions remain outside this exemption. Active policy installation follows technical review; selected behavior-contract enforcement remains pending combined PR harness evidence and CI confirmation.

Existing interpreter C:/Dev/rore/agent-workflow/.venv/Scripts/python.exe provides Python, PyYAML, and jsonschema. No dependencies were installed. Direct adapter success will not be described as native hook coverage.

## Phase 4 evidence

- Installer: /root/bootstrap_install. Both skill manifests and all 140 listed entries match the released source in size and content. Configuration and policy schemas pass. Hook installation is idempotent; pre-existing AGENTS.md content is preserved.
- Real Redline reporter evidence verifies approved-only documentation exits 0 without a Work Record. README mixed with a feature requirement, CONTRACT.md, or generated runtime exits 2 and requires a Work Record.
- The documented backend-probe command omits the required Redline verdict. Initial probe blocked for that reason; retry through the installed PowerShell adapter with the explicit external interpreter and real reporter evidence exited 0 without weakening policy. Temporary probe files were cleaned. Native interception remains unverified/degraded.
- Read-only policy calibration completed successfully over 30 merged PRs. Existing contract references and Playwright paths each fired in 18/30 PRs; new harness paths naturally had no prior matches. Keep the approved rules; no automatic demotions applied. CODEOWNERS inference was inconclusive and remains a placeholder proposal.
- CI proposal is prepared for review. No workflow, branch-protection, or CODEOWNERS changes have been applied.

## Phase 5

User approved installing the proposed combined CI workflow on 2026-10-01. Branch protection and CODEOWNERS remain proposal-only. Behavior-contract enforcement remains pending evidence from the combined PR checks.

The full staged-diff reporter detected ten literal pattern definitions in the two bundled Node suppressions.yaml data files. These are not application suppressions. No exemption was added: the existing architecture-review checkpoint remains pending human result review. Scoped LF attributes preserve vendored manifest bytes on Windows; deployed shell entry points carry executable Git modes.

## Evidence

Local checker against the complete staged diff: advisory (exit 1), with no blocking workflow predicates. Reporter: exit 2 for the unsatisfied suppression checkpoint described above. This is not a passing CI claim. Package/schema/probe and mixed-documentation checks are recorded in docs/agent-workflow-bootstrap-summary.md. PR execution remains pending.

## Skill feedback (unsent)

**Affected surface:** agent-workflow bootstrap-mode.md Phase 6, release 468f1d5fa5cf856bfd45ebb4ff041bbacc714b02.

**Expected:** The documented backend probe succeeds after the prescribed installation.

**Actual:** The command omits a Redline verdict while the generated configuration requires one; the checker blocks on missing risk evidence.

**Minimal reproduction:** Bootstrap a repository with redline required, create the prescribed temporary Work Record, and run the documented adapter check without a verdict.

**Evidence:** The literal probe exited 2 for missing Redline findings. Supplying a real reporter-generated verdict made the same installed adapter exit 0.

**Suggested owner:** bootstrap-mode.md probe instructions. Include reporter preparation and pass its output to the adapter. Related documentation ambiguity: combined bootstrap names docs/agent-redline/skills while nested Redline guidance names docs/agent; this install follows the combined bootstrap.

Additional repeatable upstream defect: the combined CI template passes only changed filenames, not unified diff or per-file line counts. Thus suppression detection silently returns no findings and changed-line thresholds lack data. PR 38's first Redline run passed while the local full-diff reporter correctly surfaced literal marker definitions. Minimal repair: generate both inputs from the existing merge base and pass --diff-unified and --lines-per-file; retain all gates.

## Result review

Agent technical review: /root/bootstrap_review.

Reviewed revision: staged tree 0b30612e8b49e6d7550ee7c207725241c1ac2fa7 (adoption code in 73db5ed), followed by the four-line CI evidence correction in 2b17da3.

Verification adequacy: reviewer confirmed focused schema, byte-identity, applicability and adapter checks are adequate for harness-only adoption. Scoped LF attributes and shell executable modes closed the one integration finding. Follow-up review approved the four-line CI correction: same merge-base-to-head range, supported reporter flags, unchanged gates, no bypass. Native coverage remains degraded; corrected PR execution and human result review remain pending.

PR evidence: https://github.com/rore/minimap/pull/38. First Redline job passed but lacked diff inputs; not accepted as suppression-check evidence. Existing application test and workflow jobs were still running at inspection.

No public report submitted; public submission approval is absent.

## Final approval and activation

Approved by user 2026-10-01: "approve" for the adoption result and architecture-reviewed label. Label applied to PR 38. The existing test check passed on a03661e; combined Redline and workflow jobs executed on that PR. Activated the previously approved behaviorContracts block unchanged from the reviewed draft. Final revision checks must still pass before merge. No platform protection or CODEOWNERS changes made.

Final technical review /root/bootstrap_review confirmed activated behaviorContracts equals the approved eight-path workflow/test draft exactly, with no scope expansion. Local complete-diff reporter and checker exit 1 (advisory); no blocking predicates. The commit-order advisory is expected: this Work Record was written before implementation but committed alongside the installation.
