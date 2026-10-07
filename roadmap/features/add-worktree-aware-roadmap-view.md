---
id: add-worktree-aware-roadmap-view
title: See roadmap work across local worktrees
status: done
priority: high
commitment: committed
labels:
  - roadmap
  - worktrees
  - visibility
---

## Summary

Make Minimap's existing roadmap view aware of local Git worktrees. Show features created or changed in sibling worktrees, including uncommitted files, without moving roadmap state into a shared management system. Keep the board familiar; reveal source differences only where needed and let the user inspect exact versions in the existing detail pane.

Implemented on 2026-09-30 by minimap-dev, with Minimap-manager owning design, integration, canonical roadmap updates, and visual acceptance. Astra reviewed the design and source-bound operation safety. This checkout remains the default; Across worktrees is an explicit browsing choice. Delivery remains subject to the implementation PR's required CI checks.

## Why

Parallel agents work on separate features in separate worktrees. Their roadmap edits and newly created feature files live there, while Minimap usually serves the primary checkout. Consequently the board and In play filter can miss the work the user wants to see, even when agents correctly update files and attach themselves to features.

There can be several real versions of a file-backed roadmap at once. Neither the newest file nor the furthest-progressed status is automatically authoritative. Minimap should expose these versions clearly while remaining a small view and editor over files.

## In Scope

- Discover eligible existing worktrees and read their actual roadmap files on refresh.
- Extend the existing board, both layouts, lenses, search, filters, counts, details, and participant integration to understand source versions.
- Keep ordinary features visually quiet; distinguish tree-only features, differing versions, and incomplete coverage.
- Preserve explicit single-checkout editing and existing file safety checks.
- Document the source, identity, filtering, and write-target contract with focused tests and rendered UI acceptance.

## Proposed Experience

### One compact scope control

Place a compact source control near the project title, for example `Pallium · Across worktrees`. Offer This checkout, Across worktrees, and individual eligible checkouts. Remember the chosen view per project. Avoid adding another permanent toolbar row or a separate worktree dashboard.

This checkout keeps today's behavior. Across worktrees discovers new eligible worktrees on refresh without manual registration. The source menu reveals which checkouts are included and any unreadable or incompatible sources. It must be possible to tell when the view is incomplete without opening every feature.

### Familiar cards, differences on demand

- Identical copies of the same logical feature produce one ordinary feature card and one feature count.
- A feature found only in a sibling worktree appears with a short source label. It does not need to be committed first.
- Different versions have a discreet indicator such as `2 versions`. Mere text differences are not automatically called conflicts. Incompatible visible values must be signaled without implying Git has reported a merge conflict.
- Selecting the indicator opens the existing detail pane with a source selector. Show the selected source's actual metadata and document together; do not construct a synthetic document from several files.
- Keep full paths and secondary provenance in details or the source menu, rather than filling every card with labels.

The default target is one card per logical feature. An unresolved status or grouping difference must not be hidden behind an arbitrary representative. The implementation sketch below defines limited repeated appearances for divergent groups, distinct-feature totals, and disclosure for differences within one group.

### Filtering must explain the result

Apply a complete item query to each actual version. Include the logical feature when at least one version satisfies that query. For example, a low-priority active version and a high-priority done version must not jointly satisfy active AND high priority.

Search hits and filter-dependent cards must identify and open a matching source. If the primary checkout says Done and a sibling says In progress, In play must not show an unexplained Done card. Unfinished must not hide a feature merely because another version is finished. Preserve existing In play semantics: in-progress status OR attached non-closed participants, including dormant associations; attachment is not proof of current activity.

Grouping, filter totals, and detail navigation must use the same version-aware result. Counts name what they count: distinct features versus source versions. Do not sum inherited copies or duplicate participant counts.

## Source and File Contract

### Discovery and coverage

Use Git's registered worktrees for the same common Git directory, then verify the checkout still exists and has a compatible roadmap root. Do not equate separate clones merely because their remote URLs match. Do not infer activity from branch names, file age, aliases, or worktree existence.

Read working files, including dirty tracked files and valid untracked roadmap item files. Apply the same rules to the opened checkout; it need not be the main branch or clean. Detached HEAD checkouts remain valid sources. Use existing roadmap parsing and path restrictions; discovery is not permission to scan arbitrary filesystem locations or follow unrelated paths.

