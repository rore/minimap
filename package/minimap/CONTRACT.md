# Minimap Roadmap Contract

This contract defines the **roadmap workspace** of minimap: the file convention, ownership rules, and edit constraints that humans and agents must follow when working with repo-local roadmap files.

Minimap also provides a **spec sessions workspace** for collaborative review of one arbitrary target file. Spec sessions follow a different model — they live outside the target repo, do not impose any document structure on the target file, and are governed by [`skills/minimap-spec-review/SKILL.md`](skills/minimap-spec-review/SKILL.md) and its `references/`. The deeper design lives in [`../../roadmap/features/feature-spec-sessions.md`](../../roadmap/features/feature-spec-sessions.md). The rest of this document scopes the roadmap workspace.

## What Minimap Roadmap Is

- a local roadmap and feature planning workspace stored in repo files
- a simple file convention that both humans and agents can follow
- a local UI for reading and editing those files
- a skill/instruction set for agents working with the same files

## What Minimap Roadmap Is Not

- not a hosted planning service
- not a database-backed tracker
- not a second system of record
- not a workflow engine or automation platform
- not a Jira replacement

## Canonical Rules

1. Files are canonical.
   - The UI must never maintain separate roadmap state.
   - Agents and humans must update the same files.
2. Git is the history.
   - Do not build a separate history system into minimap.
3. The package is repo-local.
   - It can be copied into any repo and run there.
4. The package stays thin.
   - Prefer simple file editing and clear ownership over more machinery.

## Roadmap Root Discovery

Use the repo root as the starting point.

- If `roadmap.config.json` exists at the repo root, read `roadmapPath` and resolve it relative to the repo root.
- If it does not exist, use `roadmap/`.
- If the configured path is missing or invalid, surface a setup error instead of guessing.

Example config:

```json
{
  "roadmapPath": "docs/roadmap"
}
```

## Linked worktree view

The board can show **This worktree** or a read-only **Across worktrees** projection. Discovery admits up to 25 registered linked Git worktrees in the opened repository's common Git directory: always the opened checkout, then up to 24 eligible siblings ranked by their last complete local HEAD reflog entry timestamp. Plain uncommitted edits do not affect ranking. Missing or malformed activity evidence sorts last; canonical path breaks ties. Ranking reads are bounded and confined to the known Git administration directory; identity admission remains authoritative. Stale or missing entries do not consume slots, and failed identity admissions are backfilled. Selection is recomputed on fresh validation; cached reads retain their selection.

A separate clone is not a sibling. A source with an incompatible roadmap location, unreadable workspace, or uncertain identity is excluded or marked as partial coverage; it is never silently represented as empty. A checkout whose branch or HEAD changes during the read invalidates the combined snapshot and requires Refresh. Same item ID, path, or content alone do not prove one logical feature. Identity requires either that the shared ancestor contains the same ID/path, or that a branch's complete repository change from that ancestor to a historical commit exactly matches a single-parent integration commit in the other checkout's history, including every changed path, file mode, and old/new Git blob. The latter recognizes newly introduced items after squash integration, including later edits; the matched added item must have the same parsed ID/path. A delete/re-add breaks both forms of continuity. Git cannot distinguish independently reproduced identical complete changes from squash integration, so these are treated as equivalent; independent item-content matches with different complete changes remain separate. Conflicting values stay source-specific. Each proven logical feature appears once in every grouping and layout. Filters evaluate versions independently, then the first matching version in the existing opened-checkout-first source order chooses the card placement, title and default content. All matching versions contribute status and conflict evidence; this display preference does not prove the latest feature edit. Board grouping retains canonical group/item traversal order at the chosen placement, and metadata grouping retains aggregate traversal order. Different board-group memberships remain inspectable in checkout-version details; missing-file board references remain visible in coverage details even under metadata lenses. Card identity uses the feature key and its first unfiltered version's board kind/group, independent of filters or grouping; known legacy placement links normalize to that identity while retaining their pinned source and unavailable-source guard. Line-ending-only differences do not produce a visual conflict, although raw file revisions remain exact for stale-write checks. Search, filters, In play, and metadata grouping evaluate each checkout version, not a fabricated merged item.

