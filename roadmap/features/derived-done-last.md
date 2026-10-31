---
id: derived-done-last
title: Show Done cards last within metadata groups
status: done
priority: high
commitment: committed
---

## Summary

Display Done cards after other cards within derived metadata groups, keeping the previous relative order inside both buckets. Preserve explicit freeform Board order.

## Why

Interleaved Done cards make unfinished work harder to scan when grouping a large project by lane, milestone or other metadata.

## In Scope

Use the existing displayed combined-status summary to identify Done, not session activity or a newest-checkout guess. Apply a stable view-only partition in This/Across and List/Columns. Mixed and unknown states remain in the earlier bucket. Preserve group headings/order, canonical item order, manual Board/unlisted buckets, filtering, selection, source/conflict cues and existing reordering behavior. Verify realistic desktop/narrow boards, update ordering guidance and sync both runtime mirrors.

## Out of Scope

Status semantics changes, new sorting settings, persisted order or metadata changes, backend/schema changes, dependencies, real-project data edits and live deployment.

## Done When

- Derived groups show Done last with stable unfinished/Done relative order in both layouts and worktree modes.
- Combined status, mixed/unknown states, filters, empty/Unassigned groups and source data remain correct.
- Manual Board order and unlisted buckets stay unchanged; viewing/toggling never writes files.
- Focused unit/browser regressions, actual large-board desktop/narrow inspection, documentation, mirrors, independent review and required CI are recorded.

## Notes

User-approved assignment accepted 2026-10-31. The manager owns final acceptance, merge and separately authorized local/service deployment. Existing private evidence and recovery refs stay intact.

## Completion readiness

Implementation is complete and independently reviewed. Focused Node checks passed 48/48; This/Across browser cases and final visual run passed 2/2; three existing reorder regressions passed unchanged. Actual sixty-item desktop/narrow List/Columns and Done-boundary renders were inspected, source files stayed byte-identical, and docs/mirrors match.

Done records locally verified implementation, not an already-deployed release. Required full CI, manager/human acceptance, merge and deployment remain pending. See the [Work Record](../../.agent-workflow/tasks/derived-done-last.md) for exact revision and handoff evidence.
