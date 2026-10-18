<!-- agent-workflow:start -->
**Outcome:** Keep Minimap service requests and UI interactions responsive while slow roadmap, worktree, participant, and related-work operations run.
**Target:** Minimap server and browser UI in the isolated performance checkout.
**Scope:** Audit request and rendering paths, measure blocking and contention, fix demonstrated bottlenecks with bounded asynchronous work and existing caches, and add focused regressions.
**Constraints:** Preserve source identity, write safety, data freshness and explicit partial coverage. No live service or installed environment changes, new dependencies, arbitrary cap increases, or blanket async rewrites.
**Completion criteria:** Slow work does not unnecessarily delay independent service requests or UI interactions; before/after measurements and focused regression coverage demonstrate each fix; List and Columns are visually checked; remaining limits are explicitly recorded.
**Requirement baseline:**
{"source":"user:6dcc4e7b-64b8-43a7-9ef5-236c4a18e57b","outcome":"Keep Minimap service requests and UI interactions responsive while slow roadmap, worktree, participant, and related-work operations run.","scope":"Audit request and rendering paths, measure blocking and contention, fix demonstrated bottlenecks with bounded asynchronous work and existing caches, and add focused regressions.","constraints":"Preserve source identity, write safety, data freshness and explicit partial coverage. No live service or installed environment changes, new dependencies, arbitrary cap increases, or blanket async rewrites.","completion_criteria":"Slow work does not unnecessarily delay independent service requests or UI interactions; before/after measurements and focused regression coverage demonstrate each fix; List and Columns are visually checked; remaining limits are explicitly recorded."}
**Relationships:** {"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:nonblocking-performance-pass"}],"pull_requests":[]}
**Risk:** Elevated
**Complexity:** Moderate
**Reason:** Provisional gray server/UI performance scope. Reclassify after discovery and before implementation if safety contracts or protected browser tests change.
**Discovery:** Pending bounded backend and UI inspection against merged main c262c719dd5b141948aa9e266ec4f84e4cd1256e. Previous PR53 optimized Git child concurrency but did not establish whole-service responsiveness.
**Material assumptions:** Async I/O alone does not guarantee responsiveness; measure event-loop delay, CPU parsing/rendering, serialization and request dependency waits. Preserve existing limits until evidence supports a separate change.
**Plan:** First identify and reproduce dominant blocking paths; record concrete file targets and smallest fixes, classify final scope, then obtain independent plan review before code edits.
**Verification plan:** Isolated synthetic repositories and packaged test services; concurrent slow/fast request probes; cold/warm cache and refresh observations; browser interaction and long-task measurements in List/Columns; targeted regression and existing safety suites.
**Plan review:** Pending discovery; implementation not released.
**Approvals:** User requested 2026-10-18: "let's do a performance pass to see that everything is unblocking and all work that can take time is async and not blocking the service and ui". No live environment changes authorized.
**State:** Blocked
<!-- agent-workflow:end -->

## Recovery

Discovery is authorized and active; implementation awaits a concrete reviewed plan. Owning checkout: `C:/Dev/rore/minimap/.local/preserve-board-view-state`, branch `feat/nonblocking-performance-pass`. Do not modify the user's main checkout or live Minimap server.
