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

`start-server.mjs` reads `$MINIMAP_HOME/server.json` and probes `/health`. If a minimap is already running, the launcher exits without spawning a second one. Both `minimap-roadmap` and `minimap-spec-review` use the same registry, so one running server transparently serves both modes.

## Multi-repo

The server is repo-agnostic. Every roadmap request carries its own repo identity via the `X-Minimap-Repo` header (set by the UI from the `#repo=...` URL hash). One server can serve any number of repos at once.

## Optional Pallium participants

Set `MINIMAP_PALLIUM_ENDPOINT` on a supported start or restart command to enable read-only participant lookup. The value must be an explicit local HTTP origin such as `http://127.0.0.1:19836`; Minimap rejects remote, credential-bearing, redirected, or path-bearing endpoints before changing a running server or its saved preference. A successful command saves the validated origin under `$MINIMAP_HOME`, so later starts and restarts with the variable absent preserve the opt-in. Set the variable to an explicit empty value to disable lookup and clear that preference.

If `start-server.mjs` finds a healthy server and the requested or saved effective setting does not exactly match the server's verified effective setting, or a legacy server cannot verify its identity, it exits with restart guidance instead of silently reusing it. `status.mjs` reports Participants as enabled, disabled, or unknown without exposing the origin. Do not edit the private preference file by hand; use the lifecycle scripts and environment variable.

When disabled, Minimap makes no Pallium HTTP requests and all normal roadmap behavior remains available. The server setting controls only the read-only item panel: the public `minimap roadmap item-ref` command and already-available Pallium MCP work-reference tools remain independent.

## URL

```text
http://localhost:<port>/#repo=<absolute-path-to-active-repo>&view=board
```

If the default port 4312 is busy the server falls forward; the actual bound port is in `$MINIMAP_HOME/server.json` and `status.mjs` prints it.
