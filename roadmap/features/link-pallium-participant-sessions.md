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

Agent Workflow and Redline are not applicable because this repository has neither governing YAML file. Pallium shipped the reviewed exact-session route in PR #184 at `6a014892`. Live Playwright QA on 2026-09-14 opened `astra-reviewer` from Minimap, selected canonical endpoint `relay-session-5bc31cf243f0496d9a57b281dbb9ad84`, preserved the selection across reload and back navigation, and observed zero non-GET Pallium requests. The full unit and UI suites passed.