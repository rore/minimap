---
id: restore-worktree-participant-badges
title: Restore participant badges on the combined worktree board
status: done
priority: high
commitment: committed
---

## Summary

Investigate and correct a board/detail participant mismatch after the worktree changes. User screenshots show a settled Across worktrees card without a badge while its item panel reports Recent 1.

## Scope

Trace aggregate count lookup, logical feature identity, and card rendering. Preserve batched queries, lifecycle semantics, ambiguous-identity protection, and progressive loading. Do not infer that missing or partial counts mean zero, and do not fetch participants separately for every card.

## Acceptance

- List and Columns show recent, dormant, and mixed counts for eligible features after full loading and refresh.
- Detail and board counts use consistent feature identity; no counts leak between ambiguous same-ID features.
- Provisional, unavailable, partial, completed-item, and In play behavior remain correct.
- Generic regression tests and actual rendered screenshots demonstrate the fix; live project verification is read-only.

## Coordination

Root cause: full aggregate and detail both reported Recent 1, but a hidden-to-visible tab lifecycle transition cleared board counts. Across mode excludes the regular count poller, so the badge did not recover. PR #37 retains the aggregate count snapshot during same-scope lifecycle pauses and clears it on scope changes, preserving cancellation and generation guards. Counts remain observations from the last workspace snapshot; Refresh updates them.

Implementation accepted at 29c2882: 358 Node tests passed with 2 expected Windows skips, 39 related browser tests passed, and the strengthened final regression passed separately. Independent developer review found no correctness issues. Manager reviewed the guard and scope-changing callers and inspected actual Columns desktop, List 760px, and Columns 390px screenshots. Developer reproduced the failure by removing only the guard and verified live dictation_app read-only hide/show and spec round trips with no browser errors or writes. Final CI and packaged deployment are release gates; this entry records accepted implementation, not proof of a running server version.

Minimap-manager owns canonical roadmap, acceptance, and delivery. Minimap-dev accepted on 2026-10-01 through the authorized app fallback after Relay claim ordering prevented a reply to the pending assignment. Implementation starts from main 5caac96 in an isolated branch, with no shared-server restart or live-project writes. Root cause is not yet established. The existing card renderer still calls the participant badge helper, so removal of the markup alone is not established.
