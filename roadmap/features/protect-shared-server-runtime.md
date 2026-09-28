---
id: protect-shared-server-runtime
title: Protect the shared server from mismatched bundled runtimes
status: in-progress
priority: high
commitment: committed
---

## Summary

Keep self-contained skills while preventing one bundled launcher from silently replacing another shared Minimap runtime.

## Why

Roadmap and spec-review copies share a server. Different installed releases must not silently downgrade it or stop other users' board sessions.

## In Scope

- Live health reports runtime version, API compatibility integer, canonical runtime source path, and process identity.
- Start reuses a compatible API despite differing releases; incompatible or unknown runtimes remain untouched.
- Restart defaults to the same version and source path; explicit --replace-runtime acknowledges replacement of a different or unknown shared runtime, including downgrades.
- Status uses live version/source, not stale registry metadata. Preserve participant preferences and restart ownership/race safeguards.
- Isolated lifecycle tests, both skill docs, contract, mirrors, and relevant installed-copy inspection/update.

## Out of Scope

Central installers/services, version negotiation, runtime content hashes, unrelated fixes, or repeated Pallium integration tests.

## Done When

Compatible reuse, refusal without mutations, routine restart, explicit replacement, and concurrent/failed replacement safety pass focused tests and review. Both bundled skills and supported relevant installed copies carry the change, or exact delivery limitations are reported.

## Notes

Accepted 2026-09-28 from minimap-manager. Sole canonical roadmap writer: minimap-dev in C:\Dev\rore\minimap, branch feat/shared-runtime-guard. Live port 4312 PID 11080 remained untouched during tests; isolated MINIMAP_HOME and ports are used. Runtime identity is canonical server source path plus version; changing code in place remains a routine restart, while a different checkout/copy requires explicit replacement. The unsafe global adjacent-port sweep is removed; registered/requested targets are preflighted before shutdown, and routine restart requires a matching live PID/port in the home registry.

Verification: the full Node suite passed 295 tests with two documented Windows signal skips before final ownership tightening; all 18 focused runtime tests passed after it. Existing focused lifecycle/copy checks passed 12 tests, preserving participant settings, launcher races, child cleanup, and Windows back-to-back restart behavior. Independent smart review found and closed stale-registry deletion and cross-home same-runtime ownership gaps; it reports no remaining blockers. Both self-contained script sets and runtime mirrors are synchronized. No UI behavior changed and no repeated Pallium integration tests were needed.

Rollout inspection found a personal spec-review copy under C:\Users\I347041\.claude\skills and roadmap copies in Pallium, Pallium-installed, dictation_app, agent-workflow-minimap-consumer, and several Pallium evaluation/worktree directories. The manager reports Pallium's owner deferred its two consumer updates until its live-test window ends. Personal copy update follows authorized delivery; evaluation/worktree copies are not silently overwritten. Old launchers cannot be retroactively guarded. The live legacy server stays available but its runtime identity correctly displays unknown until coordinated explicit replacement.