Squash evidence uses cached first-parent histories with at most 64 commits per history and 4 MiB per Git response. Merge commits can be traversed by their first-parent changes, but only single-parent commits can establish a matching integration. One aggregate permits at most 32 history loads and 8192 raw change records. Proven pairwise relationships connect versions with the same ID/path through a chain, even when a direct comparison has missing, malformed, or capped evidence; that uncertainty remains visible in partial coverage. An explicit deletion/re-add or different ancestor ID anywhere within such a chain separates every version in that contradictory chain and reports identity uncertainty. Disconnected copies stay separate. Equivalence compares committed blobs, not checkout newline formatting or whitespace-insensitive patch IDs.

Across may first show a provisional opened-checkout-only snapshot while the full scan runs. Feature totals and In play are explicitly incomplete; participant counts and details remain unknown until full identity is resolved. Same-scope Refresh retains the existing board and editor during loading. Reconciliation preserves newer view/selection changes and unsaved editor context; a failed full read retains usable provisional or last-known content with an error and Refresh retry.

In both modes, automatic roadmap reads may reuse a snapshot validated within 30 seconds. A stale snapshot remains usable while fresh validation runs; Manual Refresh always requests fresh validation. The visible board validates expired snapshots, and superseded requests are cancelled without cancelling another client's shared read. Hiding the tab preserves its already-started bounded workspace read, but starts no new automatic reads until the tab is visible. Returning to the board reuses a current snapshot; a tracked Spec mutation or interrupted validation requires fresh validation. Failed validation retains explicitly stale last-known content only within the same opened repository and read mode. External file changes become visible at the next successful validation. Cached reads never replace live source checks or exact write-revision guards. Full Across scans have a bounded 60-second request/job budget, including queue waiting; This worktree, source-open and opened-only reads keep their 30-second budgets. The scanner admits at most two regular jobs plus one reserved This/source-open/opened-only job. This reservation lets a new checkout load while two Across scans run; it does not accelerate the full scans. Freshness intervals and every source/revision check remain unchanged.

Across worktree requests may opt into `compact=1`. The `worktreeFormat: "compact-v1"` response reuses the sources table for version source contexts and feature-version indexes for group placements. The browser API expands this representation before rendering; feature identity, missing references, coverage and source guards are unchanged. The shared cache retains this compact representation for all callers. Requests without the flag receive the existing expanded response shape and share the same snapshot identity. Older servers returning expanded responses remain supported.

The source selector beside the repository heading opens immediately, reuses last-known choices, and refreshes Git discovery through `GET /api/worktree-sources` without parsing roadmaps or looking up participants. Discovery evidence is not edit context: opening a discovered checkout uses `GET /api/worktree-source-workspace` with its observed Git identity, revalidates the checkout and roadmap binding, and returns fresh context before source-bound item requests. Failed discovery retains choices with an unavailable cue; outdated responses cannot change the selected source or editor draft. A failed checkout open can be retried with Refresh or the current-source choice, using fresh discovery. Coverage distinguishes discovered checkouts, loaded roadmaps, repeated feature placements, exclusions, and participant availability. A failed board refresh retains a labeled last-known view only within the same repository and source scope.

Across does not edit board order or synchronize files. Opening an item exposes compact checkout-version controls near its title; expanded choices show full branch names, status and differences relative to the selected version, including a selected version filtered out of the board. Paths are secondary details. Switching version changes only the selected document. Edit/Raw requires explicit one-checkout confirmation. The selected version is pinned in the URL, and a missing or changed source must not silently fall back to another. Unsaved drafts cannot be silently discarded by Refresh or checkout navigation. Source-bound UI requests carry a source context checked against the live Git worktree and roadmap location; item, board, and scope writes additionally require an exact expected revision. Spec file paths in a source-bound request must stay inside that checkout. The ordinary agent CLI and unbound routes remain unchanged.

Across participant counts use one bounded feature-wide read for at most 200 unambiguous logical features. An association is not checkout-specific; ambiguous same-ID features cannot inherit one another's count or detail. Errors and overflow remain visibly incomplete, not zero.

