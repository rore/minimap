<!-- agent-workflow:start -->
**Outcome:** Across worktrees shows linked tasks from all loaded versions of the proven feature, without duplicate task rows or losing source-specific records.
**Target:** Minimap feature detail Linked tasks.
**Scope:** Browser task-read composition, source-bound API read support, related-task rendering/caches/pagination, regression tests, canonical documentation and generated runtime mirrors.
**Constraints:** Reuse guarded endpoints and existing caches; bounded asynchronous reads; no repository scans beyond loaded proven feature sources, no inferred links, no merged conflicting task states, no changes to Pallium task data or installation configuration.
**Completion criteria:** Hermes opened from main shows its sibling task records and recorded PR links; task opens read the correct source; duplicate copies do not multiply rows; missing sources and pagination never imply confirmed zero; filters, version switching and reopen retain correct data. Tests, independent review, CI, merge and authorized local update complete.
**Requirement baseline:**
{"source":"user:so-again-fix","outcome":"Across worktrees shows linked tasks from all loaded versions of the proven feature, without duplicate task rows or losing source-specific records.","scope":"Browser task-read composition, source-bound API read support, related-task rendering/caches/pagination, regression tests, canonical documentation and generated runtime mirrors.","constraints":"Reuse guarded endpoints and existing caches; bounded asynchronous reads; no repository scans beyond loaded proven feature sources, no inferred links, no merged conflicting task states, no changes to Pallium task data or installation configuration.","completion_criteria":"Hermes opened from main shows its sibling task records and recorded PR links; task opens read the correct source; duplicate copies do not multiply rows; missing sources and pagination never imply confirmed zero; filters, version switching and reopen retain correct data. Tests, independent review, CI, merge and authorized local update complete."}
**Relationships:**
{"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:show-feature-related-work"}],"pull_requests":[]}
**Risk:** High
**Complexity:** Moderate
**Reason:** Source-specific task reads, canonical behavior contract and browser safety acceptance change; cache, paging and record-opening provenance must remain correct.
**Discovery:** The board now consolidates feature placements but Linked tasks still reads only the selected document checkout. Main has no explicit Hermes task links; sibling hermes-production-slice4 has PR324, hermes-native-qualification has PR328 and hermes-history-slice3 has PR322. Existing related-work endpoints validate source identity, generation, path and hash; reuse them rather than weaken those guards.
**Material assumptions:** Loaded feature versions are the existing Git-proven source set. Task identity is scoped to the same feature/repository; divergent copies must remain inspectable rather than invent a newest copy. Revisit design if the current record contract cannot support safe deduplication.
**Plan:** Invoke agent-workflow and classify before code edits. Review a bounded client composition design using unique loaded feature sources and existing guarded reads. Preserve individual generation/cursor/source per record, cache exact combined scope independently of selected document, disclose incomplete reads, and keep This worktree unchanged. Implement focused regressions, contract/prose and mirrors, qualify real Pallium UI and concurrent responsiveness, obtain independent result review and full CI, merge and update local service.
**Verification plan:** Main-empty/sibling-linked, duplicate/divergent records, pagination, stale source and cancellation -> unit and browser regressions. Cached reopen/version switching and bounded concurrency -> instrumented browser/unit assertions. Hermes records and correct task opens -> real Pallium List/Columns visual validation. Wider safety -> required full CI.
**Plan review:** Pending clean-context technical review before implementation.
**Approvals:** Approved by user 2026-10-21: "so again, fix". Prior standing user direction authorizes driving fixes through review, merge and local service update without repeated approval requests.
**Exceptions:** —
**State:** Ready to implement
<!-- agent-workflow:end -->

## Implementation
Discovery only; isolated feat/across-linked-tasks from60ed5a8. Root owns canonical feature note in this task checkout, publication and live rollout. Worker owns implementation after plan review. No user configuration or Pallium records changed.

## Checkpoint: architecture-review
Combine read-only task results from existing proven sources with exact per-source provenance. Source guards, record hash checks, API deadlines and existing backend caches remain authoritative. No write operation or migration is introduced.

## Participation
Root attached exact provider-resolved show-feature-related-work reference through Pallium; remove this task's explicit association at completion. Other existing associations are outside this task.
