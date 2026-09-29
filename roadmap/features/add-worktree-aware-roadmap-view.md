---
id: add-worktree-aware-roadmap-view
title: See roadmap work across local worktrees
status: queued
priority: high
commitment: committed
labels:
  - roadmap
  - worktrees
  - visibility
---

## Summary

Make Minimap's existing roadmap view aware of local Git worktrees. Show features created or changed in sibling worktrees, including uncommitted files, without moving roadmap state into a shared management system. Keep the board familiar; reveal source differences only where needed and let the user inspect exact versions in the existing detail pane.

This is the first item in Next. Capture and review the design now; implementation has not started.

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

The default target is one card per logical feature. An unresolved status or grouping difference must not be hidden behind an arbitrary representative. Before implementation, demonstrate the compact treatment of a feature whose versions occupy different groups and decide whether a clearly labeled repeated appearance is necessary. If it is, retain distinct-feature totals and explain overlapping group counts. This bounded design decision is part of the feature, not permission to build a general comparison interface.

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

Before coding, inspect current work-reference normalization with Pallium's owner if the contract is unclear. Request a Pallium change only for a demonstrated shared-contract gap; Minimap owns presentation and source discovery.

Resolve these concrete choices in a small implementation sketch using two ordinary features and one divergent feature:

1. Compact card placement and matching-source selection across conflicting statuses/groups, with honest counts.
2. Conservative logical-identity and equivalence rules, including ID collisions and unchanged inherited copies.
3. Mixed board ordering, unlisted-file disclosure, and incompatible configuration fallback.

Use the sketch to keep the first implementation bounded. Do not turn these questions into a new assignment or synchronization system.

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

Direction agreed with the user after conceptual review and external research: retain files as canonical and make the view worktree-aware. Astra is a reviewer and sounding board; Minimap's owner drives the design. This feature records intended behavior and bounded decisions still needed before implementation, not a claim that source reconciliation is already solved.

Astra reviewed this draft on 2026-09-29. Both anchored findings were incorporated: ambiguous participant attribution for colliding item IDs, and checkout-context validation when a worktree path is reused. The three implementation-sketch decisions above remain intentionally open.
