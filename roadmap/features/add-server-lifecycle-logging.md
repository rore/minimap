---
id: add-server-lifecycle-logging
title: Retain bounded local server lifecycle diagnostics
status: in-progress
priority: high
commitment: committed
labels:
  - server
  - reliability
---

## Summary

Retain small local startup, shutdown, observed exit, and sanitized fatal-error records under the resolved Minimap home. Show their location and recent evidence in packaged status commands.

## Why

The shared server disappeared again, leaving a stale PID 22816 registry entry. Its launch and exit provenance could not be established. Detached restart discards standard streams, and a missing final record does not prove a crash or any particular cause.

## In Scope

- common server logging for foreground start and detached restart
- startup PID, parent PID, runtime identity, bound port, and known launch mode
- known shutdown reason and observed exit code
- sanitized fatal/startup-error evidence without changing fatal exit behavior
- bounded local retention, harmless log I/O failures, and recent evidence in status even when stale or stopped
- isolated-home tests, both skill lifecycle docs, and synchronized packaged runtimes

## Out of Scope

Request/content/credential logging, raw environment dumps, telemetry, services, watchdogs, installers, other repository copies, and the separately queued test-registry isolation fix.

## Done When

Diagnostics pass focused tests and full required CI, receive exact-head review, and are activated with one coordinated packaged restart. Missing exit evidence remains explicitly unknown; abrupt Windows termination cannot guarantee a final record.

## Notes

2026-09-29: root owns this canonical record on feat/server-lifecycle-logs. The manager accepted the privacy-safe design: native error class/code and runtime-relative locations, without arbitrary stderr/error-message text. Implementation uses an observational fatal monitor and best-effort native JSONL logging. Both skill docs and runtime mirrors are updated. Focused isolated-home tests cover lifecycle, fatal semantics, privacy, rotation, status, and I/O failure. Exact-head review, full CI, and one coordinated activation remain delivery gates. Shared port 4312 PID 27592 stays untouched until those gates allow restart; installed copies and settings remain unchanged. The separately queued shared-registry test-isolation bug is not folded into this change.

PR: https://github.com/rore/minimap/pull/29. Seven focused tests pass, including preserved fatal stderr, SIGTERM/SIGINT/pre-ACK disconnect, and healthy status without a misleading missing-exit warning. The manager requested that clarity fix during exact-head review; stale/stopped and unrelated historical PID evidence stays unknown. Initial CI 36559207994 passed; the revised head still requires fresh full CI and acceptance before activation.
