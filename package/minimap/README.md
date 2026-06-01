# Minimap (package)

Portable copy of minimap — drop this folder into a repo to run minimap there.

Minimap has two modes:

- **Spec sessions** — review one specific file with anchored comments, threaded replies, and proposed edits. Multiple agents and a human can review the same file. The target file may live in any repo and isn't modified unless a human applies a previewed suggestion. State lives in a local minimap home outside the target repo.
- **Roadmap** — a repo-local view over `board.md`, `scope.md`, and item files in `features/` and `ideas/`. The UI never keeps a second copy of roadmap state.

Both modes run from the same local server. Files stay canonical, the UI is a lens, the human is the merge authority.

For the spec-session model, see [`skills/minimap-spec-review/SKILL.md`](skills/minimap-spec-review/SKILL.md) and [`../../docs/global-spec-sessions-plan.md`](../../docs/global-spec-sessions-plan.md). For the roadmap file contract, see [`CONTRACT.md`](CONTRACT.md).

## Recommended host-repo layout

```text
<repo>/
  tools/
    minimap/
      server.js
      package.json
      src/
      ui/
      SKILL.md
      skills/
      CONTRACT.md
      templates/
  roadmap/
    board.md
    scope.md
    features/
    ideas/
```

## Setup

1. Copy this folder into the target repo as `tools/minimap/`.
2. For the roadmap mode, copy `tools/minimap/templates/roadmap/` as `roadmap/` (or merge into an existing one). If the repo wants a custom location, copy `tools/minimap/templates/roadmap.config.json` to the repo root and edit `roadmapPath`.
3. Run from the target repo root:

```bash
node tools/minimap/server.js
```

The server uses the current working directory as the repo root, so launch it from the host repo root.

## Agent hookup

Add a short pointer to the host repo's `AGENTS.md` (or equivalent). Use whichever skill matches the work:

```md
For spec/design review on a specific file, follow `tools/minimap/skills/minimap-spec-review/SKILL.md`.
For roadmap planning and roadmap file updates, follow `tools/minimap/skills/minimap-roadmap/SKILL.md`.
```

The spec-review skill works from any repo (including repos that don't host minimap). The roadmap skill assumes the host repo follows the minimap roadmap convention.

## What's in here

- local UI and server, shared by both modes
- spec-session store, anchoring, comments, suggestions, preview/apply
- roadmap parsing and file save logic
- the `minimap-spec-review` and `minimap-roadmap` skill instructions
- a self-contained runtime for the spec-review skill, for global installs
- starter roadmap templates
- the roadmap file contract
