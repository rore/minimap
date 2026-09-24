# Server Lifecycle

Use the bundled scripts only. The skill is self-contained; the scripts handle every state correctly across platforms (Windows signal limitations, TIME_WAIT, race-against-another-launcher, stale registry).

## Local trust boundary

The server binds to IPv4 loopback (`127.0.0.1`) only. Every API request must come from a loopback peer and carry a loopback `Host`; when a browser supplies `Origin`, it must exactly match that request origin. Foreign origins are rejected before route work, while origin-less local CLI and lifecycle requests remain supported.

## Lifecycle commands

| Command | Exit codes | What it does |
| --- | --- | --- |
| `node <skill>/scripts/start-server.mjs` | 0 = running (started or already up); 1 = port held by non-minimap process | Probe `$MINIMAP_HOME/server.json`, validate `/health`, reuse if alive; otherwise bind. |
| `node <skill>/scripts/status.mjs` | 0 = running; 1 = stale registry; 3 = not running | Print port, pid, version, startedAt. |
| `node <skill>/scripts/stop-server.mjs` | 0 = stopped (or was already not running, or stale cleaned); 1 = shutdown failed | `POST /api/shutdown`, wait for the port to free. |
| `node <skill>/scripts/restart-server.mjs` | 0 = restarted; 1 = stop, start, or verification failed | Serialize restarts per Minimap home, recover a crashed launcher lock, then stop and spawn. Verify the child-reported port via `/health`; on failure, shut down only that child by PID without deleting another server's registry. |

Exit codes follow `systemctl` conventions for `status` (0/1/3 = running/stale/not-running).

## Discovery

`start-server.mjs` reads `$MINIMAP_HOME/server.json` and probes `/health`. If a minimap is already running, the launcher exits without spawning a second one. Two launchers (same or different skills) racing for the same port land on one server — the loser detects the EADDRINUSE, re-probes, and exits cleanly.

The running server transparently serves spec sessions and any roadmap that requests it (see the `#repo=` URL convention used by the roadmap skill).

## Optional Pallium participants

The shared server may also expose the roadmap item's read-only Participants panel. Set `MINIMAP_PALLIUM_ENDPOINT` on a supported start or restart command to opt in with one validated loopback HTTP origin. Exact-session participant links require the separate `MINIMAP_PALLIUM_DASHBOARD_ENDPOINT`, set only for a reviewed compatible dashboard. Successful commands save both settings under `$MINIMAP_HOME`; an explicit empty dashboard value disables links while retaining lookup, and an explicit empty lookup value clears both. Invalid values are rejected without changing the running server or saved preference.

A requested or saved effective setting that differs from a healthy server's verified effective setting—or whose identity cannot be verified on a legacy server—is not silently ignored: `start-server.mjs` exits with restart guidance. `status.mjs` reports lookup and link state independently as enabled, disabled, or unknown without exposing either origin. This server setting is independent of whether an agent has Pallium skills or MCP tools, and disabled mode makes no Pallium requests.

## URL

```text
http://localhost:<port>/#view=spec&file=<absolute-path-to-target-file>
```

The UI supports selecting text in the rendered file and opening a comment pre-anchored to the selection.
