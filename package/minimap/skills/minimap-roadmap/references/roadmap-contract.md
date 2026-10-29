# Roadmap Contract

## Discovery

1. Check for `roadmap.config.json` at the repo root.
2. If it exists, read `roadmapPath` and resolve it relative to the repo root.
3. If it does not exist, use `roadmap/`.
4. Do not guess alternate paths when the configured location is missing.

An optional top-level `defaultLens` in `roadmap.config.json` selects the initial metadata grouping when no repository/mode view is remembered. An explicit board-view URL wins, including `lens=board`; otherwise a remembered grouping wins, then a valid `defaultLens`, then Board. A URL with board-view controls treats omitted layout, query, and filters as defaults rather than saved values. Unknown URL or configured values fall back safely with a warning; removed remembered groupings fall back quietly. Across validates an explicit URL grouping after the full snapshot, since it may be absent from the provisional opened checkout; a newer grouping choice wins.

## Board appearance

Optional `appearance` in the opened repository's `roadmap.config.json` configures card badges and colors in both This and Across views and both List and Columns layouts. It is per opened board, has no settings UI or separate persistence, and does not merge sibling worktree settings. Omit it to retain defaults; remove it and Refresh to reset.

`cardFields` is an ordered list of scalar metadata fields for cards and feature Read tags: `status`, `priority`, `commitment`, `milestone`, and supported scalar custom metadata. `id`, `title`, `kind`, and `labels` are excluded. Cards omit the exact field represented by the active metadata grouping, preserving the remaining order; freeform Board grouping omits none. This applies to default/configured fields in List/Columns and This/Across. Changing grouping restores an otherwise enabled field. Read keeps all enabled tags regardless of grouping, always retains its separate primary combined status and omits `status` from the tag row; the selected-version status disclosure is unchanged. Valid absent custom fields are accepted but emit no placeholder. Duplicates keep their first position; malformed or unsupported entries are dropped. Omission or invalid `cardFields` restores defaults; `[]` hides these metadata badges, not Read's primary status. Explicit lists have no legacy two-custom-field cap and their nongrouping fields remain visible in dense cards. Milestone is a default core field, but an explicit list must include it to enable it; existing dense-default compression to status/priority is unchanged. Hiding badges does not change item metadata, Edit/Raw fields, filters, grouping, status calculation, conflict/coverage cues or `cardColorBy`; border colors still use original metadata. Edit and Raw retain full supported metadata.

`tagColors` maps exact, case-sensitive field keys and normalized scalar string values to `gray`, `blue`, `green`, `amber`, `red`, `purple`, or `teal`. Numbers and booleans use their existing string form. `colorTags` defaults to `true`; `false` suppresses custom mapped colors on card badges and detail, but preserves semantic status and commitment tones. It does not affect `cardColorBy`: omit `cardColorBy` for tag-only colors, use `colorTags: false` plus `cardColorBy` for border-only colors, or use the default `true` plus `cardColorBy` for both. `cardColorBy` accepts a supported scalar field other than `status`, colors only the left border, and works even if its badge is hidden. Missing/unmapped values use a neutral border. Status stripes and active/blocked tints are suppressed when enabled; hover, selection, and keyboard focus do not override the border, and status text/color remains semantic. Custom colors do not affect filter controls or status/version resolution.

Validation limits: 64 KiB for appearance JSON, 32 `cardFields` entries, 32 `tagColors` fields, 64 values per field, and 120 characters per value key. Oversized appearance JSON is rejected as a whole; oversized lists/maps process only the bounded prefix. Field names match `[A-Za-z][A-Za-z0-9_-]{0,63}` except `prototype`, `constructor`, and `__proto__`. Invalid entries are dropped. Invalid `colorTags` falls back to `true`; invalid `cardColorBy` restores status styling. A valid border field with no mapping stays neutral. Unknown appearance properties are ignored. Emit at most one concise appearance warning with at most eight details; malformed JSON follows existing configuration error handling.

Filters use the common planning fields `status`, `priority`, `commitment`, `kind`, `milestone`, `lane`, and `labels` when each has two to eight distinct values. Add repo-specific frontmatter keys with `filters.fields`; fields configured under `lenses.fields` are also filterable. Explicitly configured fields may have more than eight values. `id` and `title` remain search-only.

Across worktrees displays each proven logical feature once. Filters match each checkout version independently; the first matching version in opened-checkout-first source order chooses the card's group and default content. This is a display preference, not proof of the latest feature edit. All matching evidence contributes to status and conflict cues, and checkout-version details retain every version and differing board placements. Changing filters or grouping preserves the card identity and a pinned checkout version; independent features with the same item ID remain separate.

