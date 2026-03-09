---
id: feature-setup-guidance
title: "Setup guidance and empty-state workflow"
status: done
priority: medium
commitment: committed
labels:
  - onboarding
  - ux
milestone: P2
---






## Summary

Guide users when the roadmap workspace is missing, empty, or only partially configured, instead of stopping at a raw setup error.

## Why

A repo-portable product needs a clear first-run path, especially in repos that have not created roadmap files yet.

## In Scope

- better setup error states in the UI
- explain expected file structure and config override behavior
- offer a guided way to create the initial roadmap workspace
- surface invalid config and missing file cases clearly

## Out of Scope

- full project scaffolding outside the roadmap workspace
- remote templates
- opinionated workflow automation

## Done When

- a new repo can understand how to get started from the app itself
- missing or malformed setup states are understandable without reading source code

## Notes

This is a usability feature, not a separate system.
