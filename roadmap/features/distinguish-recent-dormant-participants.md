---
id: distinguish-recent-dormant-participants
title: Distinguish recent and dormant participants
status: in-progress
priority: high
commitment: committed
labels:
  - board
  - collaboration
---

## Summary

Separate recent and dormant attached sessions on roadmap cards and in participant detail without implying current execution, ownership, or completion.

## Why

A single attached-session count makes dormant associations look actively staffed. Readers need a truthful freshness signal that stays consistent between the board and item detail.

## In Scope

- Show concise Recent N and quieter Dormant N in List and Columns; dormant-only items must not look actively staffed.
- Separate recent/dormant detail, show last seen, retain exact-session links, and use stable fallback names rather than reassigned aliases as identity.
- Preserve one bounded batched request per board refresh, omit completed items, and keep unavailable/partial responses distinct from zero.
- Inspect Pallium's existing cleanup controls and authorization; prefer linking supported controls, not adding mutations.
- Document historical preservation limits accurately and keep both packaged skills aligned.

## Out of Scope

New services, schedulers, assignment systems, automatic detach, Minimap-owned lifecycle semantics, and promises that dormant means completed or recent means working now.

## Done When

- Generic fixtures cover recent-only, dormant-only, mixed, missing names, reassigned aliases, closed sessions, explicit detach, and lifecycle changes on refresh.
- Counts and detail agree; absent, unavailable, and partial results never become false zero.
- Actual rendered screenshots and interaction checks cover dense List and Columns at desktop and narrow widths, with legible labels and restrained dormant emphasis.
- Focused tests, repo gates, mirror sync, docs, independent review, and authorized delivery pass.

## Notes

Accepted 2026-09-27. Sole roadmap writer: this Minimap implementation task in the shared checkout C:\Dev\rore\minimap; branch feat/participant-recency-ui. Preserve unrelated artifacts.

Sequence: record scope and inspect existing consumers/cleanup controls; receive the manager-aligned Pallium contract; implement the smallest compatible projection and shared rendering; run lifecycle/count fixtures and real rendered dense-board QA; obtain manager review and green CI; deliver and reconcile this item.

Prerequisite: Pallium owns lifecycle/count semantics and the minimal participant-counts batch API extension. Dependent Minimap code waits for the aligned API; do not infer recency thresholds or response fields. The manager coordinates Pallium and final review. Existing shipped evidence remains in show-board-work-presence and add-pallium-work-item-participants.