## Related Work Records

Feature detail may show a read-only reverse lookup of local Agent Workflow Work Records. Only a supported `Relationships` declaration with an exact Minimap provider, repository/roadmap scope, and item reference links a record. `sources: []` means known no source; `sources: null`, a missing declaration, invalid or unsupported metadata, and unreadable records are unknown coverage, never inferred links or confirmed absence. Recorded state and PR URLs do not prove current work, approval, delivery, or live PR status. No backlink is written to the feature, and the lookup does not create a spec session.

This worktree reads its configured records. Across independently composes guarded reads from the unique checkout sources in the full proven feature version set, regardless of the selected document or board filters. At most four source reads run concurrently; each wave requests one 20-record page per source and never drains later pages automatically. Rows group exact task references, with every source version retained; differing titles, saved states and PR links remain inspectable, and matching summaries do not prove identical bodies. Each Open task captures its own source context, item ID, task ID and generation; a failed open never substitutes another source's body. Counts describe known unique task references with `+` until all sources finish successfully; missing, provisional or failed coverage cannot prove absence. More records reveals loaded rows before requesting each unfinished source's next page.

Discovery runs independently of board, item and draft reads; automatic validation occurs with the existing 30-second visible refresh and manual Refresh requests fresh validation. Across's 30-second first-page cache and pending requests use the complete proven source set, including checkout identities, bindings and item revisions, independently of the selected document. Switching document versions reuses that scope; changing the feature or source set cancels its obsolete reads. A failed or partial validation may show only a same-source last-good generation with a stale/partial notice. Changed checkout HEAD, roadmap binding, or Workflow config cannot inherit it. Same-generation refresh retains loaded pages and each source's cursor; changed generations replace only that source's pages. An evicted More cursor removes that source's old versions, retries its first page fresh once, preserves peers, and shows a changed-generation notice until the next fresh validation. The cache is updated after recovery, so reopening cannot resurrect removed pages. Reopening retains the first-page cache policy. Opening a record rechecks its origin source, confined path, content hash and returned task identity.

The scanner streams directory names, selects and stats at most 1,000 record paths, reads at most 64 KiB of Workflow config and 256 KiB per selected record, and caps total record input at 128 MiB. Its metadata reuse is bounded to 16 MiB across projects; the separate read snapshot retains up to 32 source indexes with the same 16 MiB bound, two active scans and a 10-second deadline. Extra or unreadable records produce partial coverage. Results show 20 records per page in Work Record filename order, which is not activity order. The lookup is local and disposable: it does not execute viewed-repository code, install a Python runtime, query a remote PR service, or maintain a second system of record.

## Canonical File Ownership

Within the resolved roadmap root:

- `board.md` owns visible groups and ordered item ids
- `scope.md` owns the current-focus narrative
- `features/*.md` owns active or committed roadmap work
- `ideas/*.md` owns parked or uncommitted roadmap ideas

Metadata fields own item classification such as lane, milestone, and status. The board traversal remains the one shared item order; metadata lenses do not create a second priority list. A metadata membership move changes that item metadata and retains its board position; moving to Unassigned removes that field rather than storing a sentinel value. Metadata ordering uses a visible neighbor as a before/after anchor in canonical board order, preserves hidden items, and must not silently move an item across freeform board groups. A neutral single `Items` board group is recommended when metadata grouping needs full cross-item prioritization.

Configured metadata group order lives at `lenses.fields.<field>.order` and is independent of board heading order.

Filters are intentionally curated. Common planning fields (`status`, `priority`, `commitment`, `kind`, `milestone`, `lane`, and `labels`) appear when they have two to eight distinct values. Add repo-specific frontmatter keys with `filters.fields`; fields configured under `lenses.fields` also remain filterable. Explicitly configured fields are not subject to the eight-value limit. `id` and `title` cannot become facets because search already covers them.

