---
name: minimap-roadmap
description: Use when reading, updating, or reorganizing roadmap state in a repo that hosts or uses the minimap roadmap file convention. Apply for roadmap planning and status changes; do not use for arbitrary spec review unless the user is using minimap-spec-review.
---

# Minimap Roadmap

## Intent

Use minimap roadmap files as the canonical source of roadmap and feature-planning truth for a repo.

The UI is only a lens over those files. Agents and humans must operate on the same file state.

## Quick Workflow

1. Find the roadmap root from `roadmap.config.json`, or use `roadmap/` when no config exists.
2. Start or verify the bundled server (run from inside the repo whose roadmap you want to view):
   `node <path-to-this-skill>/scripts/start-server.mjs`
3. Open the UI: `http://localhost:4312/`
4. Read the files that own the requested truth before editing.
5. Edit the smallest owning file set.
6. Preserve unknown metadata and sections.
7. Run the repo's normal validation if behavior or generated roadmap output could be affected.

The launcher detects an already-running minimap and reuses it instead of forking a second one. The current server serves whichever repo it was started from.

## Load More When Needed

- For server lifecycle and discovery, read [references/server.md](references/server.md).
- For ownership rules, item structure, board rules, and edit constraints, read [references/roadmap-contract.md](references/roadmap-contract.md).
- When using this skill from the packaged minimap folder, `../../CONTRACT.md` contains the package-level product boundary.

## Guardrails

- Do not create parallel roadmap trackers.
- Do not treat chat as the source of truth when roadmap files exist.
- Do not use this skill for global arbitrary-file review; use `minimap-spec-review` for that.
- Start the server from the repo whose roadmap you want to view.
