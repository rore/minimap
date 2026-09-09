---
id: add-metadata-first-grouping-and-ordering
title: Make metadata grouping and list prioritization a first-class workflow
status: done
priority: high
commitment: committed
labels:
  - ui
  - roadmap
  - ordering
---

## Summary

Let a repository use item metadata as the sole source of group membership while
keeping the familiar collapsible List view and direct prioritization controls.
Configure a default grouping independently of List/Columns layout. Support changing
membership and reordering items from metadata-grouped lists using the existing
canonical files, without synchronizing duplicate board and metadata categories.

## Why and Priority

This is the first Next item: a current downstream project needs capability lanes
and delivery milestones as independent dimensions. It needs to group by lane,
filter by milestone, and prioritize from List view. Duplicating lane membership in
board headers and item metadata produces contradictory views after either is edited.
This feature precedes the optional Pallium participants and dependency features;
neither is required. Keep the solution generic rather than mobile-app-specific.

## Existing Behavior and Discovery

Current source already provides metadata lenses, independent filters, List/Columns
layouts, field order/value/drag configuration, and an Unassigned group. Derived
items inherit flattened board order. Board moves save board.md; metadata moves
save the item field. Configuration has no default lens; URL lens or Board is used.
Derived membership moves do not provide independent positional prioritization.

Recheck these facts on pickup in package/minimap/src/roadmap.js, ui/filters.js,
ui/app.js, ui/api.js, and server.js. Review CONTRACT.md, packaged roadmap guidance,
and the existing lens/column feature records. Preserve their useful freeform-board
behavior; extend existing operations rather than adding a second roadmap model.

## Ownership Contract

- Item metadata owns lane, milestone, status, and other configured classifications.
  Moving between lane groups changes lane only; it does not alter milestone/status.
- board.md owns the one shared item sequence. For metadata-first repositories,
  recommend one neutral Items group; its header is not a second lane assignment.
- Lens field configuration owns group display order. Item priority metadata remains
  a label/filter and does not silently sort the manual sequence.
- Freeform board groups remain independent and useful in existing repositories.
  Do not infer a binding from matching names or automatically synchronize headers.
- Different grouping views share one item order, not separately saved priorities.
  Make this visible in guidance and ordering controls.

## In Scope

### Default grouping and everyday list experience

- Add an optional repository default grouping setting through existing roadmap
  configuration. An explicit valid URL grouping wins; otherwise use the configured
  default, then Board. Distinguish an absent URL choice from explicit Board so a
  developer can override the repository default and share that choice reliably.
- Keep layout independent: choosing Lane as default must not force Columns.
  Preserve selected item, active filters, and layout across grouping changes/reloads.
  Define safe fallback and diagnostics for unknown/missing configured fields.
- Preserve collapsible list groups, card/detail navigation, counts, and filtering.
  Lane grouping plus milestone filtering must operate on the same canonical items.
- Keep missing values visibly Unassigned. Show configured empty groups where needed
  for membership moves; define assignment/clearing behavior without inventing values.
- Preserve and expose configured group ordering. In a metadata view, group Up/Down
  controls, if offered, edit that field's configuration, never board headers. Provide
  an accessible group-order action so the list workflow need not fall back to raw
  configuration edits. Existing Board controls retain their current ownership.

### Item prioritization and membership editing

- Provide keyboard-accessible before/after or Up/Down ordering in metadata List view;
  drag can supplement it. Reuse the same ordering semantics in Columns where moves
  are supported, without requiring a layout change for prioritization.
- A within-group move updates the shared board sequence. Preserve the relative order
  of all other items, including hidden and filtered-out ones. Do not rebuild the
  sequence from only visible cards or persist an independent per-lens order.
- Specify the exact anchor rule before coding: a move is relative to a selected
  visible item in canonical order, not a numeric index in the filtered list.
  Explain that other grouping views will reflect that same changed relative order.
- A membership-only move retains canonical position; if the user explicitly chooses
  a destination position too, update both metadata and sequence coherently. A failed
  combined operation must not leave a partially changed membership/order.
- For repositories retaining multiple freeform board groups, metadata reordering
  must not silently move an item between those groups. Define a safe restriction
  and explain it in the UI when the requested relative placement cannot preserve
  board membership. Full cross-group prioritization is available with a neutral list.
- Use current safe write/conflict protections. Stale views must not overwrite another
  agent's file edits. Unlisted/missing/duplicate board entries need explicit handling;
  do not silently enroll or delete items merely to make ordering possible.

### Setup, guidance, and migration

- Teach setup and the roadmap skill to choose one membership authority: use metadata
  for independent lane/milestone/status dimensions; use freeform board groups when
  they convey a different meaning. Do not encourage duplicate lane classification.
- Document a metadata-first example with lane and milestone, neutral board ordering,
  default grouping, group order, and UI versus agent file-edit ownership.
- Provide a concrete migration procedure: inventory header/metadata disagreements;
  resolve them explicitly with the developer; retain chosen item metadata; flatten
  board entries in existing traversal order; set the grouping default and field
  order. Preserve IDs, content, unrelated metadata/configuration, and item membership.
- No automatic migration of existing repositories. The consuming project's installed
  skill version must be checked before applying new configuration. Include update
  instructions; this feature does not authorize guessing or editing that project's
  unknown checkout or conflicting lane values.

## Out of Scope

Board-to-metadata synchronization or binding, per-view saved ordering, automatic
priority sorting, dependency scheduling, new databases, graph views, mandatory
metadata migration, and a general schema/PM framework.

## Done When

1. A representative migrated fixture opens in Lane/List by default, filters by a
   milestone, switches to status/milestone/Board, and reloads without contradictory
   membership. Explicit URL overrides and existing default-Board repos work.
2. Caller-visible tests move membership, reorder within a lane, and change group
   order. Reopen the files and reload the UI to prove the intended single owner
   changed and other metadata/layout/filter choices remained intact.
3. Filtered reordering preserves hidden items and all unrelated relative order;
   moving in one lens has the documented result in another. Cover first/last/empty/
   singleton groups, Unassigned, duplicate/missing/unlisted entries, and freeform
   multi-group restrictions with clear explanations.
4. Unknown defaults, stale URLs, Unicode/escaped metadata, malformed/read-only files,
   conflicting external edits, and combined-write failure preserve data and recover
   visibly. Keyboard operations work in List without relying on drag or Columns.
5. A migration fixture preserves IDs/content/metadata and raises unresolved lane
   disagreements instead of guessing. Existing board-only repositories retain their
   meaning, order, and controls unless they explicitly opt in.
6. Update CONTRACT.md and packaged setup/skill guidance together with implementation;
   sync runtime mirrors per AGENTS.md and run focused model/API checks plus the
   relevant Playwright List/Columns journeys and repository-required checks.

## Notes

Implemented metadata-owned membership, shared board ordering, configurable group
order, default-lens precedence, accessible List/Columns reorder controls, explicit
Unassigned clearing, stale-write protection, and rollback for combined writes.
Validated with unit/integration coverage and real Chromium journeys, including an
84-item board with 10 lanes, 12 long Unicode milestones, narrow viewports, resize,
filtering, focus, dirty drafts, scrolling, containment, and opening distant cards.
