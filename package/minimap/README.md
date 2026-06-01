# Minimap

Drop this folder into a repo and give that repo a shared local workbench for human-agent and multi-agent collaboration on repo content.

Minimap is a small repo-local app for working on the same canonical text together. Humans use the UI; agents use skills and a CLI. Files are the truth, git is the history. There is no hosted service, no database, no sync layer.

Minimap has two capabilities:

- **Spec sessions** — a global local workbench for collaborative review of one specific file (a spec, design doc, RFC, idea). Multiple agents and humans review the same file together: anchored comments, threaded replies, proposed edits, attributable to each actor. The target file is never modified unless a human explicitly applies a previewed change.
- **Roadmap** — a repo-local roadmap and feature-planning workspace backed by `roadmap/board.md`, `roadmap/scope.md`, and item files in `features/` and `ideas/`.

Both capabilities share the same product shape: files are canonical, the UI is only a lens, the human is the merge authority. For the spec-session model, read [`skills/minimap-spec-review/SKILL.md`](skills/minimap-spec-review/SKILL.md) and [`../../docs/global-spec-sessions-plan.md`](../../docs/global-spec-sessions-plan.md). For the roadmap file contract, read [`CONTRACT.md`](CONTRACT.md).

## Why Use It

Iterating on a spec, design, or roadmap with AI agents tends to drift across chat threads:

- prompts, answers, critiques, and findings are copied between sessions
- agent feedback is buried in chat history and goes stale as the file changes
- multiple agents can't easily see — let alone build on — each other's review
- humans cannot easily steer agents with persistent comments outside chat
- final artifacts silently lose unresolved objections

Minimap replaces chat-as-coordinator with local shared session state that humans and agents can both read, write, and converge on.

## Spec Sessions Workspace

The spec sessions workspace is global, not repo-local. A session attaches to one arbitrary text file and gives you anchored comments, threaded replies, and proposed suggestions over that file. Suggestions are previewed and applied explicitly through the UI; nothing touches the canonical file unless the user accepts a change.

### Multi-Party Workflow

Spec sessions are designed for collaboration that's genuinely distributed across humans and agents:

- a human attaches a target file and asks agents to review it
- each agent uses a stable actor identity (`ai:claude`, `ai:codex`, `human:local`, …) so attribution is preserved in the persistent record
- agents leave anchored comments and concrete suggestions through the CLI or HTTP API
- a second agent can review the first agent's review — confirm, disagree, add evidence, propose alternatives — by replying to specific comment ids
- the human reads the converged review next to the file in the UI and applies the suggestions that survive scrutiny

The skill is the primary surface for agents. The CLI under `skills/minimap-spec-review/scripts/minimap.mjs` lets agents attach files, read context, and write comments and suggestions. Mutations require an explicit `--by` actor on every write.

### Storage

Session state lives in a local minimap home outside the target repo:

- macOS/Linux: `~/.minimap`
- Windows: `%LOCALAPPDATA%/minimap`

Override with `MINIMAP_HOME` for tests and advanced setups.

The spec-review skill is self-contained: it bundles its own server runtime and launcher scripts under `skills/minimap-spec-review/runtime/` and `skills/minimap-spec-review/scripts/`, so the skill can be installed globally and used from any work repo without copying minimap into that repo.

For the workflow rules, anchoring guidance, comment kinds, and CLI command contract, read the spec-review skill and its `references/`.

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

## Agent Hookup

Add a short pointer to the host repo's `AGENTS.md` (or equivalent agent-instruction file). Use whichever skill matches the work:

```md
For spec/design review on a specific file, follow `tools/minimap/skills/minimap-spec-review/SKILL.md`.
For roadmap planning and roadmap file updates, follow `tools/minimap/skills/minimap-roadmap/SKILL.md`.
```

Both skills use progressive disclosure: the `SKILL.md` files hold trigger guidance and the quick workflow, while detailed contracts live under each skill's `references/` directory. The spec-review skill works from any repo (including repos that do not host minimap); the roadmap skill assumes the host repo follows the minimap roadmap convention.

## What Is Included

- local UI/server app shared by both workspaces
- spec-session store, anchoring, comments, suggestions, preview/apply
- roadmap parsing and file save logic
- `minimap-spec-review` and `minimap-roadmap` skill instructions
- bundled spec-review runtime for global skill installs
- starter roadmap templates
- canonical roadmap contract documentation

## What Is Not Included

- database
- hosted service
- separate sync layer
- changes to the target file in the spec sessions workspace, unless the user explicitly applies a suggestion
- hidden state outside repo files for the roadmap workspace
