# Server Lifecycle

The skill is self-contained and bundles its own minimap runtime in `runtime/` plus launchers in `scripts/`.

## Start Server

```sh
node <path-to-this-skill>/scripts/start-server.mjs
```

The launcher reads `$MINIMAP_HOME/server.json`, probes `/health`, and exits early if a minimap server is already running on the listed port. Otherwise it starts one. Both `minimap-roadmap` and `minimap-spec-review` use the same registry, so a single running server serves both modes.

The currently-running server serves the roadmap of whichever repo it was started from. Start the server from inside the repo whose roadmap you want to view.

## Verify Server

```sh
curl http://localhost:4312/health
```

Expected:

```json
{"ok":true}
```

If port 4312 is busy, the server falls forward to the next free port. The actual bound port is recorded in `$MINIMAP_HOME/server.json`.

## UI URL

```text
http://localhost:4312/
```
