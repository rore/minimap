---
id: idea-search-and-filters
title: Search and dynamic roadmap filters
status: queued
priority: medium
commitment: uncommitted
labels:
  - ui
  - navigation
  - search
---

## Summary

Add fast search plus dynamic filter controls that derive their options from the roadmap files already present in the repo.

## Why

Elastic's public roadmap emphasizes search and lightweight top-level filtering because scanning stops working once the roadmap grows. Minimap needs the same navigation help, but it must stay file-canonical and adapt to whatever metadata a repo already uses.

## In Scope

- search by id, title, and visible roadmap text
- search across common metadata already present in files, such as labels, status, commitment, or milestone
- filter chips or similar controls that only appear for fields the repo actually uses
- combining search and filters without creating a second saved roadmap state

## Out of Scope

- introducing required metadata fields just to support filtering
- hosted indexing services or remote search backends
- per-user saved filter presets stored outside the repo

## Done When

- a user can quickly narrow a larger roadmap without leaving the repo-local UI
- the available filter controls change based on real roadmap metadata instead of a fixed schema
- search and filtering operate only on the canonical roadmap files

## Notes

This is the highest-value Elastic-inspired UI feature because it improves browsing without changing the product's editing model.