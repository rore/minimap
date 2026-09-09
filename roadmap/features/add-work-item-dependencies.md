---
id: add-work-item-dependencies
title: Record work dependencies and show readiness
status: queued
priority: high
commitment: committed
labels:
  - roadmap
  - coordination
---

## Summary

Record explicit prerequisites between roadmap items and derive whether their
recorded dependencies are satisfied. Show blockers, reverse dependents, navigation,
and a ready-work filter. Support the current roadmap and explicitly configured
local repositories. Minimap describes readiness; humans or agents choose execution.

## Why

Board order expresses priority, not prerequisites. A participant-display feature
may depend on a session-association API in another repository. A coordinating agent
needs that relationship in canonical files instead of hidden conversational context.
This is useful with Minimap alone; Pallium and a coordination skill are optional.

## Priority and Dependencies

Queue in Next after `add-pallium-work-item-participants`, preserving its existing
position. These features can be implemented independently. Coordinate the stable
repository/roadmap/item identity contract with that feature before either creates
an incompatible reference format. Dependency resolution itself needs no Pallium.

## Discovery Before Implementation

Inspect current frontmatter parsing/serialization, custom statuses, item lookup,
configured roadmap roots, navigation, filters, safe local path resolution, and
agent guidance. Start with `package/minimap/CONTRACT.md`, `src/roadmap.js`,
`server.js`, `ui/api.js`, `ui/app.js`, and `ui/filters.js` under `package/minimap/`,
plus the packaged roadmap skill and existing UI tests.

Before code changes, record the exact dependency format (likely `depends_on`),
completion-status mapping, repository-location configuration, bounds, and
compatibility behavior. Preserve unknown metadata and existing items without deps.
Do not impose a universal workflow vocabulary on repositories with custom statuses.

## In Scope

### Canonical relationships and resolution

- Store forward prerequisites in each item's frontmatter. Derive reverse dependents
  from those references; do not maintain a second reverse list or a graph database.
- Define stable repository-qualified roadmap/item references, with a compact local
  form if useful. Identical item IDs in different repos or roadmap roots are distinct;
  opening the same roadmap in another worktree preserves identity.
- Cross-repository resolution uses explicit trusted local repository mappings. No
  cloning, remote tracker requests, network discovery, or arbitrary browser-supplied
  filesystem paths. Validate resolved paths with the existing safe-path boundary.
- A repository's identity can have several worktree versions. Declare which configured
  checkout supplies each external roadmap's observed state; never silently union
  conflicting copies or pick the latest file. Display the selected source and allow
  navigation to it. The current roadmap uses the checkout the developer opened.
- Missing, deleted, malformed, inaccessible, or unconfigured targets stay unresolved,
  with an explanation. Never treat a dangling dependency as satisfied or recreate it.
  Preserve references through ordinary edits; define rename/delete behavior explicitly.

### Readiness and graph validity

- Satisfy a dependency only from its target's canonical completion status, using a
  documented mapping/default. Board group names and drag position are not evidence.
- Cancellation, unknown statuses, and missing status do not imply completion. A
  cancelled prerequisite requires an explicit relationship change or resolution.
- Distinguish satisfied, blocked by unfinished prerequisites, unresolved, and invalid
  relationships. An empty prerequisite list is satisfied. A ready-work filter combines
  satisfied dependencies with eligible unfinished items, excluding done/cancelled work.
- Readiness does not claim specification quality, resource availability, acceptance,
  or safety of parallel execution. Reopening a prerequisite recalculates readiness;
  it does not rewrite a dependent item's status, including already-completed items.
- Detect self-dependencies, duplicates, and cycles including multi-hop/cross-repo
  cycles in the resolved graph. Reject invalid UI mutations without changing files.
  Raw-file invalidity remains inspectable and repairable without breaking the board.
  Incomplete graph resolution must not be advertised as fully validated.
- Bound graph traversal, file reads, and refresh work; report incomplete results if
  bounds are exceeded. Reuse existing loading/refresh machinery, not a background
  scheduler. Results describe observed file state, not an atomic distributed snapshot.

### Developer and agent experience

- Cards show a compact blocker/unresolved indicator. Item detail lists prerequisites
  with their observed statuses and navigation, plus known reverse dependents.
  Label reverse results as limited to loaded/configured roadmaps, not universal.
- Allow lightweight add/remove of prerequisite references in item editing. Show
  validation errors and external-resolution failures clearly; preserve raw-file editing.
- Add a ready-work filter and an explanation of what ready means. Distinguish loading,
  empty, blocked, invalid, and unavailable states; refresh after edits or source changes.
- Update the roadmap skill: check prerequisites before taking work, expose unresolved
  prerequisites, and let a human/coordinating agent decide execution. Never launch,
  message, claim, complete, or move an item simply because its blockers become done.
- Example: Pallium association API -> Minimap participant integration, alongside an
  unrelated ready documentation item. Demonstrate local-only operation as well.

## Out of Scope

Automatic dispatch/status changes, task ownership, resource locks, scheduling,
critical-path estimation, stacked-PR orchestration, a task-decomposition engine,
remote synchronization, tracker connectors, Pallium requirements, and a graph canvas.

## Done When

1. File/API/UI round trips preserve dependencies and unrelated frontmatter/sections;
   legacy items remain usable. Readiness uses documented statuses, not board columns.
2. Caller-visible E2E covers add -> blocked -> prerequisite completion -> ready ->
   reopen -> blocked -> remove, plus dependent items already marked complete.
3. Cross-repo E2E covers configured targets, same IDs in different repos/roadmaps,
   two worktrees with divergent state, missing/unconfigured sources, and navigation
   to the actual selected source. No remote fetch or unapproved filesystem read occurs.
4. Self/duplicate/cyclic refs (including cycles longer than two), deleted targets,
   cancellation, unknown statuses, malformed raw files, Unicode, empty/max/over-max
   inputs, graph limits, and stale/concurrent edits have explicit observable behavior.
5. UI tests cover blocker detail, reverse links, ready filter, error recovery,
   keyboard access, escaping, and unchanged unrelated board behavior. Failed writes
   preserve files; dependency updates never silently overwrite concurrent edits.
6. Tests prove no task/session/message side effects and no duplicate stored graph.
   Update the contract and skill guidance, run required mirror synchronization for
   implementation changes, and pass focused plus repository-required checks.

## Notes

This is a queued feature, not a declaration that dependency parsing already ships.
The implementation agent should settle the bounded decisions above before coding;
no broad orchestration framework or further competitor research is required.
