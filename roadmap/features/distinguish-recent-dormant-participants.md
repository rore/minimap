---
id: distinguish-recent-dormant-participants
title: Distinguish recent and dormant participants
status: done
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

Completed sequence: inspect existing consumers/cleanup controls; receive the manager-aligned Pallium contract; implement the compatible projection and shared rendering; run lifecycle/count fixtures and rendered dense-board QA; obtain independent and manager review, green CI, and the deployed API witness. PR #25 carries the implementation and this canonical reconciliation.

Prerequisite resolved: Pallium owns lifecycle/count semantics and the participant-counts batch API extension. The manager reports PR #253 merged and installed at 4d75328ed7d418cfb9556c86bff2ec8cd4ab1d5f, with restart and health checks passing. The read-only live witness below independently verifies the running split-count contract. Existing shipped evidence remains in show-board-work-presence and add-pallium-work-item-participants.

Baseline inspection: reuse buildBoardParticipantBadge/syncBoardParticipantBadges for both layouts and renderItemParticipants for detail. The old batch projection provided participant_count only; detail already carried lifecycle and last_seen_at. Extend the existing generic board-participant fixtures rather than adding a parallel test system.

Contract aligned and verified 2026-09-27: unchanged request and relay-work-ref-counts/v1 response, additive recent_participant_count/dormant_participant_count summing to total, as_of UTC and recent_seconds 86400. Pallium owns the inclusive response-clock cutoff; alias/health are irrelevant and origins deduplicate. Legacy total-only batches are unsupported classification, with no N+1 fallback; older usable detail remains available. Board/detail are separate observations. Pall-arc delivered the upstream implementation; Minimap consumes that contract.

Cleanup and history limits: Pallium's exact-session dashboard already offers Associated work references and Remove for explicit origins; structural origins remain automatic. Its local single-user dashboard has no authentication, so Minimap must link the reviewed existing surface rather than proxy administrative mutations. Close/reopen retains associations, alias transfer does not transfer them, and detach does not relabel previously captured History. Association is not History coverage or access; earlier untagged turns are not backfilled, and per-turn capture caps or retention can limit historical availability. No cleanup operation was performed during inspection.

Verification 2026-09-27: full Node suite 282 passed with two documented Windows signal skips; full Playwright suite 108 passed. Independent review caught and resolved bounded participant scrolling and visible partial-count warnings. Actual screenshots cover 205 long milestone columns, dense List/Columns at desktop and narrow widths, and a 200-record participant detail with the final record reachable while the item pane remains usable. The real Pallium board was inspected read-only in both layouts; Unfinished left no empty columns. Preview runs on localhost:4312. Legacy total-only fallback was verified before upstream deployment; the deployed split-count witness is recorded below. No Pallium project items or associations were changed for verification.

PR #25 opened at https://github.com/rore/minimap/pull/25. Manager code/screenshot review passed. Initial Linux CI exposed an existing facepile test race: mode switching briefly renders an older spec session before attaching the requested file. The test now waits for the exact attachment response and completed file route before reading its baseline or posting comments; auto-refresh assertions and timeouts are unchanged. Focused repeat verification passed three times; the final implementation CI passed.

The next CI run passed facepile but exposed the same readiness assumption in a paragraph-anchor test. A shared exact-attachment helper now covers all 21 Review-button test callers, and auto-refresh posts target the selected file instead of sessions[0]. Five affected tests repeated three times passed (15 checks), preserving author, anchor, and automatic-refresh assertions. No production behavior was changed by this test repair.

Release evidence: Minimap PR #25 implementation head 90ee00d passed Linux CI 36336632695, including Node, all 108 browser tests, and runtime mirror verification; manager review passed. The upstream CI/deployment blocker was resolved by Pallium's owners before this live check; no duplicate upstream investigation or full-suite rerun was needed.

Live witness, 2026-09-27: the exact feature reference returned status ok and partial false in both layouts, with total 2 = Recent 2 + Dormant 0 and recentSeconds 86400. List board asOf was 2026-09-27T20:49:23.312172Z; its detail asOf was 2026-09-27T20:49:23.158568Z. Columns board asOf was 2026-09-27T20:49:24.677946Z; its detail asOf was 2026-09-27T20:49:25.005167Z. Both detail records were recent and linked the exact minimap-dev and minimap-manager sessions. Rendered desktop (1440x900) and narrow (760x740) List/Columns screenshots were visually inspected; badges, reference text, session links, and the session-activity caveat remained legible. Local evidence is under artifacts/recency-live-*.png. Real dormant/mixed associations were not fabricated; those cases remain covered by the accepted generic fixtures.
