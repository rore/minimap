# Isolate legacy server tests from the developer registry

<!-- agent-workflow:start -->
**Outcome:** Legacy roadmap server tests cannot overwrite the caller's Minimap registry or affect an already running server.
**Target:** Roadmap test process setup and cleanup.
**Scope:** test/roadmap.test.js; focused test isolation regression; task-owned diagnostic artifacts.
**Constraints:** No product runtime, lifecycle scripts, server identity contract, shared registry, live server, or consumer settings changes. Preserve existing test assertions and explicit per-test homes. Reproduce only with disposable homes and ports; use packaged lifecycle scripts for added cleanup.
**Completion criteria:** Previously unscoped startup tests use a fresh test-owned home even when the caller sets MINIMAP_HOME. A subprocess regression leaves a disposable caller registry byte-identical and its running server healthy; fixture cleanup uses only its scoped packaged lifecycle. Focused tests, full unit verification and independent result review pass.
**Requirement baseline:** {"source":"work-record-initial","outcome":"Legacy roadmap server tests cannot overwrite the caller's Minimap registry or affect an already running server.","scope":"test/roadmap.test.js; focused test isolation regression; task-owned diagnostic artifacts.","constraints":"No product runtime, lifecycle scripts, server identity contract, shared registry, live server, or consumer settings changes. Preserve existing test assertions and explicit per-test homes. Reproduce only with disposable homes and ports; use packaged lifecycle scripts for added cleanup.","completion_criteria":"Previously unscoped startup tests use a fresh test-owned home even when the caller sets MINIMAP_HOME. A subprocess regression leaves a disposable caller registry byte-identical and its running server healthy; fixture cleanup uses only its scoped packaged lifecycle. Focused tests, full unit verification and independent result review pass."}
**Risk:** Elevated
**Complexity:** Moderate
**Reason:** Test startup currently affects a developer-owned server registry; isolation correctness requires live disposable-server evidence. Changes remain confined to gray test setup and regression coverage.
**Discovery:** test/roadmap.test.js directly starts servers for endpoint saves and busy-port fallback without MINIMAP_HOME; startServerOnPort likewise inherits the caller's home. Their ports correspond exactly to the diagnostic startup sequence. The screenshot harness and squash HTTP fixture explicitly used disposable homes. Forced child cleanup on Windows leaves a stale registry. This explains registry contamination, not the death of the previous canonical server.
**Material assumptions:** Node's test file runs in its own process, so replacing its inherited MINIMAP_HOME before tests safely isolates all unscoped child processes while preserving explicit per-test overrides. A subprocess regression must disprove any leak. No runtime changes are necessary.
**Plan:** Invoke agent-workflow to create this record and classify risk before code edits. Review this concrete Elevated plan. Allocate a fresh suite home before roadmap tests and always provide it to inherited child processes; scoped packaged cleanup after the suite removes that disposable registry. Preserve explicit lifecycle and signal-handling tests. Add a subprocess regression running the known previously unscoped cases with a disposable caller home containing an already-running packaged server; compare registry bytes and packaged status before and after. Preserve sanitized local diagnostic excerpts. Stop if implementation requires product lifecycle or protected acceptance-contract changes.
**Verification plan:** Caller registry unchanged and server remains healthy after legacy tests → disposable packaged server plus subprocess regression and byte comparison. All legacy startup paths inherit isolation and explicit homes remain respected → source audit and complete roadmap unit file. Existing suite obligations preserved → full node unit suite. No runtime/docs changes → final diff and drift applicability audit. Independent result reviewer assesses adequate evidence and risk.
**Plan review:** Agent technical review: ## Plan review below; accepted 70f55f7 before implementation.
**Approvals:** Not required at this risk level; bounded isolation fix authorized by task owner.
**Exceptions:** —
**State:** Ready to implement
<!-- agent-workflow:end -->

## Implementation

Planning checkpoint: isolated branch feat/test-server-isolation from d11bd657; no product or test edits yet. Current shared server will not be started, stopped or restarted.

## Evidence

Diagnostic evidence is scoped to local task artifacts and sanitized before any public delivery. Public fixtures use generic paths and dynamically allocated disposable identity.

## Recovery

Review the minimal suite-isolation plan, then implement and verify only disposable fixtures. No public push until review-ready.

## Plan review

Clean-context non-implementer inspected 70f55f7, test startup helpers, the three legacy cases, and policy. Disposition: accept Elevated plan; no red checkpoint. Suite-home inheritance covers existing helpers and future unscoped children; explicit per-test overrides remain effective. Register scoped packaged cleanup immediately after creating the home. Ensure legacy server children exit before deleting it. Regression uses only three named legacy cases to avoid recursion, checks exact caller registry bytes and packaged status, and cleans up only its disposable sentinel.
