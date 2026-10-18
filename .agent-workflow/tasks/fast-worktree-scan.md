<!-- agent-workflow:start -->
**Outcome:** Make real multi-worktree roadmap scans substantially faster and preserve useful in-flight scans across browser tab switches.
**Target:** Across worktree aggregation and browser refresh lifecycle.
**Scope:** Profile the real Pallium scan, remove the measured redundant or serial work without weakening identity/freshness, preserve bounded reads across temporary tab hiding, and cover both changes with regressions and visual qualification.
**Constraints:** No live deployment, installation or data changes. Preserve source confinement, identity decisions, fresh validation, cancellation for superseded scopes, bounded resource use and error recovery. No new service or dependency.
**Completion criteria:** Real Pallium and generic complex-history qualification show a substantial scan-time reduction with unchanged results; hiding and returning to a tab does not restart its scan; explicit scope changes still cancel; focused and full CI tests, rendered checks and independent review pass; PR is merged.
**Requirement baseline:** {"source":"user-request:2026-10-18:fast-worktree-scan","outcome":"Make real multi-worktree roadmap scans substantially faster and preserve useful in-flight scans across browser tab switches.","scope":"Profile the real Pallium scan, remove the measured redundant or serial work without weakening identity/freshness, preserve bounded reads across temporary tab hiding, and cover both changes with regressions and visual qualification.","constraints":"No live deployment, installation or data changes. Preserve source confinement, identity decisions, fresh validation, cancellation for superseded scopes, bounded resource use and error recovery. No new service or dependency.","completion_criteria":"Real Pallium and generic complex-history qualification show a substantial scan-time reduction with unchanged results; hiding and returning to a tab does not restart its scan; explicit scope changes still cancel; focused and full CI tests, rendered checks and independent review pass; PR is merged."}
**Relationships:** {"schema_version":1,"sources":[],"pull_requests":[]}
**Risk:** High
**Complexity:** Moderate
**Reason:** Shared Git identity/freshness implementation and documented hidden-tab cancellation behavior are affected; source guarantees must remain unchanged.
**Discovery:** Production-code read-only aggregation of Pallium took37623ms for25loaded sources and162features, with zero exclusions or identity uncertainties. Browser uses pauseWorkspaceRead on visibility hidden; it aborts the workspace subscriber and marks the displayed board stale. Previous synthetic independent histories did not represent this real Git-history cost.
**Material assumptions:** Measure actual Git/history work before choosing optimization. Temporary visibility loss is distinct from changing repository or scope. Performance claims must separate cold aggregate duration, full HTTP duration and cached reads.
**Plan:** First profile stage and Git costs in isolation and inspect all visibility/read callers. Independently review the smallest measured optimization and continuity plan before product edits. Implement root-cause improvements with generic regression fixtures, sync mirrors, update behavior docs, then qualify real and isolated workloads and both rendered layouts. Preserve hard identity/freshness guarantees and existing deadlines; do not solve this by another timeout increase.
**Verification plan:**
test: Generic complex-history regression preserving grouping and bounded Git work; freshness, source races and cancellation tests.
test: Browser hidden/resume in-flight continuity, no hidden polling, explicit scope cancellation and failure recovery; test CI verification.
manual: Actual Pallium read-only timing and result comparison; desktop/narrow List and Columns screenshots.
**Behavior changes:** []
**Plan review:** Discovery in progress; independent technical plan review required before production edits.
**Approvals:** User2026-10-18 explicitly authorizes investigation, fix, tests, review and merge without repeated approval prompts: "so fix this. 37 seconds is way too long, and switching tabs shouldn't restart the whole scan. investigate the bottleneck and drive the fix through tests, review and merge without asking me at every step." This authorization covers necessary scoped implementation and delivery; live deployment remains separate.
**State:** Ready to implement
<!-- agent-workflow:end -->

## Recovery

Isolated owner checkout: `.local/fast-worktree-scan`, branch `feat/fast-worktree-scan`, base4352c08167efbeed1304676bbf15bb2db98d6aa3. Root owns this record and canonical roadmap. Backend and UI agents are performing read-only discovery; no production edits yet. Follow user authorization through merge without another routine approval stop. Independent technical review is retained. The previous live deployment remains untouched.
