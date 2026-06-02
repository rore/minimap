# Server Lifecycle

Use the bundled scripts only. The skill is self-contained; the scripts handle every state correctly across platforms (Windows signal limitations, TIME_WAIT, race-against-another-launcher, stale registry).

## Lifecycle commands

| Command | Exit codes | What it does |
| --- | --- | --- |
| `node <skill>/scripts/start-server.mjs` | 0 = running (started or already up); 1 = port held by non-minimap process | Probe `$MINIMAP_HOME/server.json`, validate `/health`, reuse if alive; otherwise bind. |
| `node <skill>/scripts/status.mjs` | 0 = running; 1 = stale registry; 3 = not running | Print port, pid, version, startedAt. |
| `node <skill>/scripts/stop-server.mjs` | 0 = stopped (or was already not running, or stale cleaned); 1 = shutdown failed | `POST /api/shutdown`, wait for the port to free. |
| `node <skill>/scripts/restart-server.mjs` | 0 = restarted; 1 = stop or start failed | Stop, spawn a fresh detached server, wait for `/health`. |

Exit codes follow `systemctl` conventions for `status` (0/1/3 = running/stale/not-running).

## Discovery

`start-server.mjs` reads `$MINIMAP_HOME/server.json` and probes `/health`. If a minimap is already running, the launcher exits without spawning a second one. Two launchers (same or different skills) racing for the same port land on one server — the loser detects the EADDRINUSE, re-probes, and exits cleanly.

The running server transparently serves spec sessions and any roadmap that requests it (see the `#repo=` URL convention used by the roadmap skill).

## URL

```text
http://localhost:<port>/#view=spec&file=<absolute-path-to-target-file>
```

The UI supports selecting text in the rendered file and opening a comment pre-anchored to the selection.
