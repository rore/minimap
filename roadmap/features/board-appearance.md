---
id: board-appearance
title: Customize card fields and tag colors
status: done
priority: medium
commitment: committed
---

## Summary

Choose which metadata badges appear on cards, assign colors to tag values, and optionally use one field to color the card border. Keep boards readable without changing feature data or filtering.

## Design

Version one is optional configuration in roadmap.config.json, documented for humans and agents. No new settings editor, global theme, or personal override layer. Defaults preserve existing rendering exactly. The opened checkout's configuration governs both This and Across views, regardless of which version supplies a card. Switching repository reloads that board's configuration; no cross-board state leakage.

Configuration:

```json
{
  "roadmapPath": "roadmap",
  "appearance": {
    "cardFields": ["status", "priority", "repo"],
    "tagColors": {
      "repo": {"sample-core": "blue", "sample-app": "purple"}
    },
    "cardColorBy": "repo",
    "colorTags": true
  }
}
```

- cardFields is an ordered list of scalar metadata fields. Omitted means today's defaults; [] deliberately hides metadata badges. Explicit lists have no legacy two-custom-field cap and may show the grouping field. Duplicate fields collapse to their first occurrence; absent fields emit no placeholder. Title, summary, identity, kind marker, linked sessions, source/conflict/coverage cues and actions are not metadata badge visibility controls.
- tagColors maps exact metadata field/value pairs to a fixed readable palette: gray, blue, green, amber, red, purple, teal. Use exact parsed scalar values, no case folding or whitespace guessing beyond existing metadata normalization. Status colors keep their established semantic meanings and cannot be overridden. Custom colors apply to metadata badges on cards and in feature details; they do not recolor filter controls or change selected-version/status resolution.
- cardColorBy names one scalar field other than status. Its mapping supplies only the left border. When enabled, replace the status stripe and active background tint with a neutral card and mapped border; missing/unmapped values use a neutral border, never fall back to active blue. Selection/focus treatment stays separate. Omission restores existing status styling. The border works even if the field's badge is hidden. No whole-card background customization.
- colorTags is a boolean defaulting to true. False disables only the configured custom tag palette on cards and details, retaining ordinary status/commitment tones. cardColorBy still uses tagColors independently: omit cardColorBy for tag-only, use colorTags false for border-only, or leave true for both. An invalid boolean defaults to true with the bounded appearance warning.
- Hiding fields never removes metadata, changes edit forms or filters, hides warnings, or changes grouping. The [card hierarchy follow-up](roadmap-card-hierarchy.md) aligns Read tags with cardFields while keeping full Edit/Raw metadata and Read's separate primary status. A hidden card status badge is a deliberate display choice, not a status mutation.
- Validation bounds config size/field/value counts and rejects unsupported names/types safely without CSS/HTML injection. Invalid appearance entries should not make an otherwise valid board unusable: ignore invalid entries and give one concise configuration warning with details, preserving existing config error handling for malformed JSON. Document exact fallback behavior.
- Across uses the card's already-selected representative metadata for custom badge/border values, not a new aggregation rule. Existing combined status and conflict cues remain authoritative. Do not add Git scans or per-card network requests.

## Reviewed edge-case rules

- Supported fields are status, priority, commitment, milestone and scalar custom metadata. Exclude id, title, kind, labels and object/array values. Field names must match `[A-Za-z][A-Za-z0-9_-]{0,63}`; reject prototype, constructor and __proto__. Valid but absent fields remain accepted. Lookup uses the original case-sensitive key and existing normalized scalar string before CSS token normalization, so repo/Repo and team_name/team-name cannot collide. Numeric and boolean scalar values use their existing string form.
- Explicit cardFields controls card metadata rows, including dense cards, and the Read tag row. On cards, status uses the existing combined/recorded badge at its configured position. Read omits it from the tag row and keeps primary status separate. A configured row remains visible in dense columns with ten or more items. Omitted configuration retains defaults; Edit/Raw metadata and conflict/coverage cues remain unchanged.
- Configured borders retain their mapped/neutral color on hover, selection and focus. Selection uses a separate outline rather than the existing overlapping blue stripe. Suppress both progress and blocked status background tints when cardColorBy is enabled; keep status text/color semantic.
- Limits: appearance JSON at most 64 KiB, cardFields at most 32 entries, tagColors at most 32 fields and 64 values per field, color-value keys at most 120 characters. Reject an oversized appearance object as a whole; for oversized lists/maps process only the bounded prefix and warn. Absent or invalid cardFields restores defaults; a valid array drops malformed entries and preserves valid [] as no metadata badges. Drop invalid color entries. Invalid/forbidden cardColorBy restores status styling, while a valid field with no mapping uses a neutral border. Unknown appearance properties are ignored. Use own-key-safe maps/lookups. Produce at most one appearance warning with at most eight detail entries, not per-card warnings.
- Normalize appearance once in loadWorkspace and carry it on the existing opened workspace through aggregate/compact/expanded snapshots. Test contradictory sibling settings, provisional-to-full load, configuration-only refresh, and switching to a board with no appearance.

## Acceptance checks

- Default and configured boards behave correctly in List and Columns, This and Across, including group changes, filtering, refresh, detail open/close and repository switches.
- Regression tests cover config validation, empty/missing/duplicate/unknown fields, unknown colors, malicious keys/values, missing field values, status-color protection, field order, custom-field truncation, and precedence with active/blocked/done/selected cards.
- Real rendered desktop and narrow screenshots are inspected for both layouts with two different boards/configurations, long field values, multiple statuses, and keyboard focus. Tests use isolated homes and fixture repos; never mutate real projects or the live service.
- Public README documentation explains configuration with a copyable example, available colors, defaults, scope, field hiding, status precedence, fallback, and reset by removing appearance. Canonical contract and skill documentation agree; runtime mirrors are synchronized.
- Independent plan and result reviews, focused and required CI checks pass. Report actual limitations, not a claim that every possible gap is eliminated.

## Delivery

Delivered by https://github.com/rore/minimap/pull/77 when merged. Optional card fields, independent tag/border colors, public documentation, regression tests and inspected desktop/narrow views are complete. Independent source review approved implementation 08260ae92d5c1bb8fc8413b770512bf234fb6af8; required CI must pass before merge. No implementation scope remains. Live deployment is separate and is not included.

2026-10-29: user authorized design, implementation using minimap-dev, regression and actual visual testing across boards/views, and public documentation. Developer accepted without competing work. Clean-context plan review identified dense-row, combined-status, exact-key, selection and validation gaps; the rules above resolve them. Manager owns this feature. No live environment changes are part of this assignment.
