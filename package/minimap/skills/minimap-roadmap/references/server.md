# Server Lifecycle

Use the bundled scripts only. The skill is self-contained; the scripts handle every state correctly across platforms (Windows signal limitations, TIME_WAIT, race-against-another-launcher, stale registry).

## Local trust boundary

The server binds to IPv4 loopback (`127.0.0.1`) only. Every API request must come from a loopback peer and carry a loopback `Host`; when a browser supplies `Origin`, it must exactly match that request origin. Foreign origins are rejected before route work, while origin-less local CLI and lifecycle requests remain supported.

## Lifecycle commands

| Command | Exit codes | What it does |
| --- | --- | --- |
| `node <skill>/scripts/start-server.mjs` | 0 = running (started or reused); 1 = incompatible/unknown API, settings mismatch, or occupied port | Probe the registry and live `/health`; reuse only a compatible API with matching participant settings. |
| `node <skill>/scripts/status.mjs` | 0 = running; 1 = stale registry; 3 = not running | Print live pid, runtime version, API compatibility and source, plus registry port/startedAt. Legacy identity prints unknown. |
| `node <skill>/scripts/stop-server.mjs` | 0 = stopped (or was already not running, or stale cleaned); 1 = shutdown failed | `POST /api/shutdown`, wait for the port to free. |
| `node <skill>/scripts/restart-server.mjs [--replace-runtime]` | 0 = restarted; 1 = refusal, stop, start, or verification failure | Preflight registered/requested targets before any stop; default permits only the same runtime. Serialize per home, then stop/spawn and verify the child-reported port/identity/configuration. Failed cleanup targets only its own child PID. |

Exit codes follow `systemctl` conventions for `status` (0/1/3 = running/stale/not-running).

## Discovery

`start-server.mjs` reads `$MINIMAP_HOME/server.json` and probes `/health`. A compatible running API is reused even when package versions or runtime sources differ. Unknown/legacy or incompatible API identity is refused without shutdown or saved preference changes. The same checks apply to a race winner on the requested port. Both skills share one registry/server across repositories.

## Shared runtime replacement

Health reports `runtime: { version, apiCompatibility, sourcePath }` and live `pid`. API compatibility is integer 1; it changes only for incompatible server API changes, independently of package release versions.

Routine restart requires both the running version and canonical real server source path to match this launcher's bundled runtime, and the live PID/port to match this home's registry. An unregistered requested-port server requires explicit replacement even with matching runtime identity: the same copy can serve another home. Version alone cannot distinguish development checkouts or installed copies. Editing code in place at the same path/version remains routine; this is location identity, not content attestation. Separate copies require explicit replacement even when their bytes match.

If restart refuses, inspect its running/requested version and source, coordinate with anyone using the shared board/spec server, then use `node <skill>/scripts/restart-server.mjs --replace-runtime` only when replacement is intended. This flag allows a different, incompatible, older, or unknown runtime to be replaced; it is not an automatic upgrade and interrupts all clients of that server. Explicit `stop-server.mjs` remains an intentional shared shutdown, not a version upgrade shortcut.

Restart checks every registered/requested target before any shutdown, does not sweep unrelated adjacent ports, and sends the live PID guard when available. Legacy servers cannot offer the new ownership guarantees. Update each relevant installed skill folder using the existing copy-in installation method (or its checkout link); old launcher copies cannot be retroactively protected. Updating files alone does not replace a running server.

## Multi-repo

The server is repo-agnostic. Every roadmap request carries its own repo identity via the `X-Minimap-Repo` header (set by the UI from the `#repo=...` URL hash). One server can serve any number of repos at once.

## Optional Pallium participants

Set `MINIMAP_PALLIUM_ENDPOINT` on a supported start or restart command to enable read-only participant lookup. Set `MINIMAP_PALLIUM_DASHBOARD_ENDPOINT` separately, and only for a reviewed compatible Pallium dashboard, to enable exact-session participant links. Both values must be explicit local HTTP origins such as `http://127.0.0.1:19836`; Minimap rejects remote, credential-bearing, redirected, or path-bearing endpoints before changing a running server or its saved preference. A successful command saves the validated settings under `$MINIMAP_HOME`, so later starts and restarts preserve them. An explicit empty dashboard value disables links while retaining lookup; an explicit empty lookup value disables lookup and clears both.

If `start-server.mjs` finds a healthy server and the requested or saved effective settings do not exactly match the server's verified effective identity, or a legacy server cannot verify it, the script exits with restart guidance instead of silently reusing it. `status.mjs` reports participant lookup and participant links independently as enabled, disabled, or unknown without exposing either origin. Do not edit the private preference file by hand; use the lifecycle scripts and environment variables.

When disabled, Minimap makes no Pallium HTTP requests and all normal roadmap behavior remains available. The server setting controls only the read-only item panel: the public `minimap roadmap item-ref` command and already-available Pallium MCP work-reference tools remain independent.

## URL

```text
http://localhost:<port>/#repo=<absolute-path-to-active-repo>&view=board
```

If the default port 4312 is busy the server falls forward; the actual bound port is in `$MINIMAP_HOME/server.json` and `status.mjs` prints it.
