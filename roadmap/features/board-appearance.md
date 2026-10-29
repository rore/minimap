---
id: board-appearance
title: Customize card fields and tag colors
status: active
priority: medium
commitment: committed
---

## Summary

Choose which metadata badges appear on cards, assign colors to tag values, and optionally use one field to color the card border. Keep boards readable without changing feature data or filtering.

## Design

Version one is optional configuration in roadmap.config.json, documented for humans and agents. No new settings editor, global theme, or personal override layer. Defaults preserve existing rendering exactly. The opened checkout's configuration governs both This and Across views, regardless of which version supplies a card. Switching repository reloads that board's configuration; no cross-board state leakage.

Proposed shape (subject to technical review):

```json
{
  "roadmapPath": "roadmap",
  "appearance": {
    "cardFields": ["status", "priority", "repo"],
    "tagColors": {
      "repo": {"keir-core": "blue", "keir-demo-app": "purple"}
    },
    "cardColorBy": "repo"
  }
}
```

- cardFields is an ordered list of scalar metadata fields. Omitted means today's defaults; [] deliberately hides metadata badges. Explicit lists have no legacy two-custom-field cap and may show the grouping field. Duplicate fields collapse to their first occurrence; absent fields emit no placeholder. Title, summary, identity, kind marker, linked sessions, source/conflict/coverage cues and actions are not metadata badge visibility controls.
- tagColors maps exact metadata field/value pairs to a fixed readable palette: gray, blue, green, amber, red, purple, teal. Use exact parsed scalar values, no case folding or whitespace guessing beyond existing metadata normalization. Status colors keep their established semantic meanings and cannot be overridden. Custom colors apply to metadata badges on cards and in feature details; they do not recolor filter controls or change selected-version/status resolution.
- cardColorBy names one scalar field other than status. Its mapping supplies only the left border. When enabled, replace the status stripe and active background tint with a neutral card and mapped border; missing/unmapped values use a neutral border, never fall back to active blue. Selection/focus treatment stays separate. Omission restores existing status styling. The border works even if the field's badge is hidden. No whole-card background customization.
- Hiding fields never removes metadata, changes edit forms or filters, hides warnings, or changes grouping. Detail keeps full metadata. A hidden status badge is a deliberate display choice, not a status mutation.
- Validation bounds config size/field/value counts and rejects unsupported names/types safely without CSS/HTML injection. Invalid appearance entries should not make an otherwise valid board unusable: ignore invalid entries and give one concise configuration warning with details, preserving existing config error handling for malformed JSON. Document exact fallback behavior.
- Across uses the card's already-selected representative metadata for custom badge/border values, not a new aggregation rule. Existing combined status and conflict cues remain authoritative. Do not add Git scans or per-card network requests.

## Done When

- Default and configured boards behave correctly in List and Columns, This and Across, including group changes, filtering, refresh, detail open/close and repository switches.
- Regression tests cover config validation, empty/missing/duplicate/unknown fields, unknown colors, malicious keys/values, missing field values, status-color protection, field order, custom-field truncation, and precedence with active/blocked/done/selected cards.
- Real rendered desktop and narrow screenshots are inspected for both layouts with two different boards/configurations, long field values, multiple statuses, and keyboard focus. Tests use isolated homes and fixture repos; never mutate KEIR/Pallium or the live service.
- Public README documentation explains configuration with a copyable example, available colors, defaults, scope, field hiding, status precedence, fallback, and reset by removing appearance. Canonical contract and skill documentation agree; runtime mirrors are synchronized.
- Independent plan and result reviews, focused and required CI checks pass. Report actual limitations, not a claim that every possible gap is eliminated.

## Delivery

2026-10-29: user authorized design, implementation using minimap-dev, regression and actual visual testing across boards/views, and public documentation. Manager owns this feature; developer implementation offer is pending acceptance. No live environment changes are part of this assignment.
