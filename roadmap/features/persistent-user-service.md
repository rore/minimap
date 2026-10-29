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

Delivered in [PR #74](https://github.com/rore/minimap/pull/74), with the first-time Windows task lookup corrected in [PR #75](https://github.com/rore/minimap/pull/75). Both merged after independent review and passing CI. The missing-task regression was reproduced and verified against the real Windows read-only task query.

2026-10-29: Windows service installed locally with user approval. Native task startup, managed restart, Roadmap/global Spec Review reuse, and preservation of review records and Pallium settings verified. A recoverable pre-installation backup is retained. Skill/runtime updates remain explicit operations; repository updates alone do not deploy to the service.

Remaining qualification: actual login startup and crash recovery on Windows, and native user-systemd supervision on Linux. Linux tests and unit syntax validation passed, but do not establish those native outcomes.