`defaultLens` is optional. An explicit board-view URL wins, including `lens=board`; otherwise a remembered grouping for this repository and This/Across mode wins, then a valid configured default, then Board. A URL with board-view controls is complete: omitted layout, query, and filters mean their defaults, rather than saved values. Unknown URL or config values fall back safely with a warning; a removed remembered grouping falls back quietly. Across defers validation of an explicit URL grouping until the full snapshot, since it may be absent from the provisional opened checkout; a newer grouping choice takes precedence.

### Board appearance

An optional `appearance` object in the opened repository's root `roadmap.config.json` controls card metadata badges and colors. It is file configuration, not a settings UI or separately persisted preference. The opened board's configuration applies to both This and Across views and both List and Columns layouts; switching repositories loads that board's configuration. Across cards use the already-selected representative version's metadata. Sibling configuration is not merged. Omission preserves existing appearance exactly.

```json
{
  "roadmapPath": "roadmap",
  "appearance": {
    "cardFields": ["status", "priority", "repo"],
    "colorTags": true,
    "tagColors": {
      "repo": {"sample-core": "blue", "sample-app": "purple"}
    },
    "cardColorBy": "repo"
  }
}
```

`cardFields` is an ordered list of scalar metadata badges on cards and in the feature Read tag row. Supported fields are `status`, `priority`, `commitment`, `milestone`, and scalar custom metadata; `id`, `title`, `kind`, and `labels` are excluded. Omitted or invalid `cardFields` uses today's defaults; `[]` intentionally hides these metadata badges. Cards omit the exact field represented by the active metadata grouping, keeping the relative order of remaining fields; freeform Board grouping omits none. This applies to default and configured badges in both layouts and both worktree modes. Changing grouping restores an otherwise enabled field. Read ignores board grouping, always keeps its separate primary combined-status block, and never duplicates `status` in the tag row; its selected-version status disclosure is unchanged. Duplicate names collapse to the first occurrence. Malformed or unsupported structural fields are dropped, but a valid custom field name is accepted even when absent from current items; absent values produce no placeholder. Explicit lists have no legacy two-custom-field cap and their nongrouping fields remain visible in dense cards. Milestone is a default core field; an explicit list must include it to enable it. Existing dense-default compression to status/priority is unchanged. Hiding a badge never changes metadata, Edit/Raw fields, filters, grouping, status calculation, source/conflict/coverage cues, or `cardColorBy`; border colors still use original metadata. Edit and Raw keep full supported metadata; title, summary, identity, kind, sessions, cues, and actions are not controlled by `cardFields`.

`tagColors` maps exact, case-sensitive field names and normalized scalar string values to `gray`, `blue`, `green`, `amber`, `red`, `purple`, or `teal`. Numbers and booleans use their existing string form. `colorTags` is a boolean that defaults to `true`; `false` suppresses custom `tagColors` on card badges and feature details. It does not suppress ordinary semantic status or commitment tones, and it does not affect `cardColorBy`, which continues to use the same `tagColors` mapping. Set `colorTags: false` and `cardColorBy` for border-only coloring; omit `cardColorBy` for tag-only coloring; the default `true` plus `cardColorBy` enables both. Invalid keys, values, colors, or unsupported types are ignored. Semantic status colors cannot be overridden. Custom colors do not affect filter controls, filtering, or Across status/version resolution.

`cardColorBy` names a supported scalar field other than `status`. It colors only the left border; the field's badge may be hidden. When valid, it replaces status stripes and active/blocked background tints with a neutral card and mapped border. Missing or unmapped values get a neutral border, never an active-status fallback. Hover, selection, and keyboard focus do not override the border; selection/focus treatment remains separate. Status text and semantic color remain unchanged. Omit or invalidate `cardColorBy` to restore existing status styling. Whole-card backgrounds are unsupported.

