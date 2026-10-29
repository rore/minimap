---
id: persistent-user-service
title: Run Minimap independently of agent applications
status: active
priority: high
commitment: committed
---

## Summary

Offer one persistent per-user Minimap runtime for Roadmap and Spec Review on Windows and Linux. Closing or restarting an agent application must not stop the server.

## In Scope

- Windows login Scheduled Task and Linux user systemd service, ordinary user permissions.
- Stable runtime installation independent of repository worktrees and skill copies.
- Shared packaged lifecycle commands, compatibility checks, logs and crash recovery.
- Explicit installation, update, rollback and removal; preserve existing review data and settings.
- Keep portable standalone mode; no automatic service installation, administrator privileges, Linux lingering or pre-login startup.
- Isolated regression tests and operating documentation for both skills.

## Acceptance

Both skills connect to the same managed server. Intentional stop remains stopped; failed startup is observable; incompatible runtimes cannot silently replace it. Updates retain a recoverable previous runtime. Tests never register tasks or change the user's live service. Native login and crash-recovery claims require native evidence.

## Delivery

2026-10-29: implementation authorized after research; Windows and Linux are required. Local activation remains a separate explicitly scoped environment change. Work Record: `.agent-workflow/tasks/persistent-user-service.md`.
