---
id: preserve-board-view-state
title: Preserve board view choices and reading position
status: in-progress
priority: high
commitment: committed
labels:
  - roadmap
  - usability
---

## Summary

Keep a person's board arrangement and reading position while they inspect features or refresh the roadmap. Explain when the Across worktrees source limit leaves checkouts out of view.

## Why

Opening and closing a feature can move the board back to its start. Collapsed groups and view choices can disappear on reopening. A bounded source scan can also look complete when some checkouts were excluded.

## In Scope

- Remember List or Columns, Group by, search, filters, and In play for the active repository and This checkout or Across worktrees mode. An explicit URL choice wins over a remembered default.
- Remember collapsed groups per repository, read mode, and grouping source, including the Across worktrees “Not on a board” group. Keep collapse state separate from canonical roadmap data.
- Retain the current List vertical position, Columns horizontal position, and each column's vertical position when opening or closing a feature and during same-view manual or background refresh. Preserve normal narrow-layout reading behavior.
- Explain bounded checkout discovery and excluded sources in the existing source-coverage UI without raising the scan limit or claiming complete coverage.
- Investigate reports of missing participant badges and related-work entries as part of acceptance. The roadmap manager owns those findings and any separately scoped product fix; this item does not presume their cause or claim them resolved.

## Out of Scope

Changing roadmap files to store personal preferences; a new state framework; unbounded source discovery; live server, installed skill, environment, or user-data changes; unrelated participant or related-work rewrites.

## Done When

- A same-repository reload or reopen restores remembered controls and group collapse, including “Not on a board”; explicit URL controls override remembered defaults, and another repository or read mode does not inherit them.
- List and Columns retain their applicable scroll positions through feature open/close and same-view manual/background refresh, including narrow layouts. A deliberate view or scope change does not restore an unrelated position.
- Source coverage states the configured bound and identifies exclusions honestly, without extending the scan or presenting partial results as complete.
- Focused browser regressions and inspected desktop/narrow List and Columns screenshots support the behavior. Required workflow, redline, and review checks pass before delivery.
- The manager records the outcome of the missing-badge and related-work investigation separately; this feature does not mark those observations fixed without evidence.

## Notes

Authorized follow-up to user QA. Implementation is isolated in `feat/preserve-board-view-state` under `.local/preserve-board-view-state`; no shared service or installed settings are changed for qualification. The Work Record is `.agent-workflow/tasks/preserve-board-view-state.md`.

Implementation and independent technical reviews passed on 2026-10-18; final review and merge are pending in [PR #53](https://github.com/rore/minimap/pull/53). Board preferences and reading-position fixes have four focused browser checks, 26 focused Node checks, and inspected desktop/narrow screenshots in both layouts.

Missing badges were reproduced as a full Across scan exceeding the 30-second deadline, which prevented participant observations. The integrated `restore-across-observations` contribution bounds concurrent Git reads while preserving source validation, identity evidence and history budgets. Seventy focused tests passed. Isolated full snapshot plus healthy participant observations completed in 21.5 seconds cold and 24.3/25.2 seconds for two simultaneous distinct checkout requests; all retained 16 loaded checkouts, nine cap exclusions, 162 features and no identity uncertainty. These are measured local results, not a universal latency guarantee.

Related-work investigation found no Relationships declarations in Work Records across Pallium's 25 checkouts. Minimap therefore has no explicit feature links to display there; it does not infer them from similar names. A regression distinguishes missing declarations from unavailable data. This data-adoption gap is reported to the Pallium manager and is not silently repaired. Live service and installed-copy updates remain outside this change.
