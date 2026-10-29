<!-- agent-workflow:start -->
**Outcome:** Windows managed installation recognizes an absent Scheduled Task without suppressing genuine Scheduler query failures.
**Target:** Shared packaged user-service Windows native query.
**Scope:** Replace named-task absence probing with exact-name filtering of a successful root-folder task enumeration; add native read-only and injected regressions; synchronize bundled runtime mirrors.
**Constraints:** No live service installation, registration, enablement, start, stop or data/configuration changes. Preserve ownership checks, SID normalization and existing task operations. Root owns authorized local installation.
**Completion criteria:** A unique absent task returns null with successful native PowerShell exit; query failures still reject; existing ownership and lifecycle tests pass; runtime mirrors match; independent review precedes delivery.
**Requirement baseline:**
{"source":"user-authorized-local-install-blocker-2026-10-29","outcome":"Windows managed installation recognizes an absent Scheduled Task without suppressing genuine Scheduler query failures.","scope":"Replace named-task absence probing with exact-name filtering of a successful root-folder task enumeration; add native read-only and injected regressions; synchronize bundled runtime mirrors.","constraints":"No live service installation, registration, enablement, start, stop or data/configuration changes. Preserve ownership checks, SID normalization and existing task operations. Root owns authorized local installation.","completion_criteria":"A unique absent task returns null with successful native PowerShell exit; query failures still reject; existing ownership and lifecycle tests pass; runtime mirrors match; independent review precedes delivery."}
**Relationships:** {"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:persistent-user-service"}],"pull_requests":[]}
**Risk:** Elevated
**Complexity:** Simple
**Reason:** Gray shared lifecycle module and tests affect installation preflight; the change is a single read-only query with no modification to ownership or persistent-state rules. Runtime mirrors are generated watch paths.
**Discovery:** Authorized local installation failed before runtime/task creation because Get-ScheduledTask with a missing exact TaskName exits PowerShell 1 despite SilentlyContinue. Existing fake-native tests bypassed the actual missing-task exit status.
**Material assumptions:** Enumerating the root Scheduled Task folder succeeds for the same user and allows absence to be represented by an empty exact-name filter; native read-only regression will disprove this before further work.
**Plan:** First establish branch and Work Record. Root arranges clean-context plan review. Add a Windows-only read-only regression with a unique UUID task name and injected error-propagation assertion. Demonstrate the native regression fails before changing the query. Enumerate root tasks with ErrorAction Stop and filter TaskName using literal equality. Preserve the rest of the query. Sync runtime mirrors, run native and focused regressions, and request root review before any commit or push.
**Verification plan:** Unique absent-task native query and genuine query-error propagation -> test/user-service.test.js. Existing Windows identity/lifecycle/configuration safeguards -> user-service, user-service-lifecycle, server-bootstrap, runtime-compatibility and restart-race tests. Byte identity -> test/sync-mirrors.test.js. No native mutations are permitted.
**Plan review:** Agent technical review: /root/service_plan_review, 2026-10-29, approved bounded enumeration/filter plan through root; preserve terminating native/access errors and SID ownership.
**Approvals:** Repository fix authorized by user installation request and parent delegation; live installation remains exclusively root-owned.
**Exceptions:** —
**State:** Ready for review
<!-- agent-workflow:end -->

## Implementation

2026-10-29: Created feat/windows-service-absent-task-query from current main before implementation. Intended source changes are package/minimap/src/user-service.js and test/user-service.test.js, plus generated runtime mirrors. Existing untracked user artifacts are untouched. Awaiting root-coordinated plan review before code/test edits.

2026-10-29: Root relayed independent plan approval from /root/service_plan_review. Proceeding with native absent-task regression first, then the minimal query change and focused verification.

2026-10-29: Added native Windows unique-UUID absence query plus injected Scheduler-error propagation regression. Before the fix, the native test failed with PowerShell exit 1 and no stdout; the injected error test passed. Replaced only the named-task probe with successful root-folder enumeration and literal TaskName equality, retaining terminating errors, identity translation and returned ownership fields. No native mutations performed.

## Evidence

Parent reports the actual native absent-task query failed with PowerShell exit 1 before any installed task/runtime was created. Real-home backup and stale-registry cleanup were performed by root under existing installation authority; this agent performs no installation actions.

2026-10-29: Red/green native regression confirmed: old query failed with PowerShell exit 1; fixed query returned null with exit 0. Targeted native/SID/error tests passed 3/3. Focused Windows verification passed 48/48 across user-service, user-service-lifecycle, server-bootstrap, runtime-compatibility, restart-race and sync-mirrors suites. The native missing-task regression uses a unique UUID and performs no registration. All server fixtures use private homes/ports and fake native mutations. Generated copies synchronized; git diff --check passed.

Workflow validation using the existing external Python interpreter accepted the Work Record fields, classification and plan review. Its run blocked on missing generated Redline verdict evidence, which root/CI must provide before delivery; no policy or checker changes were made.

## Result review

Agent technical review: /root/service_plan_review, 2026-10-29, approved by root relay after inspecting the bounded current diff.
Reviewed revision: base 6b8643557def8be815784ab465b6174f32635a75 plus the current query-only patch, its two generated copies and focused test additions on feat/windows-service-absent-task-query.
Verification adequacy: native read-only Windows regression reproduced the reported exit-status failure before the change and passed afterward; genuine Scheduler errors still reject, existing SID/ownership behavior remains covered, and all 48 focused regressions passed. This does not establish successful native installation or supervision; root owns the authorized installation retry.

Recovery: No commits or pushes. Branch feat/windows-service-absent-task-query remains at base 6b8643557def8be815784ab465b6174f32635a75 with the reviewed bounded working diff. Root owns generated Redline evidence, commit/CI/delivery and local installation. Existing unrelated untracked artifacts are untouched.
