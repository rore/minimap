<!-- agent-workflow:start -->
**Outcome:** Users and agents can migrate to and update the optional shared service without confusing a skill copy or restart with runtime deployment.
**Target:** Repository lifecycle guidance and packaged skill service references.
**Scope:** Clarify AGENTS.md, README.md, package/minimap/README.md and both packaged references/server.md files. Document same-home portable migration, backup, status/stop/install/verify, explicit runtime update and older-client compatibility.
**Constraints:** Documentation only. No runtime changes, installed/global skill edits, service operations or configuration/data changes. Preserve explicit environment-change approval, fail-closed ownership and unfinished native login/crash qualification claims. Root owns live installation and canonical roadmap delivery updates.
**Completion criteria:** All five guidance surfaces consistently distinguish skill copying, managed restart and explicit runtime update; migration specifies the existing data home and safe port-conflict handling; examples match implemented script semantics; independent reviews and documentation drift/link checks pass.
**Requirement baseline:**
{"source":"user-documentation-followup-2026-10-29","outcome":"Users and agents can migrate to and update the optional shared service without confusing a skill copy or restart with runtime deployment.","scope":"Clarify AGENTS.md, README.md, package/minimap/README.md and both packaged references/server.md files. Document same-home portable migration, backup, status/stop/install/verify, explicit runtime update and older-client compatibility.","constraints":"Documentation only. No runtime changes, installed/global skill edits, service operations or configuration/data changes. Preserve explicit environment-change approval, fail-closed ownership and unfinished native login/crash qualification claims. Root owns live installation and canonical roadmap delivery updates.","completion_criteria":"All five guidance surfaces consistently distinguish skill copying, managed restart and explicit runtime update; migration specifies the existing data home and safe port-conflict handling; examples match implemented script semantics; independent reviews and documentation drift/link checks pass."}
**Relationships:** {"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:persistent-user-service"}],"pull_requests":[]}
**Risk:** High
**Complexity:** Simple
**Reason:** AGENTS.md and skill references are red-zone agent behavior/contract surfaces requiring architecture review; the coherent change only documents existing lifecycle behavior.
**Discovery:** Existing service references already distinguish copied skills from the stable runtime, but AGENTS describes restart only as stop+start and the user-facing docs omit a concrete standalone migration sequence and older-client limitations. PRs 74 and 75 delivered the service and absent-task fix; root reports native Windows installation and explicit restart verified, with login/crash recovery still unqualified.
**Material assumptions:** Current runtime preserves the configured home/port and routes managed restart to its installed release; code inspection is the authority. If proposed instructions differ from code, correct the instructions rather than changing runtime scope.
**Plan:** Establish branch and this Work Record before edits; root obtains clean-context plan review. Read relevant existing guidance and implementation defaults. Clarify managed restart/update in AGENTS, add a concise migration checklist to README and both server references, and align package README. Reuse existing script interfaces and links. Run focused drift searches, verify relative links/examples/default paths against source, and request independent result review. Leave installed-copy updates and native operations to root.
**Verification plan:** Distinguish copy/restart/update and older-client constraints -> cross-file prose review and targeted rg drift searches. Existing home defaults, command names, pinned-port and approval semantics -> source inspection and linked lifecycle tests. Relative documentation links -> local path resolution check. No live commands are run.
**Plan review:** Agent technical review: /root/service_plan_review, 2026-10-29, approved through root: same explicit home/port, inspect ownership and coordinate before stopping, distinguish invoking-skill update from installed-runtime restart, and retain native qualification limits.
**Approvals:** Approved by user 2026-10-29: "if there's something more to update, let's do that". Root's explicit delegation applies this approval to the concrete service documentation follow-up; no installed-copy or live-service changes are delegated.
**Exceptions:** —
**State:** Ready for review
<!-- agent-workflow:end -->

## Implementation

2026-10-29: Created feat/service-installation-guidance from main 0efe1af57c0c800065ce0a6881a2bf2e6c7b48d6 before documentation edits. Intended files: AGENTS.md, README.md, package/minimap/README.md, package/minimap/skills/minimap-roadmap/references/server.md and package/minimap/skills/minimap-spec-review/references/server.md. Root owns roadmap delivery evidence and installed global skill updates. Awaiting root-coordinated plan review; unrelated untracked artifacts untouched.

2026-10-29: Root relayed independent plan approval. Source inspection confirmed default homes in src/sessions.js and invoking-skill staging plus managed routing in src/user-service.js. Proceeding with existing-behavior clarifications only.

2026-10-29: Updated the five approved guidance surfaces. Added same-home migration, idle-client backup, verified/coordinate-before-stop, install and post-install checks, explicit update from the invoking skill, older-client limitations and qualification limits. Corrected the roadmap reference's blanket port-fallback wording to distinguish standalone restart from the pinned managed port. Root separately updated canonical feature delivery evidence for merged PRs 74/75 and verified native Windows installation/restart/reuse/data preservation; login/crash and Linux supervision remain unfinished. No runtime or installed-copy changes.

## Evidence

Read-only inspection confirms existing service references distinguish the stable runtime and copied skill files, but lack a concrete same-home migration sequence. No runtime/service commands or installed-copy writes performed.

2026-10-29: Local verification passed: all four relative service-guide links resolve, migration anchors exist, both service references carry matching migration/update/qualification guidance, and the existing user-service/runtime-compatibility regression test paths resolve. Compared home defaults and install/update/managed routing semantics against src/sessions.js and src/user-service.js. Targeted drift searches found no remaining blanket default-port fallback sentence or ambiguous Shared runtime replacement heading in the five edited surfaces. git diff --check passed. Runtime tests and tri-tree sync are unnecessary because runtime/scripts were unchanged; no native commands were executed.

## Result review

Agent technical review: /root/service_plan_review, 2026-10-29, approved through root after reviewing the bounded documentation diff and associated root-owned feature evidence update.
Reviewed revision: Base 0efe1af57c0c800065ce0a6881a2bf2e6c7b48d6 plus the current documentation-only working diff on feat/service-installation-guidance.
Verification adequacy: Reviewer approved same-home migration, explicit update/restart/copy distinctions, existing-client compatibility and limited native qualification claims. Applied two requested wording refinements for occupied-port refusal and standalone startup fallback. Local link/anchor, guidance parity, source-semantics and drift checks passed; runtime tests were not needed for this prose-only change.

Recovery: Branch feat/service-installation-guidance remains based on 0efe1af57c0c800065ce0a6881a2bf2e6c7b48d6 with an uncommitted documentation-only diff. Root owns review completion, generated workflow/Redline evidence, commit/CI/merge and any separately authorized installed-copy refresh. Unrelated untracked artifacts preserved.
