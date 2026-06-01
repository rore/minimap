# Minimap

Drop this folder into a repo and give that repo a shared local workbench for repo planning and spec review.

Minimap is a small repo-local app for collaboration around files. Humans and AI agents work against the same canonical text — through the UI on one side, through skills and a CLI on the other. There is no hosted service, no database, no sync layer.

Minimap has two capabilities:

- **Roadmap** — a repo-local roadmap and feature-planning workspace backed by `roadmap/board.md`, `roadmap/scope.md`, and item files in `features/` and `ideas/`.
- **Spec sessions** — a global local workbench for reviewing one specific file (a spec, design doc, RFC, idea). The target file lives in any repo and is never modified unless the user explicitly applies a previewed suggestion.

Both capabilities share the same product shape: files are canonical, the UI is only a lens, and the human is the merge authority. For the roadmap file contract, read [`CONTRACT.md`](CONTRACT.md). For the spec-session model, read the skill at [`skills/minimap-spec-review/SKILL.md`](skills/minimap-spec-review/SKILL.md) and the deeper plan in [`../../docs/global-spec-sessions-plan.md`](../../docs/global-spec-sessions-plan.md).

## Why Use It

Minimap came out of building projects together with AI agents and repeatedly managing roadmap and spec state through conversation. That works for a while, but it stays too loose:

- roadmap updates live in agent chats, then have to be transferred into files
- comments on a spec live in chat threads and become stale as the file changes
- multiple agents can't easily build on each other's review
- the canonical artifact silently loses unresolved objections

Minimap gives that collaboration model more structure: humans use the local UI, agents follow the minimap skills and the file convention, and both update the same canonical state.

## Roadmap Workspace

The roadmap workspace is repo-local. Roadmap files live inside the host repo, get committed like any other repo change, and are the only source of truth.

### What The Editor Gives You

The item editor is intentionally small, but it is not limited to a rigid form.

- `Read` mode renders the item as a markdown document
- `Edit` mode handles the common metadata and the core sections in a structured form
- `Raw` mode lets you edit the full file when a repo uses richer metadata or extra sections

Markdown is allowed inside every section, and minimap preserves unknown frontmatter keys and extra markdown sections instead of flattening everything into one schema.

### Recommended Host-Repo Layout

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

### Basic Setup

1. Copy this folder into the target repo as `tools/minimap/`.
2. Copy `tools/minimap/templates/roadmap/` into the target repo as `roadmap/`, or merge it into an existing roadmap root.
3. If the repo wants a custom roadmap location, copy `tools/minimap/templates/roadmap.config.json` to the repo root as `roadmap.config.json` and edit `roadmapPath`.
4. From the target repo root, run:

```bash
node tools/minimap/server.js
```

The server uses the current working directory as the repo root, so it must be launched from the host repo root.

### Board Grouping

- `board.md` headings are freeform and repo-defined.
- Repos can group work by status, milestone, release, stream, team, or any other planning structure.
- `Now`, `Next`, and `Ideas` are only examples, not required section names.

## Spec Sessions Workspace

The spec sessions workspace is global, not repo-local. A session attaches to one arbitrary text file and gives you anchored comments, replies, and proposed suggestions over that file. Suggestions are previewed and applied explicitly through the UI; nothing touches the canonical file unless the user accepts a change.

Session state lives in a local minimap home outside the target repo:

- macOS/Linux: `~/.minimap`
- Windows: `%LOCALAPPDATA%/minimap`

You can override this with `MINIMAP_HOME` for tests and advanced setups.

The same minimap server hosts both workspaces — the segmented control in the top right of the UI switches between them. The spec-review skill is also self-contained: it bundles its own server runtime and launcher scripts under `skills/minimap-spec-review/runtime/` and `skills/minimap-spec-review/scripts/`, so the skill can be installed globally and used from any work repo without copying minimap into that repo.

For the workflow, anchoring rules, and CLI commands, read the spec-review skill and its `references/`.

## Agent Hookup

Add a short pointer to the host repo's `AGENTS.md` (or equivalent agent-instruction file). Use whichever skill matches the work:

```md
For roadmap planning and roadmap file updates, follow `tools/minimap/skills/minimap-roadmap/SKILL.md`.
For spec/design review on a specific file, follow `tools/minimap/skills/minimap-spec-review/SKILL.md`.
```

Both skills use progressive disclosure: the `SKILL.md` files hold trigger guidance and the quick workflow, while detailed contracts live under each skill's `references/` directory. The roadmap skill assumes the work repo hosts the minimap roadmap convention; the spec-review skill makes no such assumption and works from any repo.

## What Is Included

- local UI/server app shared by both workspaces
- roadmap parsing and file save logic
- spec-session store, anchoring, comments, suggestions, preview/apply
- `minimap-roadmap` and `minimap-spec-review` skill instructions
- bundled spec-review runtime for global skill installs
- starter roadmap templates
- canonical roadmap contract documentation

## What Is Not Included

- database
- hosted service
- separate sync layer
- hidden state outside repo files for the roadmap workspace
- changes to the target file in the spec sessions workspace, unless the user explicitly applies a suggestion
