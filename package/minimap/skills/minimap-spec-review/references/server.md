# Server Lifecycle

The skill is self-contained and includes:

- `runtime/server.js` for the local minimap server and UI
- `runtime/cli.js` for spec-session attach/context/comment commands (in-process, no server needed)
- `runtime/src/` for roadmap and spec-session logic
- `runtime/ui/` for the browser UI
- `scripts/start-server.mjs` to start (or detect + reuse) the server
- `scripts/status.mjs` to check status (exit 0 running, 1 stale, 3 not running)
- `scripts/stop-server.mjs` for graceful shutdown
- `scripts/restart-server.mjs` to cycle the running server
- `scripts/minimap.mjs` as the preferred CLI launcher
- `scripts/health-check.mjs` (internal helper used by the lifecycle scripts)

Use the bundled scripts only. Do not curl the server, send signals to it, edit `$MINIMAP_HOME/server.json` by hand, or invoke `node package/minimap/server.js` directly — the scripts handle every state correctly across platforms.

## Lifecycle commands

| Command | Exit codes | What it does |
| --- | --- | --- |
| `node <skill>/scripts/start-server.mjs` | 0 = running (started or already up); 1 = port held by non-minimap process | Probe `$MINIMAP_HOME/server.json`, validate `/health`, reuse if alive; otherwise bind. Race-safe via `MINIMAP_NO_PORT_FALLBACK`. |
| `node <skill>/scripts/status.mjs` | 0 = running; 1 = stale registry; 3 = not running | Read registry + `/health`. Prints port, pid, version, startedAt. |
| `node <skill>/scripts/stop-server.mjs` | 0 = stopped (or was already not running, or stale cleaned); 1 = shutdown failed | `POST /api/shutdown`, wait for port to free. Stale registry: clean it up and exit 0. |
| `node <skill>/scripts/restart-server.mjs` | 0 = restarted; 1 = stop or start failed | Stop running instance, spawn a fresh detached server, wait for `/health`. |

`status.mjs` exit codes follow `systemctl` conventions (0/1/3 = running/stale/not-running).

## Discovery

`start-server.mjs` reads `$MINIMAP_HOME/server.json` and probes `/health` on the listed port. If a minimap is already running, the launcher exits without spawning a second one. Two launchers (same or different skills) racing for port 4312 land on one server — the loser detects the EADDRINUSE, re-probes, and exits cleanly.

The running server transparently serves spec sessions and any roadmap that requests it (see the `#repo=` URL convention).

## UI URL

```text
http://localhost:4312/#view=spec&file=path/to/spec.md
```

The UI supports selecting text in the rendered file and opening a comment pre-anchored to that selection.

## Repo paths and cwd

The server uses the current working directory as the base for relative file paths in spec-session calls. Start it from the repo that contains the file you want to review, or pass absolute file paths.

For roadmap requests, the UI passes the repo path via `#repo=<absolute-path>` in the URL hash and the `X-Minimap-Repo` request header — one server can serve any number of repos this way.

## Development mode

If you intentionally want to run a development copy instead of the bundled runtime (and skip the launcher's discovery + race-safety), use:

```sh
node package/minimap/server.js
```

This is for minimap-the-product development, not for skill consumers.