A valid item file absent from its source board is not silently added to that board. Expose such files through a compact, clearly labeled read-only disclosure such as `Not on a board`, with source and membership visible. Do not mistake arbitrary Markdown files for roadmap items.

Distinguish an absent roadmap, incompatible configuration, parse error, unreadable checkout, and a worktree removed since discovery. An omitted or capped source makes coverage partial, not an empty successful result. Refresh must update source availability and preserve that distinction. A non-Git project or project without siblings continues to work normally.

### Identity and equivalence

Keep project/roadmap/item identity separate from checkout identity and exact file location. Use existing identifiers and Git evidence where sufficient; do not introduce a new ownership registry or mandatory durable attempt IDs.

Collapse versions only when they represent the same logical feature. Independently created items that collide on an ID must remain distinguishable rather than being silently merged. Define and test the conservative identity rule before implementation; ambiguous identity must be exposed.

Version equivalence includes meaningful metadata, unknown fields, and document content, not just title and status. File timestamps and branch names cannot decide equivalence or authority. Source-specific board membership, grouping, and ordering remain meaningful even when the item file is identical.

Old inherited copies are not evidence of new work. Avoid promising that Git ancestry can infer intent after every merge or squash. The first version may show differences with neutral source labels rather than guessing whether work is obsolete, completed, or a continuation. No latest-wins or most-progressed-wins policy.

### Layout and scope documents

The opened checkout may provide the display anchor for layout and configured lenses, but it is a named display choice, not an authoritative winner. Preserve each source's local board ordering. A sibling's new group or metadata value must not disappear because it is absent from the anchor configuration.

Specify how mixed freeform boards and incompatible lens configurations are displayed before implementation. Prefer a small explicit source fallback over an elaborate global ordering model. Any fallback or excluded source must remain visible as limited coverage.

Show scope.md from one explicitly named checkout. Do not merge narrative scope documents or manufacture a shared plan.

### Participants

Pallium remains responsible for participant and lifecycle semantics. Its existing feature association can span worktrees; it does not by itself establish which source version an agent is editing. Present feature-wide associations as such unless Pallium supplies exact source evidence. Never infer a source from an alias or transfer old associations to a replacement session.

Independently created items with a colliding roadmap/item ID may address the same Pallium association key. In that case, label participant attribution as ambiguous rather than assigning the combined sessions or counts to either item. Status-based In play matches remain valid; association-only inclusion is uncertain and must not be shown as confirmed for either item. Preserve access to the ambiguous association context, and do not invent replacement work references to hide the collision.

Reuse efficient batched participant queries for distinct relevant feature identities, respecting existing limits and partial-result handling. Do not query every feature separately or query completed features unnecessarily. A done copy must not prevent querying a relevant unfinished sibling. Preserve the existing explicit completed-feature query behavior needed by In play.

Recent, dormant, closed, and detached semantics stay unchanged. Board counts and details agree; missing or unavailable Pallium does not block file discovery and must not fabricate zero participants or complete coverage.

### Navigation and writes

Routes and links must retain enough source context to reopen the selected version. If that source disappears, explain its unavailability; never silently substitute another file.

Across worktrees is an aggregate browsing view. Edit, create, reorder, drag, and spec review must target a single explicit checkout using the existing flow. Even identical collapsed copies have multiple potential write targets: require a clear source choice, pin it for the editing operation, and never fan out writes or retarget after refresh.

Preserve unsaved drafts and existing concurrent-file-change checks. If the target moves, disappears, or changes externally, fail visibly without redirecting the save. Viewing a sibling never copies its state into the primary checkout. Removing a source changes visibility; it does not prove completion, delete an association, or create an archive of vanished uncommitted files.

A filesystem path alone is not sufficient source identity. Before mutation, revalidate the selected repository/roadmap and checkout context as well as the file revision using existing Git/file evidence. If a checkout was replaced at the same path or its branch context changed, preserve the draft and require explicit reopening or source confirmation. A stale review link must likewise disclose changed context rather than silently reviewing a replacement. This does not require a durable attempt registry.

## Implementation Boundaries

Reuse the current parser, API, board derivation, and detail pane. Start with the existing refresh mechanism and bounded per-source reads; avoid per-feature Git processes, a new watcher service, or a presence scheduler. Make any scan limits and inconsistent refresh snapshot visible rather than silently dropping sources.

