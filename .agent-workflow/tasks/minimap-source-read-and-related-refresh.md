# Preserve workspace read budgets and related-work pagination on refresh

<!-- agent-workflow:start -->
**Outcome:**
Keep the source-bound workspace route's request deadline active through pre-handler identity validation, and retain already loaded related-work pages on a same-generation refresh without duplicate or stale rows.

**Target:**
Minimap server and roadmap UI in the package source tree.

**Scope:**
`package/minimap/server.js` with a focused source-bound workspace deadline regression; `package/minimap/ui/app.js` with one related-work pagination refresh regression in `playwright/related-work.spec.js`; generated runtime mirrors only through `node scripts/sync-mirrors.mjs`.

**Constraints:**
Keep source-bound validation, cancellation and deadline assertions intact; preserve correct pagination after refreshed results; do not edit generated mirrors by hand, start installed servers, alter live data, or change unrelated roadmap behavior.

**Completion criteria:**
1. `/api/source/workspace` uses one request budget across source-context validation and workspace handling; unbound `/api/workspace` retains its own handler-owned budget.
2. Refreshing after loading multiple related-work pages in the same generation retains the loaded rows and cursor, with no duplicates; More still reaches the final row.
3. Runtime mirrors remain synchronized; behavior tests pass when the shared application-test slot is available.

**Requirement baseline:**
{"source":"work-record-initial","outcome":"Preserve source-bound workspace deadline coverage and same-generation related-work pagination across refresh.","scope":"Minimap package server/UI, focused server and Playwright regressions, generated mirrors.","constraints":"Preserve safety checks and refreshed content correctness; do not modify live installs/server or hand-edit mirrors.","completion_criteria":"Source workspace validation is bounded; refreshed loaded pages remain unique and usable; mirrors and applicable tests pass."}

**Relationships:**
{"schema_version":1,"sources":null,"pull_requests":[]}

**Risk:**
High

**Complexity:**
Moderate

**Reason:**
The Playwright regression path is an explicit Redline acceptance-contract zone with the architecture-review checkpoint. The work covers two independent behaviors in server and UI code and requires separate regression assertions.

**Discovery:**
At pinned upstream `origin/main` `5072122c7353f7519c1aeda4fcac072682b55b26`, `handleApi` rewrites `/api/source/workspace` to `/api/workspace` before comparing against the unrevised path; therefore the outer budget is null during `validateBoundRequest`. `handleWorkspace` then creates its own later budget. In the UI, `refreshVisibleRoadmap` requests a fresh related-work page; successful non-append responses replace all `records` and `nextOffset` even when generation is unchanged. The existing Playwright case already loads 20, then 40, then 46 records, providing a direct regression seam.

**Material assumptions:**
- A delayed Git identity read is suitable to prove the outer source-workspace budget covers pre-handler validation. Use the existing deadline fixture's process-local child-process interception and assert the aliased route returns its deadline response before that delay is released. If the fixture cannot distinguish the outer budget from the handler's inner budget, add a narrower deterministic source-validation seam rather than accepting ambiguous evidence.
- Same generation means the already loaded later pages remain valid, but the refreshed first-page records must replace their prior counterparts. On merge, deduplicate by record ID and retain the prior cursor only when the generation is unchanged. If a same-generation response can reorder or invalidate later pages, reset pagination instead and revise the expected behavior.

**Plan:**
1. Server: compare the rewritten route to `/api/workspace`, creating the outer budget before the first source validation. Make `handleWorkspace` reuse `request.minimapReadBudget` when present and leave its cleanup to `handleApi`; when unbound, keep the handler-created budget and its cleanup local.
2. Add a focused HTTP regression that delays the Git identity command during `/api/source/workspace` validation and proves the configured budget aborts that pre-handler stage. Assert unbound `/api/workspace` still has a working handler-owned deadline.
3. UI: on a successful non-append refresh, preserve later already-loaded records only when generation is unchanged; replace the first page with fresh response records, merge later rows by ID without duplicates, and retain the cursor from the same-generation loaded view. Reset normally when generation changes.
4. Extend the existing 46-record Playwright journey: load 40, return a same-generation refreshed first page with one changed first-page field, assert refreshed content is visible and the later page remains with unique IDs and More available, then load and verify all 46. Also assert a changed generation resets to its new first page.
5. Run `node scripts/sync-mirrors.mjs`; do not hand-edit runtime trees. Run focused server and Playwright checks only after the parent releases the shared test slot.

