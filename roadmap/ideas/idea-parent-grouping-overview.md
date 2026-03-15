---
id: idea-parent-grouping-overview
title: "Parent grouping overview"
status: done
priority: low
commitment: uncommitted
labels:
  - ui
  - navigation
  - grouping
---


## Summary

Show a higher-level grouping layer when a repo already models parent concepts such as initiative, area, stream, or release.

## Why

Elastic's left-side initiative grouping helps users understand the roadmap at a level above individual cards. Minimap can borrow that overview pattern, but only as a dynamic read layer that reflects structure a repo already owns in files.

## In Scope

- detect and present parent grouping fields already present in roadmap items
- show grouped overview counts or sections that help users navigate larger boards
- keep item files as the source of truth for any parent relationship metadata

## Out of Scope

- inventing a mandatory initiative model for all repos
- adding a separate hierarchy database
- forcing repos to normalize on one grouping name

## Done When

- repos that already use parent grouping metadata gain a clearer high-level overview
- repos without that metadata do not see a broken or empty feature
- the UI remains generic across different naming conventions

## Notes

This is lower priority than search and filters because it depends on stronger existing metadata discipline in the repo.