## Ownership

Within the resolved roadmap root:

- `board.md` owns group names and item order
- `scope.md` owns the current-focus narrative
- `features/*.md` owns committed or active work
- `ideas/*.md` owns uncommitted or parked ideas

Metadata owns classification fields such as lane, milestone, and status. `board.md` owns one shared traversal order. Moving an item between metadata groups changes metadata only and retains that board position. Reordering in a metadata view uses visible neighboring items as before/after anchors in the canonical order, preserving hidden items; it must not silently cross freeform board groups. Use one neutral `Items` group when full cross-group prioritization is required. Metadata group order is configured by `lenses.fields.<field>.order`, not by board headings.

Do not create parallel roadmap trackers outside this structure unless the user explicitly asks.

## Item Files

Each item is a markdown file with YAML frontmatter.

Required frontmatter: `id`, `title`, `status`, `priority`, `commitment`.
Optional common: `milestone`.

Expected sections: `Summary`, `Why`, `In Scope`, `Out of Scope`, `Done When`, `Notes`. Additional sections are allowed.

When editing items:

- change `status`, `priority`, `commitment`, `title`, and `milestone` in frontmatter, not only in prose
- preserve unknown frontmatter keys and unknown markdown sections; keep section order unless the user asks for reorganization
- keep `id` stable unless the user explicitly asks to rename and update all references
- markdown inside sections is normal — don't flatten it
- if the structured editor doesn't fit the file cleanly, prefer a valid raw markdown edit over inventing a second schema

## Board

`board.md` shape:

```md
# Now
- feature-a
- feature-b

# Next
- feature-c

# Ideas
- idea-a
```

- group headings are freeform; pick what fits the repo (status, milestone, stream, …). `Now`/`Next`/`Ideas` are examples, not required.
- bullet order is canonical display order within each group
- bullet values are canonical item ids
- titles and badges come from item files, not from `board.md`
- preserve empty groups when they're meaningful structure
- update `board.md` only when grouping or ordering changes

## Scope

Use `scope.md` for short current-focus narrative and near-term direction. Item state belongs in item files, not in scope. Milestone and Unfinished reuse the existing filters. In play matches normalized status `active`, `in-progress`, or `blocked`, OR any confirmed attached, nonclosed session, including dormant sessions; it AND-composes with search, metadata, and Unfinished in every lens and layout. Clear resets it and `inPlay=1` preserves it in the URL. Unknown or partial participant results show an incomplete-results notice while retaining known active, in-progress, and blocked matches. These controls do not edit item metadata or reorder the canonical board.

## Manual Metadata-First Migration

1. Check that the installed `minimap-roadmap` skill documents `defaultLens`; update the packaged skill before using the new key.
2. Inventory each board heading and the intended metadata field, then list every disagreement. Ask the developer to resolve conflicts; never guess which value wins.
3. Keep the chosen classification in item frontmatter. Preserve item ids, content, unrelated metadata, and feature/idea location.
4. Flatten existing board bullets in their current traversal order into one neutral `# Items` group. Do not add missing or unlisted items implicitly.
5. Configure `defaultLens` and `lenses.fields.<field>.order`, then reopen List view and verify filters and ordering. Moving an item to Unassigned must remove the grouped field, not write a placeholder value.

There is no automatic migration or board-to-metadata synchronization.
## Constraints

- no UI-only roadmap state, no separate database, no sync source
- do not move items between `features/` and `ideas/` unless the user asks for that semantic change
- if a file is malformed, surface the problem instead of rewriting it blindly
- raw item edits must still parse and must preserve the canonical item id

## Edit Order

1. Read the relevant roadmap files first.
2. Change the smallest set of files that own the requested truth.
3. Group/order changes → `board.md`. Focus narrative → `scope.md`. Item state → item file frontmatter and sections.

## Completion Reconciliation

Reconcile the affected canonical roadmap; a shipped note alone does not correct stale instructions. Make no edit where the roadmap is already accurate.

1. Update the owning item’s status and clearly distinguish shipped scope from remaining work; preserve useful completion evidence.
2. Remove or rewrite obsolete next-step claims that still tell the next agent to implement completed work.
3. Adjust board placement or order only where needed under the existing grouping and priority convention.
4. Check dependency statements directly affected by the completed slice.

Preserve unfinished or deferred scope honestly. If independently prioritized residual work remains under an umbrella item, propose a split; do not automatically split or reorder unrelated work.
