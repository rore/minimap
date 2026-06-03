# AGENTS.md

This repo dogfoods the packaged minimap app. Minimap exposes two capabilities, each shipped as a self-contained skill with its own bundled runtime and lifecycle scripts:

- For roadmap planning and roadmap file updates in this repo, follow [`package/minimap/skills/minimap-roadmap/SKILL.md`](package/minimap/skills/minimap-roadmap/SKILL.md). Treat the roadmap files as canonical and keep behavior aligned with the minimap roadmap contract in [`package/minimap/CONTRACT.md`](package/minimap/CONTRACT.md).
- For spec/design review on a specific file, follow [`package/minimap/skills/minimap-spec-review/SKILL.md`](package/minimap/skills/minimap-spec-review/SKILL.md). The skill works from any repo.

## Server lifecycle — use the packaged scripts only

All server interaction goes through scripts in `<skill>/scripts/`:

- `start-server.mjs` — start (or detect + reuse a running instance)
- `status.mjs` — print status; exit 0 running, 1 stale, 3 not running
- `stop-server.mjs` — graceful shutdown via `POST /api/shutdown`; cleans stale registry
- `restart-server.mjs` — compose stop + start

**Do not** curl the server directly, send signals to it (`process.kill`, `taskkill`), poke `$MINIMAP_HOME/server.json` by hand, or invoke `node package/minimap/server.js` directly. The scripts handle every state (running, stale registry, port busy, race with another launcher) and stay correct on Windows where signal-based stop is unreliable.

A single running server transparently serves both modes for any number of repos. The launchers detect an already-running instance via `$MINIMAP_HOME/server.json` + `/health` and reuse it.

## Tri-tree sync

Top-level `package/minimap/` is the source of truth. After any change to server, CLI, API, UI, or scripts, run:

```
node scripts/sync-mirrors.mjs
```

It rewrites both runtime trees (`package/minimap/skills/minimap-roadmap/runtime/` and `package/minimap/skills/minimap-spec-review/runtime/`) from the top-level files. The unit test `test/sync-mirrors.test.js` runs the script and re-verifies byte-identity in CI; `test/roadmap.test.js`'s portability test additionally guards against any runtime/ tree introducing install-time dependencies (skills install via copy, never `npm install`).

**Do not** hand-edit files under `package/minimap/skills/*/runtime/` — they are derived. Edit the top-level copy and run the sync script.
