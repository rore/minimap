# Minimap (package)

The portable minimap package. Two skills under `skills/`, each self-contained: own runtime, own lifecycle scripts, own docs.

Minimap has two modes:

- **Spec sessions** — review one specific file with anchored comments, threaded replies, and proposed edits. Multiple agents and a human can review the same file. The target file may live in any repo and isn't modified unless a human applies a previewed suggestion. State lives in a local minimap home outside the target repo.
- **Roadmap** — a repo-local view over `board.md`, `scope.md`, and item files in `features/` and `ideas/`. The UI never keeps a second copy of roadmap state.

Both modes run from the same local server. Files stay canonical, the UI is a lens, the human is the merge authority.

For the spec-session model, see [`skills/minimap-spec-review/SKILL.md`](skills/minimap-spec-review/SKILL.md). For the roadmap file contract, see [`CONTRACT.md`](CONTRACT.md).

## Install

Each mode is a Claude Code skill — a folder containing a `SKILL.md` file plus its bundled runtime. Claude Code picks up skills from two places:

- `~/.claude/skills/` — **personal**, available in every repo you open
- `<repo>/.claude/skills/` — **project**, available only inside that repo (and committed with it, so anyone working in the repo gets it)

The two skills fit different scopes:

- **Spec sessions** works on any markdown file anywhere, so install it personally and you get spec review in every repo.
- **Roadmap** only does something in repos that follow the minimap roadmap convention. Install it personally if you want it everywhere, or commit it under the repo's `.claude/skills/` so anyone cloning the repo (and any agent in that repo) gets it without an extra step.

Either way, install is just copying the skill folder. Clone this repo somewhere, then:

**Personal (both skills, available everywhere):**

```bash
cp -R minimap/package/minimap/skills/minimap-spec-review ~/.claude/skills/
cp -R minimap/package/minimap/skills/minimap-roadmap     ~/.claude/skills/
```

**Project (roadmap committed alongside the repo it serves):**

```bash
mkdir -p <your-repo>/.claude/skills
cp -R minimap/package/minimap/skills/minimap-roadmap <your-repo>/.claude/skills/
```

On Windows, replace `cp -R` with `xcopy /E /I` and `~/.claude/skills/` with `%USERPROFILE%\.claude\skills\`.

The skills carry their own server runtime and lifecycle scripts — no `npm install`, no system service. Claude Code picks up newly-dropped skills automatically; no restart needed unless `~/.claude/skills/` itself didn't exist when the session started. Once installed, you ask for a roadmap or a spec session and the agent gives you a URL to open.

> Contributor note: if you're working on minimap itself, link the skill folders to this checkout instead of copying so edits propagate — `ln -s <path>/package/minimap/skills/minimap-<name> ~/.claude/skills/minimap-<name>` on macOS/Linux, `mklink /J %USERPROFILE%\.claude\skills\minimap-<name> <path>\package\minimap\skills\minimap-<name>` on Windows.

### Multi-repo

A single running minimap server can serve roadmap for any number of repos. The agent passes the active repo path in the URL hash:

```text
http://localhost:4312/#repo=/abs/path/to/repo&view=board
```

Each request carries its own repo identity via the `X-Minimap-Repo` header — the server itself is repo-agnostic.

## Server lifecycle (agent contract)

Each skill exposes the same four scripts under `scripts/`. Agents use these only — no direct curl, signals, or registry edits.

| Script | What it does |
|---|---|
| `start-server.mjs` | Start, or detect + reuse a running instance. |
| `status.mjs` | Print port/pid/version. Exit 0 running, 1 stale, 3 not running. |
| `stop-server.mjs` | Graceful shutdown via `POST /api/shutdown`. Cleans stale registry. |
| `restart-server.mjs` | Compose stop + start. |

The launcher detects an already-running instance via `$MINIMAP_HOME/server.json` and reuses it — one server serves both skills and any number of repos.

## Agent hookup

Add a short pointer to the host repo's `AGENTS.md` (or equivalent). Use whichever skill matches the work — see [`AGENTS_SNIPPET.md`](AGENTS_SNIPPET.md) for ready-to-paste text.

The spec-review skill works from any repo (including repos that don't host minimap). The roadmap skill assumes the active repo follows the minimap roadmap convention; it discovers the active repo from the `repo=` URL hash and the `X-Minimap-Repo` header.

## What's in here

- two self-contained skills (`skills/minimap-spec-review/`, `skills/minimap-roadmap/`), each with its own bundled `runtime/` and lifecycle `scripts/`
- shared local UI and server source (`server.js`, `cli.js`, `src/`, `ui/`) — mirrored into both skill bundles; tri-tree parity is enforced by tests
- spec-session store, anchoring, comments, suggestions, preview/apply
- roadmap parsing and file save logic
- starter roadmap templates
- the roadmap file contract ([`CONTRACT.md`](CONTRACT.md))