The implementation reuses Pallium's existing canonical work-reference normalization and participant API. No new Pallium lifecycle, ownership, or assignment contract was required; Minimap owns presentation and source discovery.

The implementation sketch below resolves these concrete choices using two ordinary features and one divergent feature:

1. Compact card placement and matching-source selection across conflicting statuses/groups, with honest counts.
2. Conservative logical-identity and equivalence rules, including ID collisions and unchanged inherited copies.
3. Mixed board ordering, unlisted-file disclosure, and incompatible configuration fallback.

Use the sketch to keep the first implementation bounded. Do not turn these questions into a new assignment or synchronization system.

## Implementation Sketch — 2026-09-30

The following owner decisions replace the three open questions above. Astra reviewed the sketch; the same-group metadata and mandatory source-context clarifications below incorporate that feedback. Keep the implementation on one feature branch; no parallel product redesign.

### Cards, groups, and selection

Filter source versions first, with the complete query. Within each displayed group, coalesce matching versions of a proven logical feature into one appearance. If matching versions belong to different groups, show one appearance per applicable group with a concise versions/different-groups disclosure. The overall result count is distinct logical features; group counts are explicitly overlapping when this occurs. The card uses one actual matching version, selected deterministically: the opened checkout when it matches that group/query, otherwise the first matching source in stable discovery order. This is a display selection, never a truth or write preference; label its source whenever alternatives differ. Details list all versions and indicate which match the current query.

Example: Shared feature A is identical in all checkouts and remains one quiet card. New feature B exists only in worktree blue and has a blue source label. Feature C is queued/low in the opened checkout and in-progress/high in blue. Without filters it appears in both applicable status groups with a versions indicator and matching source labels; In play shows blue's in-progress appearance. Queued AND high matches neither C version. If only C's document differs while group and metadata agree, one card with `2 versions` is enough.

When C's versions are both in milestone S3, one coalesced card must still signal incompatible status/priority values, for example `Status differs`, with keyboard-accessible disclosure of the actual values and sources. A selected Done badge plus `2 versions` alone is insufficient. The indicator should remain concise; source/value detail belongs in the existing detail pane. Include this same-group case in fixture and screenshot acceptance.

### Identity and bounded evidence

The same ID alone is not proof of shared feature identity. For distinct checkouts, require compatible roadmap namespace and either a common ancestral item with the same ID/path or bounded evidence of an equivalent complete Git change integrated by squash. Matching item content alone is insufficient. Later edits remain source-specific versions; delete/recreate breaks continuity. Git cannot distinguish independently reproduced identical complete changes from squash integration; those changes share display identity under the accepted equivalence rule. Batch and cache Git evidence, not a subprocess per feature; do not add a persistent identity registry. Exact algorithms and conservative scan limits belong in tests and the API contract. Missing evidence, shallow history, renamed paths without proven continuity, or independent same-ID changes without complete-change equivalence stay separate and ambiguous, with no claimed participant attribution. A single-source feature needs no ancestry proof to be visible.

Compare actual parsed metadata and complete document content conservatively; retaining an extra version is safer than concealing a meaningful difference. Membership is separate from document equivalence. Source ordering and branch age do not decide which content is correct. Do not hide an older source merely because its HEAD is an ancestor.

### Layout and unlisted items

The opened checkout supplies preferred lens/group ordering. Add sibling-only group values in stable source order; deduplicate names for display without rewriting any source board. Within a combined group, traverse opened-checkout order followed by unseen sibling features in their own source order. This display traversal does not claim to preserve contradictory source orderings globally; full source order remains available through single-checkout view. Reorder and drag are disabled in Across worktrees.

Use a compact `Not on a board` disclosure for valid unlisted versions, outside regular board membership, under the same query. An item listed in one source but unlisted in another remains distinguishable in detail. Preserve and disclose missing-file board references too. Union supported lens/filter values; a source with incompatible roadmap namespace or unsupported layout configuration is explicitly excluded with a source-level reason and a direct single-checkout route, rather than silently coerced.

### Source-bound operations and coverage

The aggregate response retains complete source/version provenance and an explicit coverage result. Keep source keys separate from logical feature keys, transport IDs, and Pallium refs. Detail reads and links carry the exact source. Across worktrees has no mutation target: Edit, create, scope edit, and reorder first enter a selected single-checkout view. Validate a source-context token on subsequent mutations, alongside existing file/board/config revisions. The token uses repository and Git administrative identity plus branch context; unrelated new commits should not unnecessarily invalidate a draft. Replaced checkouts and switched branches must fail safely even at the same path. Verify every affected mutation route, including spec suggestion apply/rollback, rather than guarding only item Save. Old single-checkout clients remain compatible unless an explicit source-bound context was supplied; never let aggregate clients omit required context silently.

