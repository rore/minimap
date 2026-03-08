---
id: feature-agent-file-rules
title: Agent operating rules for roadmap files
status: done
priority: medium
commitment: committed
labels:
  - agents
  - protocol
---

## Summary

Define the separate agent-facing rules for reading and editing roadmap files so humans and agents can share the same source of truth cleanly.

## Why

The product includes two layers: canonical files and a human UI. The agent behavior contract is a separate artifact and still needs to be specified.

## In Scope

- define which file owns which truth
- define how agents update status, priority, grouping, and notes
- define what agents must not invent or store outside the canonical files
- keep these rules separate from general development workflow instructions

## Out of Scope

- generic engineering planning workflow
- autonomous task execution logic
- repo-specific policy beyond roadmap file handling

## Done When

- the roadmap file rules can be captured in a dedicated skill or instruction set
- agent edits become deterministic against the file convention

## Notes

Implemented via the packaged minimap skill and the repo-level AGENTS hook that points roadmap work at that skill.
