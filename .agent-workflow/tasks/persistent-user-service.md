<!-- agent-workflow:start -->
**Outcome:** Minimap can run independently of agent application lifetime as a per-user service on Windows and Linux.
**Target:** Minimap packaged runtime and both skill lifecycle interfaces.
**Scope:** Optional stable user runtime installation; Windows Scheduled Task and Linux user systemd integration; lifecycle routing, update/rollback, docs and isolated regression tests.
**Constraints:** Preserve portable mode, same-user permissions, loopback binding, compatibility/ownership checks, existing data and settings. No live installation, restart, global configuration, administrator privileges or Linux lingering. No unrelated user-file changes.
**Completion criteria:** Both skills use one managed runtime; lifecycle commands respect OS ownership; stop remains stopped; startup failure is observable; upgrades retain rollback; isolated tests cover both platforms, compatibility, failure and data preservation; independent review and CI pass before merge. Native integration evidence is distinguished from mocked tests.
**Requirement baseline:**
{"source":"user-2026-10-29","outcome":"Minimap can run independently of agent application lifetime as a per-user service on Windows and Linux.","scope":"Optional stable user runtime installation; Windows Scheduled Task and Linux user systemd integration; lifecycle routing, update/rollback, docs and isolated regression tests.","constraints":"Preserve portable mode, same-user permissions, loopback binding, compatibility/ownership checks, existing data and settings. No live installation, restart, global configuration, administrator privileges or Linux lingering. No unrelated user-file changes.","completion_criteria":"Both skills use one managed runtime; lifecycle commands respect OS ownership; stop remains stopped; startup failure is observable; upgrades retain rollback; isolated tests cover both platforms, compatibility, failure and data preservation; independent review and CI pass before merge. Native integration evidence is distinguished from mocked tests."}
**Relationships:** {"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:persistent-user-service"}],"pull_requests":["https://github.com/rore/minimap/pull/74"]}
**Behavior changes:** [{"target":"repository-contract","path":"test/sync-mirrors.test.js","classification":"coverage-only","before":"Assert checked-in mirror byte identity and run sync against the shared checkout.","after":"Retain checked-in byte-identity assertions; execute sync in a temporary fixture and additionally verify both generated trees byte-for-byte.","reason":"Concurrent lifecycle tests must not lose runtime imports while the parity test deletes and recreates shared runtime directories. Same parity obligation; stronger isolated generation verification."},{"target":"repository-contract","path":"playwright/roadmap-ui.spec.js","classification":"coverage-only","before":"Expect exactly four status columns in the evolving repository roadmap.","after":"Assert column count and exact status labels against the parsed status lens domain, including empty configured values; retain mobile overflow and feature-opening checks.","reason":"Adding the active persistent-service feature introduces a fifth status. Derive expected groups from the roadmap domain without weakening grouping coverage."}]
**Risk:** High
**Complexity:** Large
**Reason:** Packaged lifecycle contracts, persistent configuration and OS process ownership affect every shared client; two platform backends require separate qualification.
**Discovery:** Existing start imports the runtime in-process; restart detaches a child but has no OS supervisor. Both skills already share the registry and API. Pallium uses a least-privilege login Scheduled Task whose wrapper waits and forwards exit status. Minimap data is separate from runtime under MINIMAP_HOME. Research found stale runtime registry without evidence proving Codex caused exit.
**Material assumptions:** User-level systemd is available on supported Linux hosts; if unavailable, explain unsupported managed setup and retain portable mode. OS-managed process lifetime must follow the actual foreground server, not a short-lived detaching launcher. Native qualification may be unavailable here; do not represent mocked command tests as live recovery proof.
**Plan:** Add shared service module under package/minimap/src and thin bundled service management script in both skills. Stage a complete stable skill/runtime installation under user home; retain previous runtime for rollback. Use native task/systemd ownership with explicit install/update/rollback/uninstall commands. Route existing start/stop/restart/status through managed mode when configured, preserving standalone behavior and existing readiness/identity/participant guards. Generate quoted platform definitions without shell interpolation of user input. Keep explicit user home, executable and port; never store arbitrary environment secrets. Synchronize runtime mirrors; update both skill docs and README. Independent plan review precedes code. Delegate bounded implementation after review; root reviews combined result and drives CI/merge. No live changes.
**Verification plan:**
- Platform definitions, escaping and command failures -> test/user-service.test.js plus offline native definition validation.
- Install/start/stop/restart/update/rollback/remove routing, identity and transactional recovery -> test/user-service.test.js fake OS state-machine tests.
- Both skill reuse, foreground lifetime and data/settings preservation -> test/user-service-lifecycle.test.js isolated Node process tests.
- Portable compatibility, race safety and mirror parity -> existing server-bootstrap, runtime-compatibility, restart-race and sync-mirrors tests; full required CI.
- Native supervision -> only explicitly isolated available environments; report untested login/crash behavior without claiming fake tests establish it.
**Plan review:** Agent technical review: /root/service_plan_review, 2026-10-29, baseline 0004546 and ae8441e plan. Approved with refinements recorded below.
**Approvals:** Approved by user 2026-10-29: "ok, so drive this feature". Additional scope approved by user 2026-10-29: "this should work on both windows and linux". Approval covers repository implementation and review/merge, not local service installation.
**Exceptions:** —
**State:** Ready for review
<!-- agent-workflow:end -->

