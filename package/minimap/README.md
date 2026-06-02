# Minimap (package)

The portable minimap package. Two skills under `skills/`, each self-contained: own runtime, own lifecycle scripts, own docs.

Minimap has two modes:

- **Spec sessions** — review one specific file with anchored comments, threaded replies, and proposed edits. Multiple agents and a human can review the same file. The target file may live in any repo and isn't modified unless a human applies a previewed suggestion. State lives in a local minimap home outside the target repo.
- **Roadmap** — a repo-local view over `board.md`, `scope.md`, and item files in `features/` and `ideas/`. The UI never keeps a second copy of roadmap state.

Both modes run from the same local server. Files stay canonical, the UI is a lens, the human is the merge authority.

For the spec-session model, see [`skills/minimap-spec-review/SKILL.md`](skills/minimap-spec-review/SKILL.md). For the roadmap file contract, see [`CONTRACT.md`](CONTRACT.md).

## Install

A skill is just a folder under your global Claude Code skills directory. Install minimap by copying the two skill folders into place — no separate runtime, no `npm install`, the skills carry everything they need.

```bash
git clone https://github.com/rore/minimap.git
cp -R minimap/package/minimap/skills/minimap-spec-review ~/.claude/skills/
cp -R minimap/package/minimap/skills/minimap-roadmap     ~/.claude/skills/
```

On Windows, replace the last two lines with:

```text
xcopy /E /I minimap\package\minimap\skills\minimap-spec-review %USERPROFILE%\.claude\skills\minimap-spec-review
xcopy /E /I minimap\package\minimap\skills\minimap-roadmap     %USERPROFILE%\.claude\skills\minimap-roadmap
```

Restart Claude Code (or refresh skills) and your agents pick them up. From there you ask for a roadmap or a spec session and the agent gives you a URL to open.

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
