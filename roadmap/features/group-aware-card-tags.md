---
id: group-aware-card-tags
title: Hide redundant card tags for the current grouping
status: done
priority: high
commitment: committed
---

## Summary

Show enabled metadata in configured order without repeating the field already expressed by a card's group heading. Keep all enabled tags in feature Read regardless of grouping.

## Why

A Repo or Milestone badge repeats its group heading and consumes useful card space. Explicit cardFields currently bypasses grouping exclusion, so configured and default boards behave inconsistently.

## In Scope

Apply the same generic grouping exclusion to enabled card metadata in List and Columns, This and Across. Milestone stays configurable. Keep Read tags independent of board grouping and retain its separate primary status. Preserve configured order, absent values, empty lists, colorTags/cardColorBy, complete Edit/Raw metadata, source/conflict information and existing density behavior. Verify realistic desktop/narrow boards and update public contracts and both runtime mirrors.

## Out of Scope

New settings, schema changes, default/density redesign, backend changes, real-project metadata edits, dependencies, live deployment and unrelated card layout.

## Done When

- A card omits only the enabled field represented by its current metadata group; Board grouping omits none.
- Configured fields retain relative order, and changing grouping restores the previously hidden field.
- Read keeps enabled tags regardless of grouping, with primary status separate; Edit/Raw remain complete.
- Badge/border colors survive grouping changes, including border-only color and hidden grouping badges.
- Focused regressions and inspected desktop/narrow List/Columns/Read renders pass; docs and mirrors match; independent review and required CI are recorded.

## Notes

User-approved assignment accepted 2026-10-29. The manager owns final review, merge and separately authorized deployment. Public tests use generic isolated examples; real project data remains read-only.

## Completion readiness

Implementation and focused verification are complete: generic grouping exclusion, exact-key identity, default/configured/empty fields, independent colors and grouping-independent Read are covered in both layouts and worktree modes. Sixty-item desktop/narrow List/Columns/Read captures were inspected; public appearance guidance and both runtime mirrors match. Focused Node checks passed 32/32; all three new browser cases and the existing appearance/Read compatibility checks have passing evidence.

Delivery remains pending independent result acceptance, required full CI, merge and manager-owned deployment. Done records implementation completion in this task branch, not an already-deployed release. See the [Work Record](../../.agent-workflow/tasks/group-aware-card-tags.md) for exact verification and handoff state.