## Implementation

2026-10-29: research complete; feature and plan recorded before code. Pending technical plan review. Branch feat/persistent-user-service; base 0004546. Existing untracked user artifacts untouched. Next: review plan, implement and qualify in isolated paths; no live changes.

2026-10-29: plan review passed; bounded implementation assigned to /root/service_implementation (Sol, high), root owns docs and integration. First code review identified participant configuration and launcher-output compatibility gaps; implementation is addressing these alongside quoting and rollback checks. Canonical feature linked through successful Pallium attachment. Linux systemd is available; no Linux Node on PATH. Workflow checker uses existing agent-workflow virtualenv read-only because default Python discovery was unavailable; no interpreter installed or changed.

## Evidence

Read-only investigation inspected packaged lifecycle scripts, registry/data behavior and Pallium's scheduled task implementation. Current live server was stale; no restart or cleanup performed.

Implementation revision 46ac0e6: Windows 45 focused regressions and isolated mirror test pass. Linux focused 45 pass plus one Windows-only skip; full Node suite 514 pass, zero failures, two platform/opt-in skips. Evidence: `.local/persistent-service-qualification/linux-full.log`; owning PR https://github.com/rore/minimap/pull/74 carries CI. Native systemd unit syntax validation and in-memory Windows Scheduler XML parsing pass. Windows cscript executed the generated Unicode/space-path wrapper with an inert Node fixture and preserved exit 7. Native registration/login/recovery remain untested; no claim of live rollout.

Test-safety incident: an implementer diagnostic omitted explicit MINIMAP_HOME/PORT and started a standalone process in a Windows sandbox home on port 4312 (PID 77436). Exact-home packaged status then reported stale/no health, including from an elevated read; no signals or uncertain shutdown were issued. No native task/unit was registered and the ordinary user data home was not modified. User informed. Subsequent diagnostics require explicit isolated homes/ports; this evidence does not establish the missing process's exit cause.

## Result review

Agent technical review: /root/service_plan_review, 2026-10-29, approves subject to full suite and CI passing.
Reviewed revision: 46ac0e657f9f25dcf56ce783ce12cb5ebd0ecc9e
Verification adequacy: independent non-implementer checked platform definitions, ownership, transaction recovery, tests and docs. Prior crash-registry and install-retry findings resolved; full local Linux suite subsequently passed. Fake-native tests do not prove login/crash supervision. CI and review-thread resolution remain before merge; local installation is not authorized by this repository result.

Recovery: branch feat/persistent-user-service, implementation committed at 46ac0e6, PR 74 draft during CI. Root owns remaining CI/merge and records final native qualification limits. No task worktree created; unrelated untracked artifacts preserved.

2026-10-29 CI follow-up: the mobile columns test assumed four statuses in the evolving roadmap; this feature adds active as a fifth. The test now checks count and exact rendered labels against the parsed status domain, including empty configured groups. Existing overflow/opening/overlay assertions remain. Focused isolated Playwright: 1 passed. Independent reviewer /root/service_plan_review approved this coverage-only correction; runtime approval at 46ac0e6 remains applicable. Full final CI required before merge.

Skill feedback trigger 3 dropped: local checker invocation initially omitted the explicit PR changed-file set; rerunning with the same complete NUL-delimited paths as CI passed all blocking predicates. This was invocation error, not an upstream defect.

## Plan review

Independent reviewer /root/service_plan_review approved the plan with required acceptance refinements: use a distinct foreground service entry (never a detaching/reuse launcher); intentional stop suppresses recovery before graceful shutdown and explicit start restores it; verify configured runtime source plus registry/live PID before mutation; stale/foreign ownership fails closed, including --replace-runtime. Serialize managed mutations. Stage updates before stopping and restore runtime, definition and prior running/stopped state on failure. Preserve data on uninstall. Reject foreign service definitions and unsafe paths. Pin the managed port. Test XML/VBS/systemd escaping and allowlist persisted settings. Native supervision must be reported unverified until exercised.

Planned tests: test/user-service.test.js (platform definitions, transaction/ownership/failure state machine) and test/user-service-lifecycle.test.js (isolated actual Node process and both skills), plus existing server-bootstrap, runtime-compatibility, restart-race and sync-mirrors suites. Ubuntu-24.04 has a running systemd user manager but no Node on its current PATH; no software installed.
