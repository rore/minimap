# Server Lifecycle

The skill is self-contained and includes:

- `runtime/server.js` for the local minimap server and UI
- `runtime/cli.js` for attach/context/comment commands
- `runtime/src/` for roadmap and spec-session logic
- `runtime/ui/` for the browser UI
- `scripts/start-server.mjs` as the preferred server launcher
- `scripts/minimap.mjs` as the preferred CLI launcher

Use the bundled scripts by default. Do not assume the current repo has minimap installed.

## Start Server

From any repo, run the bundled launcher from this skill folder:

```sh
node <path-to-this-skill>/scripts/start-server.mjs
```

During minimap development, that is usually:

```sh
node package/minimap/skills/minimap-spec-review/scripts/start-server.mjs
```

The server uses the current working directory as the base for relative file paths. Start it from the repo that contains the file you want to review, or use absolute file paths.

If you intentionally want to run a development copy instead of the bundled runtime, use:

```sh
node package/minimap/server.js
```

## Verify Server

```sh
curl http://localhost:5812/health
```

The expected response includes:

```json
{"ok":true}
```

If port 5812 is busy, minimap may fall forward to the next free port. Use the actual printed server URL.

## UI URL

Open the spec session in the minimap UI using the server URL:

```text
http://localhost:5812/#view=spec&file=path/to/spec.md
```

The UI supports selecting text in the rendered file and opening a comment pre-anchored to that selection.
