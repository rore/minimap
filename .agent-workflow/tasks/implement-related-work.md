<!-- agent-workflow:start -->
**Outcome:** Show authoritative related Work Records and recorded PR links in feature detail without blocking ordinary Minimap use.

**Target:** Minimap packaged server and UI.

**Scope:** Implement roadmap/features/show-feature-related-work.md using the agreed Workflow-owned reader; add bounded discovery, refresh, detail UI, regression/performance/visual coverage and documentation.

**Constraints:** Files remain authoritative; no inferred relationships or status, viewed-repository code execution, mandatory Python, live service/install changes, database or independent scheduler. Preserve checkout provenance and unsaved edits. Shared format agreement precedes product implementation.

**Completion criteria:** All seven canonical feature Done When criteria pass, including genuine Workflow output, external mutation convergence, exact identity, bounded nonblocking performance, and rendered List/Columns desktop/narrow verification.

**Requirement baseline:**
{"source":"roadmap/features/show-feature-related-work.md@40317a8f1517dbc0b89b667dbfd7ee8140c731bc","outcome":"Show authoritative related Work Records and recorded PR links in feature detail without blocking ordinary Minimap use.","scope":"Implement roadmap/features/show-feature-related-work.md using the agreed Workflow-owned reader; add bounded discovery, refresh, detail UI, regression/performance/visual coverage and documentation.","constraints":"Files remain authoritative; no inferred relationships or status, viewed-repository code execution, mandatory Python, live service/install changes, database or independent scheduler. Preserve checkout provenance and unsaved edits. Shared format agreement precedes product implementation.","completion_criteria":"All seven canonical feature Done When criteria pass, including genuine Workflow output, external mutation convergence, exact identity, bounded nonblocking performance, and rendered List/Columns desktop/narrow verification."}

**Risk:** High

**Complexity:** Large

**Reason:** Published contract and untrusted source-path boundaries require architecture review; coordinated Workflow producer and Minimap consumer have independent deliverables.

**Discovery:** Initial contract/package inspection preceded this record; no product edits occurred. Workflow uses PyYAML safe_load and configurable workRecord.local.taskPath; Minimap has no general YAML parser. Existing refresh/source-bound/UI discovery is delegated read-only and pending.

**Material assumptions:** Workflow will provide a trusted data-only Node decoder and validated configured locator. If unsupported, return to joint contract review; do not implement a second grammar or execute inspected code. Parser compatibility requires explicit fixtures, not a claim of complete PyYAML equivalence.

**Plan:** Agree one Relationships JSON grammar and reader/capture flow with Workflow and Astra. Inspect existing refresh and source confinement; measure baseline and set numeric budgets before coding. Obtain clean-context implementation plan review. Implement the smallest consumer, then early rendered review and full bounded acceptance. Exact implementation plan remains pending discovery and shared review.

**Verification plan:** Map the canonical seven criteria to shared decoder fixtures, unit/API/running-server E2E, large-corpus latency/I/O measurements and actual rendered screenshots. Establish numerical budgets before product edits. Run workflow checks, mirror synchronization and doc drift checks before delivery. Tests not yet run.

**Plan review:** Pending shared contract and clean-context implementation plan review.

**Approvals:** Human authorization verified in Astra chat 01a07bef-18c8-71b2-89ab-c0cbe91e73ad, message 01a1493a-c390-78f3-bd9b-212e89384d36: "ok, so coordinate with the workflow and minimap managers to start this. agree on the shared format first, and keep the implementation simple." This authorizes coordinated development; no live environment changes. Implementation-specific review remains pending.

**Exceptions:** —

**State:** Blocked
<!-- agent-workflow:end -->

Source: roadmap/features/show-feature-related-work.md. Exact Minimap references: scope_ref `roadmap:v1:git:github.com/rore/minimap#roadmap`, local_ref `item:v1:show-feature-related-work`.

## Implementation

2026-10-17: Created isolated feat/implement-related-work from 40317a8f1517dbc0b89b667dbfd7ee8140c731bc. Blocked means product implementation awaits shared contract review; independent discovery continues. Canonical planning PR #48 is already merged; its completed documentation-only record is not reused as implementation approval.

Recommendation sent to Workflow manager: pinned yaml 2.9.1 (ISC, no dependencies, Node >=14.6), official npm whole-package unpacked size 686,297 bytes. This is not a measured runtime bundle size. Alternative js-yaml 5.5.0: MIT, 1,626,579 bytes with argparse dependency. No package installed. Preserve license/version and test YAML compatibility (duplicates, aliases/merge, booleans and unsupported tags). Workflow owns decoder; Minimap owns containment/index/cache/paging. No extra CLI or export.

Recovery: shared proposal currently at Workflow commit 4ad1a8890186d55f8eb339ad0d11599b75724dbf is not agreed. Workflow manager will consolidate revised sample, capture edit and decoder recommendation for Astra. Next: incorporate review, discovery pointers, concrete budgets and reviewed implementation plan before code.

## Discovery evidence

Read-only agent `/root/related_work_discovery` inspected baseline 40317a8; no edits/tests. Reuse `src/roadmap-snapshots.js:createRoadmapSnapshotCoordinator` for coalescing, subscriber cancellation, deadlines/concurrency/byte bounds and invalidation. Related reads need separate scope from board snapshots. `server.js` already handles This via `readThisSnapshot` and Across via `handleWorktreeWorkspace`.

`src/source-bound.js:requirePathInSource` is the containment seam; records must stay within the admitted checkout, independently of roadmap root. Worktree versions already carry repoRoot/sourceKey. `ui/app.js:renderPreview` and `#item-preview` are the read-only insertion seam; avoid `renderItem` for background updates because it resets drafts. Reuse `beginItemLoad`/`itemIntentIsCurrent` guards and selectedSource/sourceVersion identity.

Reuse `test/roadmap-performance.test.js` isolated temporary server/repo harness and existing snapshot unit/HTTP/browser tests. Baseline measurements must precede runtime edits; use representative synthetic records, concurrent health/board/detail reads and explicit cold/incremental cases. Capture latency distributions, freshness, enumeration/body-read/Git counts, unchanged-file reads and peak scans. No baseline measured or budget finalized yet.