**Verification plan:**
- Delayed pre-handler identity validation for `/api/source/workspace` → bounded deadline response before release; unbound `/api/workspace` still times out under its own budget.
- Same-generation page-2 refresh → refreshed first-page data plus retained later rows, unique IDs, retained More cursor, and final 46-row result; changed generation resets.
- Changed-generation refresh → resets to the new generation's first page.
- Mirror parity → `node scripts/sync-mirrors.mjs` and `test/sync-mirrors.test.js` after slot release.

**Plan review:**
Agent technical review: `/root/simplicity_reviewer` (independent clean-context result delivered to root). Reviewed revision: `5072122c7353f7519c1aeda4fcac072682b55b26`. The reviewer approved outer-budget reuse with `handleApi` cleanup for bound requests, handler-owned cleanup for unbound requests, and same-generation pagination that replaces refreshed first-page data while preserving later unique rows and cursor. Findings incorporated; GO before implementation.

**Approvals:**
Approved by the task owner in the parent task: "Okay, so I'm not near my computer now. So please, this is like a night job for you. You should make sure you continue to drive this. Like I want to get all these things finally sorted out, done and merged. It's been taking so long. So make sure you continue to drive this and don't wait for anything from me because I won't be here. You have my approval for all that is needed for this." Timestamp is unavailable in the delegated context; none was inferred. Scope is the reviewed corrections that preserve the accepted pagination behavior, not a requirement change.

**Exceptions:**
—

<!-- Blocked | Ready to implement | Ready for review -->
**State:** Ready for review
<!-- agent-workflow:end -->

## Implementation

Implemented shared budget reuse for source-bound workspace requests and same-generation related-work pagination refresh. Added regressions for the source-bound pre-handler deadline, unbound workspace deadline, refreshed first-page content with deduplicated later rows/cursor, and generation reset. Regenerated both runtime mirrors with `node scripts/sync-mirrors.mjs`; syntax-only `node --check` and `git diff --check` passed. Focused server validation passed: `node --test test/roadmap-snapshot-deadline.test.js` → 2 passed, exit 0.

The original focused Playwright run exposed a fixture race: the same-generation refresh previously used `fresh=1`, which deliberately requests a new generation, and row count could observe the old list before the refreshed title appeared. The test now reuses the cached snapshot for the same-generation branch and waits for the refreshed title before asserting retained rows. The subsequent corrected run failed later in the changed-generation reset branch: the page remained at 20 rows after More. A reviewed passive capture then observed the later More request using the deliberately transformed prior generation (`offset=20`) and returning HTTP 409 `related_work_changed`; the DOM remained at 20 rows. It observed the fresh-reset request but did not capture its response before failure, so this supports a stale-cursor race without proving why the fresh response was not yet reflected. No production change is inferred.

The final test-only correction gives the reset response a unique `Bulk 01 reset` title, waits for the exact `fresh=1` response and its rendered title before More, and leaves the generation untouched. It preserves the changed-generation case and the 20/40/46 row assertions. The simplicity reviewer approved the exact test diff (SHA256 `1B585D077334684D7F7FD57358B73AB54F1E347C193A80F4D12507267BBC4F1E`). The one focused journey passed: 1 passed in 18.1s (24.0s total), exit 0. Source, package manifest, and ignored capture artifact hashes matched their recorded pre-run values; the temporary `node_modules` junction was removed. Logs are `C:\Dev\rore\Pallium\build\consumer-upstream-validation-20261018\minimap-related-reset-witness.{stdout,stderr}.log` and `.exit`; the earlier failing run, capture attempt, and no-tests-collected invocations remain retained separately. The ignored capture artifact remains unchanged at SHA256 `37BDF0D0D71978E0F271C4846076279FD7A50126A4D9A016B90C757769996DBB`. No full Minimap suite was run; other source/full qualification results must be assessed under the upstream repository's rules. Branch `feat/minimap-source-read-and-related-refresh`, based on pinned upstream `origin/main` `5072122c7353f7519c1aeda4fcac072682b55b26`.
