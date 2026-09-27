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
- Tooltips and detail must state that last seen measures session activity, not activity on this feature: an old association can be Recent while the session works elsewhere. Neither category implies staffing or completion.
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

Prerequisite: Pallium owns lifecycle/count semantics and the minimal participant-counts batch API extension. The aligned-contract gate is cleared; live API/release acceptance still awaits upstream delivery. Do not infer recency thresholds or response fields. The manager coordinates Pallium and final review. Existing shipped evidence remains in show-board-work-presence and add-pallium-work-item-participants.

Baseline inspection: reuse buildBoardParticipantBadge/syncBoardParticipantBadges for both layouts and renderItemParticipants for detail. The old batch projection provided participant_count only; detail already carried lifecycle and last_seen_at. Extend the existing generic board-participant fixtures rather than adding a parallel test system.

Contract aligned 2026-09-27: unchanged request and relay-work-ref-counts/v1 response, additive recent_participant_count/dormant_participant_count summing to total, as_of UTC and recent_seconds 86400. Pallium owns the inclusive response-clock cutoff; alias/health are irrelevant and origins deduplicate. Legacy total-only batches are unsupported classification, with no N+1 fallback; older usable detail remains available. Board/detail are separate observations. Pall-arc owns upstream implementation; Minimap may implement aligned consumers and generic fixtures, while live API/release acceptance awaits upstream delivery.

Cleanup and history limits: Pallium's exact-session dashboard already offers Associated work references and Remove for explicit origins; structural origins remain automatic. Its local single-user dashboard has no authentication, so Minimap must link the reviewed existing surface rather than proxy administrative mutations. Close/reopen retains associations, alias transfer does not transfer them, and detach does not relabel previously captured History. Association is not History coverage or access; earlier untagged turns are not backfilled, and per-turn capture caps or retention can limit historical availability. No cleanup operation was performed during inspection.

Verification 2026-09-27: full Node suite 282 passed with two documented Windows signal skips; full Playwright suite 108 passed. Independent review caught and resolved bounded participant scrolling and visible partial-count warnings. Actual screenshots cover 205 long milestone columns, dense List/Columns at desktop and narrow widths, and a 200-record participant detail with the final record reachable while the item pane remains usable. The real Pallium board was inspected read-only in both layouts; Unfinished left no empty columns. Preview runs on localhost:4312. Its legacy total-only upstream correctly reports recency unavailable; live split-count release acceptance remains pending upstream delivery and manager review. No Pallium project items or associations were changed.
