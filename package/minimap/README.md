Copy `minimap` into another repo under `tools/minimap/`, then run it from that repo root.

Minimap is a tiny repo-local roadmap workspace for humans and agents. The roadmap files are canonical, git is the history, and the UI is only a structured lens and editor over those files.

For the exact product boundary and file contract, read `CONTRACT.md`.

Recommended host-repo layout:

```text
<repo>/
  tools/
    minimap/
      server.js
      package.json
      src/
      ui/
      SKILL.md
      CONTRACT.md
      templates/
  roadmap/
    board.md
    scope.md
    features/
    ideas/
```

Basic setup:

1. Copy this folder into the target repo as `tools/minimap/`.
2. Copy `tools/minimap/templates/roadmap/` into the target repo as `roadmap/`, or merge it into an existing roadmap root.
3. If the repo wants a custom roadmap location, copy `tools/minimap/templates/roadmap.config.json` to the repo root as `roadmap.config.json` and edit `roadmapPath`.
4. From the target repo root, run:

```bash
node tools/minimap/server.js
```

The server uses the current working directory as the repo root, so it must be launched from the host repo root.

Board grouping:
- `board.md` headings are freeform and repo-defined.
- Repos can group work by status, milestone, release, stream, team, or any other planning structure.
- `Now`, `Next`, and `Ideas` are only examples, not required section names.

Agent hookup:

Add a short note to the host repo's `AGENTS.md` or equivalent:

```md
For roadmap planning and roadmap file updates, follow `tools/minimap/SKILL.md`.
```

What is included:
- local UI/server app
- roadmap parsing and file save logic
- minimap skill instructions
- starter roadmap templates
- canonical contract documentation

What is not included:
- database
- hosted service
- separate sync layer
- hidden state outside repo files
