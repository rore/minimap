---
id: foundation-local-server
title: Local server, workspace discovery, and port fallback
status: done
priority: high
commitment: committed
labels:
  - foundation
  - server
---

## Summary

Serve the roadmap UI locally, discover the roadmap workspace from repo root, and handle occupied default ports without crashing.

## Why

The product needs a reliable local-only runtime before the roadmap files and UI behavior can be exercised in real repos.

## In Scope

- serve the static UI on localhost
- resolve `roadmap/` by default
- allow `roadmap.config.json` to override the roadmap root
- expose workspace and item APIs
- fall forward to the next free port when the requested one is busy

## Out of Scope

- remote hosting
- background sync
- any persistence outside repo files

## Done When

- the server starts from repo root
- the UI loads board and scope data through the local API
- a missing or invalid roadmap path produces a setup error
- an occupied default port does not prevent startup

## Notes

This is implemented and covered by tests.