Validation bounds are: 64 KiB for appearance JSON, 32 `cardFields` entries, 32 `tagColors` fields, 64 values per field, and 120 characters per color-value key. An oversized appearance object is rejected as a whole; oversized lists/maps process only their bounded prefix and warn. Invalid entries are dropped while valid entries remain. Invalid `cardFields` restores defaults, while a valid empty array stays empty. Invalid `colorTags` falls back to `true` with a bounded warning. Invalid `cardColorBy` restores status styling; a valid field with no color mapping uses a neutral border. Unknown appearance properties are ignored. Field names must match `[A-Za-z][A-Za-z0-9_-]{0,63}` and cannot be `prototype`, `constructor`, or `__proto__`; lookups use the original key before CSS token normalization. Invalid data cannot inject CSS or HTML. Emit at most one concise appearance warning with at most eight detail entries. Malformed JSON retains existing configuration error handling.

## Optional live participants

Pallium integration is optional and read-only. Minimap never stores live participants or work-reference associations in roadmap files. With no explicitly configured local Pallium endpoint, normal board, item, and editing behavior makes no Pallium HTTP request. In both board modes, participant observations refresh independently through `GET /api/board/observations?snapshot=<id>`. The opaque snapshot ID selects a retained manifest for the opened repository; observations use its validated feature references and ambiguity coverage without rescanning Git or loading individual cards. Unfinished candidates precede completed candidates within the 200-reference cap. Across associations remain feature-wide, not checkout-specific. Failed observations retain the last successful counts as stale; disabled, unavailable, ambiguous, and overflow results never mean zero. Hiding the page or opening Spec suspends observation refresh and cancels its pending request; returning resumes visible refresh. Changing repository or read mode discards the previous observations. The UI adds `includeCompleted=1` only when In play can include completed statuses; ordinary observations omit completed candidates.

Legacy `GET /api/board/participant-counts` remains available. Done, shipped, superseded, cancelled, and canceled items are omitted by default; `includeCompleted=1` includes them, absent or `0` preserves the default, and other or repeated values are rejected. Legacy worktree-workspace requests retain combined participant enrichment unless `participants=0` opts out. Both paths use the bounded Pallium `POST /relay/work-refs/participant-counts`, never per-card requests. Badges mean attached, nonclosed sessions only; they do not signal execution, ownership, or item status. Completed-item board badges appear only in In play; session detail remains available on demand in the existing item panel.

In play matches normalized status `active`, `in-progress`, or `blocked`, OR a confirmed positive total of attached, nonclosed sessions, including dormant sessions. It AND-composes with search, metadata, and Unfinished in every lens and layout, persists as `inPlay=1`, and resets on Clear. Participant refresh rederives visible groups. An `ok` response to `includeCompleted=1` must echo `includeCompleted: true`; an older server that ignores the query leaves results incomplete, not complete zero. Loading, disabled, unsupported, unavailable, or partial observations retain known active, in-progress, and blocked matches and show an incomplete-results notice rather than claiming complete zero results. Association does not imply current execution.

Neutral linked-session counts include recent and dormant links. Pallium’s lifecycle appears in Session details and does not imply work on this feature or staffing. The upstream `relay-work-ref-counts/v1` response retains `participant_count` and adds `recent_participant_count`, `dormant_participant_count`, `as_of` UTC, and `recent_seconds: 86400`. Recent includes last seen at or after `as_of` minus 86400 seconds; total equals Recent plus Dormant, with origins deduplicated and alias/destination health irrelevant. Minimap validates and projects these fields, never a second cutoff. Legacy total-only responses leave classification unsupported, not all-Recent, and never cause per-card fallback requests. Board and detail are separate observations, not a shared snapshot.

Supported exact-session links lead to existing Pallium controls; Minimap performs no administration. Explicit detach removes only that origin; structural origins require producer refresh. Close retains association records but excludes the session from default participants and releases its alias. Captured History is not relabeled by detach, but there is no backfill or promise of full historical participation, capture coverage, or access.

An item's public work-reference selector is derived by Minimap and copied unchanged by the UI, CLI, and agent skill:

- `scope_ref` is `roadmap:v1:<canonical-credential-free-git-identity>#<repository-relative-roadmap-root>`, with each root segment NFC-normalized and RFC 3986 percent-encoded;
- `local_ref` is `item:v1:<item-id>`, with the item id NFC-normalized and RFC 3986 percent-encoded.

