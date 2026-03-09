---
id: feature-search-and-filters
title: Search and dynamic roadmap filters
status: queued
priority: high
commitment: committed
labels:
  - ui
  - navigation
  - search
---

## Summary

Add fast search plus dynamic filter controls that derive their options from the roadmap files already present in the repo.

## Why

As roadmap size grows, minimap needs faster navigation more than it needs heavier authoring. Search and dynamic filters make the UI substantially more useful for human review while staying fully file-canonical.

## In Scope

- search by id, title, and visible roadmap text
- search across common metadata already present in files, such as labels, status, commitment, or milestone
- filter chips or similar controls that only appear for fields the repo actually uses
- combining search and filters without creating a second saved roadmap state
- stable URL state for the active search and filter set when practical

## Out of Scope

- introducing required metadata fields just to support filtering
- hosted indexing services or remote search backends
- per-user saved filter presets stored outside the repo

## Done When

- a user can quickly narrow a larger roadmap without leaving the repo-local UI
- the available filter controls change based on real roadmap metadata instead of a fixed schema
- search and filtering operate only on the canonical roadmap files

## Notes

This is the most important next visibility feature because it improves review and navigation without changing the product's editing model.