The new source-bound operation uses a mandatory `/api/source/...` route namespace wrapping existing handlers, so a missing token is rejected rather than treated as a legacy request. A token is a continuity check, not an authentication credential. The route inventory covers setup, item save, board, metadata order, lens order/config, scope, and source-bound spec attach/move/remove/comment/suggestion operations, including preview/apply/rollback and their reads. Verify file containment on every path accepted by those routes. Do not create a parallel ownership or authorization system. Detached HEAD sources include their observed commit context, so switching detached commits is not mistaken for an unchanged null branch. Guard observable context; do not claim detection of an identical delete/recreate event when no observable evidence differs.

Developer feasibility confirmed these seams in the existing app. Reuse item-load abort/generation handling with source-aware selection. Add a revision and atomic-write check for source-bound scope edits because the current scope save lacks one. Validate real paths for configured roadmap directories and config/board/scope files before automatic reads, including junction escape cases. Source labels must distinguish equal folder names and remain compact for long branch names.

One refresh uses a bounded source snapshot and deduplicated participant batch. If discovery, file reads, or participant data disagree or fail, show partial/changed coverage and offer refresh. Scope text is always labeled with its one source. Initial view remains This checkout; Across worktrees is an explicit remembered choice. No Git or one source preserves ordinary operation. No new background service is introduced.

### Delivery evidence

The acceptance evidence below maps the scenarios to runnable tests and actual rendered observations. Lifecycle validation uses isolated MINIMAP_HOME values. These checks establish bounded behavior; they do not claim exhaustive proof of every external filesystem or Git race.

## Out of Scope

- A central database, shared writable plan, synchronization engine, or migration away from file-backed roadmaps.
- Assignment, presence, ownership, agent scheduling, or worktree lifecycle management.
- Automatic merge, winner selection, conflict resolution, checkout creation, pruning, or cleanup.
- Remote clones, arbitrary branch-ref scanning, historical participation recovery, or a full Git history/diff dashboard.
- Aggregate drag ordering, cross-source edits, and multi-target mutations.
- Inferring completion or current work from inactivity, missing names, stale branches, or disappearing sources.

## Done When

Use generic temporary repositories and worktrees; never mutate real project roadmaps for acceptance tests.

| Scenario | Required result |
| --- | --- |
| Two agents create separate features in sibling worktrees | Both appear after refresh, including valid untracked files, without changing the primary checkout. |
| Identical inherited copies | One logical feature count and quiet cards; source selection is still explicit before writing. |
| Dirty primary checkout and dirty siblings | All actual file versions are considered; no special authority is inferred from main or cleanliness. |
| Queued/done primary and in-progress sibling | In play and Unfinished find the applicable version and reveal the reason/source. |
| Active/low in one source, done/high in another | Active AND high priority does not match; search, filters, groups, and detail navigation agree. |
| Text-only differences, conflicting statuses, and unknown metadata | Differences remain accessible; incompatible values are signaled; no synthetic merged version or lost fields. |
| New group, different membership/order, or valid unlisted item | No silent omission or invented board membership; source-relative meaning stays available. |
| Independently created colliding IDs | Documents remain distinct; shared-key participant attribution and association-only In play matches are explicitly uncertain, without invented work references. |
| Detached HEAD, branch rename, missing or removed worktree | Source identity remains safe; unavailable sources are disclosed and links/saves do not retarget. |
| Removed worktree replaced at the same path, or branch switched while editing | Revalidate source context as well as file revision; preserve the draft and require explicit source confirmation before writing. Stale review links disclose the change. |
| Missing, incompatible, malformed, capped, or unreadable source | Partial coverage is visible and distinguishable from a complete empty result. |
| Refresh while editing or external file change | Draft and selected write target are preserved; unsafe save fails visibly. |
| Recent, dormant, closed, detached, and reassigned participant sessions | Existing Pallium semantics remain correct, bounded queries are deduplicated, and details agree with counts. |
| Pallium absent, unavailable, or partial | File viewing works; uncertainty remains explicit and no source ownership is invented. |
| Many worktrees, ordinary features, and several divergent features | Both List and Columns remain readable on desktop and narrow screens, with keyboard-accessible source controls. |
| No Git repository or no sibling worktrees | Existing single-checkout behavior remains usable without extra setup. |

