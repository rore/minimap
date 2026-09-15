---
id: link-pallium-participant-sessions
title: Link participant names to exact Pallium Relay sessions
status: done
priority: high
commitment: committed
labels:
  - participants
  - integration
  - usability
---

## Summary

Make each usable participant name open that exact session in Pallium Relay while retaining plain text when an exact supported destination is unavailable.

## Why

The Participants panel identifies active collaborators but currently leaves users to find the matching Relay session manually. The API already carries the canonical endpoint id and Minimap already has a validated Pallium origin.

## In Scope

- construct a safe dashboard deep link from the validated Pallium origin and canonical participant endpoint id
- project the link through the existing sanitized participant response
- render the participant name as an accessible external link in a new tab with `noopener noreferrer`
- preserve unchanged plain-text fallback for missing or unusable links
- test exact routing, encoding, escaping, fallback, dense rendering, and a real joint-session click

## Out of Scope

Alias-based routing, new configuration, service discovery, automatic Pallium calls beyond existing participant lookup, changes to association semantics, or generic capability negotiation.

## Done When

- linked names open the exact associated Relay session on a Pallium version that supports the reviewed route
- no link is shown when Minimap cannot prove a safe exact destination
- existing participant status, references, pagination, and disabled/error behavior remain unchanged
- source, both runtime mirrors, tests, docs, and roadmap state are aligned

## Notes

Agent Workflow and Redline are not applicable because this repository has neither governing YAML file. Pallium shipped the reviewed exact-session route in PR #184 at `6a014892`, but its participant contract does not advertise that dashboard capability. Minimap v0.3.4 therefore requires the separate, explicit `MINIMAP_PALLIUM_DASHBOARD_ENDPOINT` compatibility opt-in; older saved configurations retain participant lookup with plain-text names. Live Playwright QA verifies both the safe fallback and the enabled exact-session route, including reload/back behavior and zero non-GET Pallium requests. The full unit and UI suites pass.