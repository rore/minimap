<!-- agent-workflow:start -->
**Outcome:** Minimap can run independently of agent application lifetime as a per-user service on Windows and Linux.
**Target:** Minimap packaged runtime and both skill lifecycle interfaces.
**Scope:** Optional stable user runtime installation; Windows Scheduled Task and Linux user systemd integration; lifecycle routing, update/rollback, docs and isolated regression tests.
**Constraints:** Preserve portable mode, same-user permissions, loopback binding, compatibility/ownership checks, existing data and settings. No live installation, restart, global configuration, administrator privileges or Linux lingering. No unrelated user-file changes.
**Completion criteria:** Both skills use one managed runtime; lifecycle commands respect OS ownership; stop remains stopped; startup failure is observable; upgrades retain rollback; isolated tests cover both platforms, compatibility, failure and data preservation; independent review and CI pass before merge. Native integration evidence is distinguished from mocked tests.
**Requirement baseline:**
{"source":"user-2026-10-29","outcome":"Minimap can run independently of agent application lifetime as a per-user service on Windows and Linux.","scope":"Optional stable user runtime installation; Windows Scheduled Task and Linux user systemd integration; lifecycle routing, update/rollback, docs and isolated regression tests.","constraints":"Preserve portable mode, same-user permissions, loopback binding, compatibility/ownership checks, existing data and settings. No live installation, restart, global configuration, administrator privileges or Linux lingering. No unrelated user-file changes.","completion_criteria":"Both skills use one managed runtime; lifecycle commands respect OS ownership; stop remains stopped; startup failure is observable; upgrades retain rollback; isolated tests cover both platforms, compatibility, failure and data preservation; independent review and CI pass before merge. Native integration evidence is distinguished from mocked tests."}
**Relationships:** {"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:persistent-user-service"}],"pull_requests":[]}
**Risk:** High
**Complexity:** Large
**Reason:** Packaged lifecycle contracts, persistent configuration and OS process ownership affect every shared client; two platform backends require separate qualification.
**Discovery:** Existing start imports the runtime in-process; restart detaches a child but has no OS supervisor. Both skills already share the registry and API. Pallium uses a least-privilege login Scheduled Task whose wrapper waits and forwards exit status. Minimap data is separate from runtime under MINIMAP_HOME. Research found stale runtime registry without evidence proving Codex caused exit.
**Material assumptions:** User-level systemd is available on supported Linux hosts; if unavailable, explain unsupported managed setup and retain portable mode. OS-managed process lifetime must follow the actual foreground server, not a short-lived detaching launcher. Native qualification may be unavailable here; do not represent mocked command tests as live recovery proof.
**Plan:** Add shared service module under package/minimap/src and thin bundled service management script in both skills. Stage a complete stable skill/runtime installation under user home; retain previous runtime for rollback. Use native task/systemd ownership with explicit install/update/rollback/uninstall commands. Route existing start/stop/restart/status through managed mode when configured, preserving standalone behavior and existing readiness/identity/participant guards. Generate quoted platform definitions without shell interpolation of user input. Keep explicit user home, executable and port; never store arbitrary environment secrets. Synchronize runtime mirrors; update both skill docs and README. Independent plan review precedes code. Delegate bounded implementation after review; root reviews combined result and drives CI/merge. No live changes.
**Verification plan:** Unit tests for Windows task/VBS and Linux unit generation, escaping and command failures; fake OS runner integration for install/start/stop/restart/update/rollback/remove routing and transactional recovery; isolated real Node lifecycle smoke for both skill reuse, data/settings preservation and process ownership checks; existing runtime/restart/mirror regressions; full required CI; native checks only in explicitly isolated available environments, with untested platform behavior reported.
**Plan review:** Pending clean-context technical review; implementation not started.
**Approvals:** Approved by user 2026-10-29: "ok, so drive this feature". Additional scope approved by user 2026-10-29: "this should work on both windows and linux". Approval covers repository implementation and review/merge, not local service installation.
**Exceptions:** —
**State:** Blocked
<!-- agent-workflow:end -->

## Implementation

2026-10-29: research complete; feature and plan recorded before code. Pending technical plan review. Branch feat/persistent-user-service; base 0004546. Existing untracked user artifacts untouched. Next: review plan, implement and qualify in isolated paths; no live changes.

## Evidence

Read-only investigation inspected packaged lifecycle scripts, registry/data behavior and Pallium's scheduled task implementation. Current live server was stale; no restart or cleanup performed.
