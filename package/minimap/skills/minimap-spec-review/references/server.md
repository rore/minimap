# Server Lifecycle

Use the bundled scripts only. The skill is self-contained; the scripts handle every state correctly across platforms (Windows signal limitations, TIME_WAIT, race-against-another-launcher, stale registry).

## Local trust boundary

The server binds to IPv4 loopback (`127.0.0.1`) only. Every API request must come from a loopback peer and carry a loopback `Host`; when a browser supplies `Origin`, it must exactly match that request origin. Foreign origins are rejected before route work, while origin-less local CLI and lifecycle requests remain supported.

## Lifecycle commands

| Command | Exit codes | What it does |
| --- | --- | --- |
| `node <skill>/scripts/start-server.mjs` | 0 = running (started or reused); 1 = incompatible/unknown API, settings mismatch, or occupied port | Probe the registry and live `/health`; reuse only a compatible API with matching participant settings. |
| `node <skill>/scripts/status.mjs` | 0 = running; 1 = stale registry; 3 = not running | Print live identity, registry port/startedAt, and local lifecycle log path/recent evidence, including when stale or stopped. Legacy identity prints unknown. |
| `node <skill>/scripts/stop-server.mjs` | 0 = stopped (or was already not running, or stale cleaned); 1 = shutdown failed | `POST /api/shutdown`, wait for the port to free. |
| `node <skill>/scripts/restart-server.mjs [--replace-runtime]` | 0 = restarted; 1 = refusal, stop, start, or verification failure | Preflight registered/requested targets before any stop; default permits only the same runtime. Serialize per home, then stop/spawn and verify the child-reported port/identity/configuration. Failed cleanup targets only its own child PID. |

Exit codes follow `systemctl` conventions for `status` (0/1/3 = running/stale/not-running).

## Local lifecycle diagnostics

The common server entry records startup identity (PID/parent PID, runtime source/version, port and known launch mode), graceful shutdown reasons, observed exit codes, and sanitized startup/cleanup/fatal errors under the resolved `$MINIMAP_HOME`. Foreground starts and detached restarts use the same logger. `server-lifecycle.jsonl` rotates at 128 KiB to one backup, `server-lifecycle.jsonl.1`, with a 4 KiB event limit. `status.mjs` shows the path and the last eight retained events without changing its exit codes.

These local records contain no request bodies, roadmap/spec content, environment dump, raw stderr or arbitrary error messages. Error evidence retains only recognized native class/code and up to five runtime-relative JavaScript source locations. Message detail is deliberately lost to avoid storing private content or credentials. The fatal monitor is observational: errors still terminate normally and normal stderr is unchanged. Logging I/O failure cannot block startup or shutdown.

Historical events are not proof of the current failure's cause. A verified live PID does not receive a missing-exit warning. Forced termination (including Windows hard kills/job teardown) and failures before the logger loads may leave no final event; missing exit evidence means **unknown**, not a diagnosed crash. Concurrent launch races can lose rotation evidence or briefly exceed the rotation threshold. This is bounded best-effort diagnostics, not telemetry, a watchdog, or a guarantee of recovery.

## Discovery

`start-server.mjs` reads `$MINIMAP_HOME/server.json` and probes `/health`. A compatible running API is reused even when package versions or runtime sources differ. Unknown/legacy or incompatible API identity is refused without shutdown or saved preference changes. The same checks apply to a race winner on the requested port. Both skills share one registry/server across repositories.

The running server transparently serves spec sessions and any roadmap that requests it (see the `#repo=` URL convention used by the roadmap skill).

When the roadmap browser opens a spec from a selected Git checkout, it may use the source-bound `/api/source/spec-sessions/...` route family. Those requests require a live `X-Minimap-Source-Context`, and every target file path must resolve inside that checkout. This does not replace the ordinary unbound spec-review CLI or the routes documented in [http.md](http.md) for reviews of arbitrary files.

## Shared runtime replacement

Health reports `runtime: { version, apiCompatibility, sourcePath }` and live `pid`. API compatibility is integer 1; it changes only for incompatible server API changes, independently of package release versions.

Routine restart requires both the running version and canonical real server source path to match this launcher's bundled runtime, and the live PID/port to match this home's registry. An unregistered requested-port server requires explicit replacement even with matching runtime identity: the same copy can serve another home. Version alone cannot distinguish development checkouts or installed copies. Editing code in place at the same path/version remains routine; this is location identity, not content attestation. Separate copies require explicit replacement even when their bytes match.

If restart refuses, inspect its running/requested version and source, coordinate with anyone using the shared board/spec server, then use `node <skill>/scripts/restart-server.mjs --replace-runtime` only when replacement is intended. This flag allows a different, incompatible, older, or unknown runtime to be replaced; it is not an automatic upgrade and interrupts all clients of that server. Explicit `stop-server.mjs` remains an intentional shared shutdown, not a version upgrade shortcut.

Restart checks every registered/requested target before any shutdown, does not sweep unrelated adjacent ports, and sends the live PID guard when available. Legacy servers cannot offer the new ownership guarantees. Update each relevant installed skill folder using the existing copy-in installation method (or its checkout link); old launcher copies cannot be retroactively protected. Updating files alone does not replace a running server.

## Optional Pallium participants

Roadmap Recent/Dormant badges classify attached, nonclosed sessions under Pallium's 24-hour session last-seen window—not activity on that feature, staffing, or completion. Legacy total-only responses leave classification unavailable; Minimap never guesses a cutoff or fans out per card. Detail remains usable when supported and links existing Pallium association controls. Minimap never detaches sessions or promises complete historical participation.

The shared server may also expose the roadmap item's read-only Participants panel. Set `MINIMAP_PALLIUM_ENDPOINT` on a supported start or restart command to opt in with one validated loopback HTTP origin. Exact-session participant links require the separate `MINIMAP_PALLIUM_DASHBOARD_ENDPOINT`, set only for a reviewed compatible dashboard. Successful commands save both settings under `$MINIMAP_HOME`; an explicit empty dashboard value disables links while retaining lookup, and an explicit empty lookup value clears both. Invalid values are rejected without changing the running server or saved preference.

A requested or saved effective setting that differs from a healthy server's verified effective setting—or whose identity cannot be verified on a legacy server—is not silently ignored: `start-server.mjs` exits with restart guidance. `status.mjs` reports lookup and link state independently as enabled, disabled, or unknown without exposing either origin. This server setting is independent of whether an agent has Pallium skills or MCP tools, and disabled mode makes no Pallium requests.

## URL

```text
http://localhost:<port>/#view=spec&file=<absolute-path-to-target-file>
```

The UI supports selecting text in the rendered file and opening a comment pre-anchored to the selection.
