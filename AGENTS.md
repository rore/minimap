# AGENTS.md

This repo dogfoods the packaged minimap app. Minimap exposes two capabilities, each shipped as a self-contained skill with its own bundled runtime and `scripts/start-server.mjs` launcher:

- For roadmap planning and roadmap file updates in this repo, follow [`package/minimap/skills/minimap-roadmap/SKILL.md`](package/minimap/skills/minimap-roadmap/SKILL.md). Treat the roadmap files as canonical and keep behavior aligned with the minimap roadmap contract in [`package/minimap/CONTRACT.md`](package/minimap/CONTRACT.md).
- For spec/design review on a specific file, follow [`package/minimap/skills/minimap-spec-review/SKILL.md`](package/minimap/skills/minimap-spec-review/SKILL.md). The skill works from any repo.

A single running minimap server transparently serves both modes for any number of repos. The bundled launchers detect an already-running instance via `$MINIMAP_HOME/server.json` + `/health` and reuse it.

When changing server, CLI, API, or UI behavior, also update **both** packaged skills' bundled runtimes in [`package/minimap/skills/minimap-spec-review/`](package/minimap/skills/minimap-spec-review/) and [`package/minimap/skills/minimap-roadmap/`](package/minimap/skills/minimap-roadmap/). The three trees (top-level + two skills) must stay in sync; verify with `diff -r` before committing.
