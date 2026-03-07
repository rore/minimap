---
id: idea-history-and-recent-changes
title: Recent changes and history view
status: queued
priority: low
commitment: uncommitted
labels:
  - history
  - git
---

## Summary

Expose recent roadmap changes in a human-friendly way using git-backed history rather than separate application state.

## Why

Humans often want to know what changed recently, but that should come from git and file metadata rather than a parallel tracking system.

## In Scope

- recent item changes
- simple history view for roadmap files
- links back to git commits or diffs

## Out of Scope

- custom audit database
- live activity feed service
- workflow automation

## Done When

- a user can answer what changed recently without leaving the repo-local workflow

## Notes

This is valuable, but not needed for the first self-hosted authoring loop.
