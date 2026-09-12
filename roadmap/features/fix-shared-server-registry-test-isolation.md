---
id: fix-shared-server-registry-test-isolation
title: Isolate server lifecycle tests from the shared registry
status: queued
priority: high
commitment: committed
labels:
  - testing
  - server
  - reliability
---

## Summary

Keep automated server and launcher tests from overwriting or leaving stale state in the developer's shared Minimap server registry.

## Why

After a normal repository test run, the packaged status command found the shared registry pointing at a dead test server on port 4511 instead of the stable preview expected on port 4312. The packaged stop script recovered safely, but tests must not disrupt a real board session or require manual registry cleanup.

## In Scope

- identify every test that starts a server or launcher and verify which `MINIMAP_HOME` it uses
- give each test process an isolated temporary registry home, including failure, timeout, race, and cleanup paths
- preserve coverage for shared roadmap/spec launchers, stale registry recovery, busy ports, and concurrent launches inside the isolated test home
- make cleanup deterministic on Windows without opening visible command windows or changing production lifecycle behavior
- add one regression that keeps a real or sentinel shared registry unchanged across the relevant test run

## Out of Scope

Replacing the registry design, adding a daemon or database, changing the packaged lifecycle contract, or redesigning unrelated server tests.

## Done When

- running the relevant tests cannot create, replace, delete, or stale the developer's shared server registry
- success, assertion failure, timeout, and interrupted-child paths all clean only their isolated temporary homes
- launcher race and stale-registry tests still exercise their intended behavior and pass on Windows
- the packaged status command still reports the pre-existing preview after the test run
- the full repository-required unit suite passes without leaving a test server or registry behind

## Notes

Observed during the Pallium participant live-acceptance pass on 2026-09-12. The bounded suspect is a lifecycle test path that inherited the shared registry home; confirm the exact offender before changing test setup. The production packaged stale-registry cleanup behaved correctly and is not part of this defect.