Inspect actual rendered screenshots of both board layouts and narrow widths. Verify source labels, difference emphasis, filter explanations, details, partial coverage, and toolbar density. HTML inspection alone is not acceptance. Check bounded discovery/query behavior with fixtures and run the repository's relevant tests, mirror synchronization, and skill-document drift checks when implementation changes the documented surface.

## Notes

Direction agreed with the user after conceptual review and external research: retain files as canonical and make the view worktree-aware. Astra served as reviewer and sounding board; Minimap's owner drove the design. The implementation exposes source differences without selecting a winner or synchronizing files.

Astra reviewed the draft on 2026-09-29 and the implementation on 2026-09-30. Review added ambiguous participant attribution, same-group metadata disclosure, mandatory source context, and checks inside shared write boundaries. Two real HTTP reproductions found and then verified fixes for a branch switch during a delayed scope save and a junction redirect during spec suggestion apply. Final bounded safety approval covers commit `6a4b33fbfffdfb46d3329c87b15a10321ee62bac`. The required CI run on the final PR head is the delivery gate.

## Acceptance Evidence — 2026-09-30

| Scenario family | Evidence |
| --- | --- |
| Separate new features, dirty and untracked copies, inherited identity, delete/re-add and colliding IDs | `test/worktree-aggregate.test.js`; generic three-checkout visual fixture. |
| Whole-version filters, In play, source-specific groups, distinct counts, unknown or differing metadata | `test/ui-worktrees.test.js`, `test/worktree-presence.test.js`, and `playwright/worktree-ui.spec.js`; filtered divergent version inspected in the browser. |
| Identical copies and line endings, text/status/priority differences | Aggregate and UI projection tests; quiet identical card and same-milestone conflict screenshots inspected. |
| New groups, different membership/order, unlisted files, missing references | Aggregate/projection tests and browser disclosure tests; visible distinct/appearance totals, Also in group cues, and expanded missing-reference details inspected. |
| Detached HEAD, branch rename, replacement at the same path, stale or missing source links | `test/source-bound-context.test.js`, `test/source-bound.test.js`, and unavailable-version browser regression. |
| Draft refresh, source choice, stale revisions, branch/config changes during requests | Source-bound HTTP browser matrix, raw/scope draft and selected-version reload tests; manual branch-switch save returned 409 and preserved the file. |
| Post-validation write races and path containment | Source-bound controlled-wait tests plus Astra's independent HTTP reproductions: delayed scope save returned 409 without a write; redirected spec apply returned 403 without modifying the outside fixture. |
| Absent, unavailable, partial or ambiguous participant evidence; lifecycle semantics | Existing Pallium adapter/count tests, worktree participant selection tests, same-ID browser regression, and disabled-provider visual observation. No new presence classification is introduced. |
| Missing, incompatible, malformed, capped or moving sources; no Git and single-checkout fallback | `test/worktree-sources.test.js`, `test/worktree-aggregate.test.js`; malformed sibling visibly excluded while other sources remained usable. |
| Desktop/narrow List and Columns, long names, many ordinary features | Browser fixture with 84 features, 10 lanes and 12 milestones; manager inspected actual 1440px and 390px screenshots, source menus, conflicting versions and partial coverage. |

Local visual evidence is retained under `artifacts/worktree-view-acceptance/`: `final-board-*`, `v3-filtered-desktop.png`, `v3-draft-refresh.png`, `final-partial-narrow.png`, and `final-missing-reference-expanded-1440.png` / `final-missing-reference-expanded-390.png`. These are acceptance artifacts, not runtime dependencies.

Discovery considers at most 16 registered sources; ancestry inspection is bounded at 500 items, with uncertainty disclosed. A generic 16-source/20-feature measurement took about 8.46 seconds and returned about 1.35 MiB before the final snapshot guard was added; this is a scale observation, not a latency guarantee. Source checks run after locks and before write promotion, but cannot atomically exclude arbitrary external Git/filesystem activity or make concurrent dirty-file reads an atomic snapshot. No scheduler, cache service, shared management database, ownership transfer, or automatic merge was added.