The actual Git top-level anchors the roadmap-root path, so the value is stable across worktrees and distinct for nested trackers. Unsafe or missing canonical Git identity makes the selector unavailable; Minimap does not guess from local paths or branch names. Successful empty participant results are distinct from disabled, unsupported, unreachable, timed-out, invalid, and bounded-partial lookup states.

## Board Contract

`board.md` is a simple grouped list of item ids.

Example:

```md
# Now
- feature-a
- feature-b

# v2
- feature-c

# Ideas
- idea-a
```

Rules:

- headings are freeform and chosen by the repo
- headings may represent status, milestone, release, stream, team, or any other planning model
- bullet order is canonical display order within the group
- bullet values are canonical item ids
- titles and badges come from item files, not from `board.md`

## Item Contract

Each roadmap item is a markdown file with frontmatter and markdown sections.

Required core frontmatter:

- `id`
- `title`
- `status`
- `priority`
- `commitment`

Optional common frontmatter supported by minimap v1:

- `milestone`

Required core sections expected by minimap v1:

- `Summary`
- `Why`
- `In Scope`
- `Out of Scope`
- `Done When`
- `Notes`

Additional sections are allowed. Minimap keeps them in file order and surfaces them in the structured editor when they already exist.

Example:

```md
---
id: feature-a
title: Example feature
status: queued
priority: medium
commitment: committed
milestone: v1
---

## Summary

...

## Why

...

## In Scope

...

## Out of Scope

...

## Done When

...

## Notes

...

## Decision Locks

...
```

Markdown is allowed inside every section. Minimap does not require rich-text formatting or a separate document model.

## Preservation Rules

When minimap edits an item file, it should preserve:

- unknown frontmatter keys already present in the file
- unknown markdown sections already present in the file
- item ids unless the user explicitly asks to rename them and update references

## Editor Modes

Minimap v1 supports three item-editing modes:

- `Read` for rendered markdown review of the current item
- `Edit` for structured editing of common metadata and known sections
- `Raw` for full-file editing when a repo uses richer item files

Raw edits must still parse correctly and must preserve the item id.

## Human and Agent Collaboration Model

Humans use minimap through the local UI.
Agents use minimap through the file convention and the minimap-roadmap skill.

Both operate on the same roadmap state.

That means:
- no hidden UI-only metadata
- no hidden agent-only tracker files
- no status changes only in prose if frontmatter owns the status

## Recommended v1 Boundary

Include:
- view board groups and item summaries
- read scope
- edit existing item metadata and sections
- preview item markdown before save
- edit full item markdown in raw mode
- reorder board groups

Do not assume in v1:
- database or hosted sync
- multi-user real-time collaboration
- arbitrary schema builders
- automation engine semantics tied to board headings
- rich workflow logic derived from UI state

## Package Contents

### Shared server lifecycle

Both self-contained skills share a per-home server. Live health reports runtime package version, API compatibility integer (currently 1), canonical server source path, and PID. Start may reuse different releases only when the API is compatible and effective participant settings match; unknown/incompatible health is refused without replacing the server.

Restart preflights registered/requested targets before any shutdown. By default the live version and canonical source path must match the caller's bundled runtime, and live PID/port must match the home registry. An unregistered requested-port target requires explicit replacement even when its runtime matches. In-place development edits remain routine; different copies/checkouts require `--replace-runtime`, even at the same version. The flag explicitly allows unknown, incompatible, or older replacement and interrupts all shared clients. Restarts retain per-home serialization, bindability/IPC checks, and PID-scoped failed-child cleanup; they never sweep unrelated adjacent ports. Status prints live runtime identity, not stale registry version. Installed folders must be updated using the copy-in method or checkout links; old launchers cannot be retroactively guarded, and file updates do not replace a running server.

A copy-in minimap package should include:

- app/server files (shared by both workspaces)
- UI files (shared by both workspaces)
- roadmap parsing and save logic
- spec-session store, anchoring, comments, and suggestions logic
- `skills/minimap-roadmap/SKILL.md` and `skills/minimap-spec-review/SKILL.md`
- starter roadmap templates
- host-repo adoption notes
