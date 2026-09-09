---
id: add-pallium-work-item-participants
title: Show Pallium participants on roadmap items
status: queued
priority: high
commitment: committed
labels:
  - integration
  - agents
  - collaboration
---

## Summary

Show the agent sessions associated with a roadmap feature or idea when a local Pallium service is explicitly configured. Minimap supplies a stable repository-qualified item reference; Pallium owns the live many-to-many association between exact work references and sessions.

## Why

The board shows what work exists but not which sessions are participating in it. An optional Pallium read-through adds that visibility without making Minimap a session registry, task engine, or second source of truth.

## In Scope

- define one deterministic item reference from canonical repository identity, roadmap-root identity, and item id; it is identical across worktrees and distinct for different repositories or roadmap trackers that reuse an item id
- add agent-skill instructions to attach that exact item reference through Pallium when taking work and detach it when leaving; attachment is always explicit and never inferred from the current file, branch, board column, prompt, or Minimap UI
- apply that guidance only when Pallium tools are available; unavailability never blocks Minimap work, and the skill must not claim an attachment succeeded when it did not
- let the Minimap server, when configured with an approved local Pallium endpoint, request participants for one exact item reference
- show every returned participant's session, container, availability, reference origin (explicit or discovered), and freshness in item detail; associations do not claim ownership, activity, acceptance, or completion
- keep separate references separate: references attached to the same session are not aliases, and Minimap never expands or unions them
- distinguish a successful empty result from Pallium being disabled, unsupported, unreachable, timed out, or returning an invalid response while leaving the ordinary board usable
- link to Pallium's existing Relay inspection/filter view only when Pallium publishes a supported deep-link contract; omit the link otherwise
- keep Pallium MCP participation independent of the Minimap server integration so an agent can attach or detach when Minimap has no Pallium endpoint configured
- bound request time and response size, redact upstream error detail, and keep credentials, headers, and other secrets out of browser responses and logs
- accept the Pallium endpoint only from trusted server-side configuration; do not accept arbitrary client-supplied URLs or expose a general proxy

## Out of Scope

- storing live session ids, participant snapshots, or association state in `roadmap/`, item frontmatter, board files, or other versioned Minimap data
- automatic attachment, detachment, ownership inference, broadcasts, agent invocation, task assignment, or workflow-engine behavior
- moving Pallium's association model into Minimap
- a human Relay message composer or a new Jira or other tracker integration
- remote Pallium discovery or arbitrary cross-origin requests
- inventing a Relay dashboard URL when Pallium does not provide a supported deep link

## Done When

- the same feature or idea opened from two worktrees produces the same exact reference, while the same item id in a different repository or configured roadmap root produces a different reference
- the packaged roadmap skill tells an agent to explicitly attach on taking work and detach on leaving, using Pallium MCP directly and the exact reference Minimap displays or derives
- with Pallium unconfigured, the board and item detail keep their normal behavior
- a successful Pallium response with no associations is shown as an empty participant state, distinct from disabled, unsupported, unreachable, timeout, malformed, and over-limit states
- one and multiple associations render each participant's session, container, availability, origin, and freshness without persisting those values in the repo
- participant lookup is server-side, exact-reference only, time- and size-bounded, and cannot be redirected by a browser-supplied URL
- browser responses and logs do not expose Pallium credentials, authorization headers, raw upstream errors, or unrelated association data
- a supported Relay inspection deep link is rendered when supplied by the agreed contract, and no guessed link is rendered when it is absent or invalid
- end-to-end coverage exercises explicit attach → exact lookup → multiple-participant display → detach, plus worktree identity, repository/tracker separation, non-equivalent co-attached refs, empty/disabled/unsupported/unavailable states, timeout, malformed or oversized responses, untrusted URL input, Unicode item ids, and no writes to versioned roadmap files

## Notes

Contract prerequisite: implement and document `rore/Pallium:roadmap/features/add-relay-session-work-associations.md` before Minimap coding begins. Pallium owns the shared multi-work-reference lifecycle, attach/detach MCP operations, exact-reference participant projection, origin and availability semantics, bounds, capability detection, and any supported Relay dashboard deep link. Minimap consumes that published contract rather than guessing routes, fields, or URLs.

Implementation discovery starts at:

- `package/minimap/server.js`: workspace loading, route dispatch, and trusted repo resolution
- `package/minimap/src/roadmap.js`: roadmap-root and item identity
- `package/minimap/ui/api.js` and `package/minimap/ui/app.js`: workspace reads and item detail
- `package/minimap/skills/minimap-roadmap/SKILL.md`: explicit agent attach/detach guidance
- `playwright/roadmap-ui.spec.js`: caller-visible roadmap journeys

Follow the mirror workflow in `AGENTS.md` for package behavior changes. Extend the existing workspace response or add the smallest item-detail read after measuring payload and latency; do not fetch Pallium separately for every board card.