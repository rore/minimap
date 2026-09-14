---
id: harden-pallium-participant-guidance-config
title: Harden optional Pallium participation and server opt-in
status: done
priority: high
commitment: committed
labels:
  - agent-guidance
  - server
  - integration
---

## Summary

Clarify when an agent should associate itself with a roadmap item and preserve the separately configured, loopback-only participant-panel opt-in across supported Minimap lifecycle commands.

## Why

The current guidance is ambiguous about substantive review, and the participant endpoint is supplied only through one process environment. A restart can therefore lose an intentional opt-in, while a reused server can silently keep a different effective setting.

## In Scope

- define participation as assigned implementation or substantive deliverable review, not passive viewing or clerical card edits
- require authoritative item reading, exact Minimap item-reference derivation, and current Pallium work-reference inspection before attach
- preserve an explicitly configured loopback participant endpoint independently of Pallium skill or MCP availability
- report effective enabled or disabled server state without exposing the endpoint
- reject invalid endpoint input and silent reuse when the requested or saved effective setting differs from the running server
- cover lifecycle, disabled/error states, dense List/Columns rendering, and packaging mirrors

## Out of Scope

Changing the item-reference contract, installing or discovering Pallium, adding a general settings framework, inferring ownership/completion, automatically evicting work references, or storing participant data in roadmap files.

## Done When

- Minimap-only workflows remain unchanged and disabled mode performs zero Pallium requests
- callable Pallium work-reference tools remain usable even when a Pallium skill is not loaded
- restart and stop/start preserve explicit opt-in; explicit empty disables it; invalid explicit values fail closed without erasing a valid saved preference
- healthy reuse verifies the exact effective endpoint identity or exits with restart guidance
- participant UI remains usable for empty, populated, and error results in dense List and Columns views
- source, both packaged runtimes, tests, docs, and roadmap state are aligned

## Notes

Agent Workflow and Redline applicability were checked before implementation. This repository has neither governing YAML file, so those workflows are not applicable and no Work Record was created. Manual risk classification is Elevated/Simple because the change affects persistent local configuration and shared server lifecycle behavior.

Verification: 254 Node tests passed with 2 Windows-only signal skips; 97 Playwright tests passed; dense Participants coverage passed three consecutive runs; and read-only live QA on Pallium covered 11 columns, 150 cards, collapse/expand, item open, Participants, List resize, and card containment.
