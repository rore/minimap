# Minimap

Minimap is a single-developer workbench for working on repo content together with AI agents. It runs on your machine; there's no shared service, no team mode. It has two modes:

- **[Spec sessions](#spec-sessions)** — review one specific file (a spec, design, RFC, idea) with anchored comments, threaded replies, and proposed edits. Multiple agents and a human can review the same file and reply to each other.
- **[Roadmap](#roadmap)** — a repo-local roadmap and feature-planning workspace backed by markdown files in `roadmap/`.

Both modes run from the same local server. There is no hosted service, no database. Files stay canonical, the UI is a lens.

## Spec sessions

![Spec sessions](docs/images/minimap-spec-session.png)

A spec session attaches to one target file in any repo. Comments and suggestions live in a local store outside that repo. The target file isn't modified unless a human explicitly applies a previewed suggestion.

You can open any roadmap item as a spec session — every roadmap card has a `Review` button, and items with active conversations show a 💬 badge on the board.

[Read more →](#spec-sessions-details)

## Roadmap

![Roadmap](docs/images/minimap-board-list.png)

The roadmap mode is a repo-local view over `board.md`, `scope.md`, and item files in `features/` and `ideas/`. The UI doesn't keep its own state — every change writes back to the markdown.

[Read more →](#roadmap-details)

---

## Run locally

```bash
npm start
```

Open the URL the server prints (defaults to `http://localhost:4312`, falls forward if busy). The same window hosts both modes; switch with the segmented control in the top right.

A single running server can serve any number of repos — switch repos by changing the `repo=` parameter in the URL hash:

```text
http://localhost:4312/#repo=/abs/path/to/repo&view=board
```

## Install

Each mode is a self-contained skill under `package/minimap/skills/`. The skill carries its own runtime and lifecycle scripts. Install by linking the skill directory into your global Claude Code skills folder — the source of truth stays in this repo.

**Windows (junction):**

```text
mklink /J "%USERPROFILE%\.claude\skills\minimap-spec-review" "C:\path\to\minimap\package\minimap\skills\minimap-spec-review"
mklink /J "%USERPROFILE%\.claude\skills\minimap-roadmap"     "C:\path\to\minimap\package\minimap\skills\minimap-roadmap"
```

**macOS/Linux (symlink):**

```bash
ln -s /path/to/minimap/package/minimap/skills/minimap-spec-review ~/.claude/skills/minimap-spec-review
ln -s /path/to/minimap/package/minimap/skills/minimap-roadmap     ~/.claude/skills/minimap-roadmap
```

The roadmap skill is repo-specific in use (it works on `roadmap/` files inside the active repo via the `#repo=...` URL convention), but the install path is the same for both: a link from the global skills directory to this checkout. Edits to the source propagate automatically — no re-install step.

After linking, agents start the server with:

```bash
node ~/.claude/skills/minimap-spec-review/scripts/start-server.mjs
```

A single running server is shared across both skills and across all repos.

## Server lifecycle

All four operations are scripts inside each skill's `scripts/` directory:

| Script | What it does |
|---|---|
| `start-server.mjs` | Start, or detect + reuse a running instance. |
| `status.mjs` | Print port/pid/version. Exit 0 running, 1 stale, 3 not running. |
| `stop-server.mjs` | Graceful shutdown via `POST /api/shutdown`. Cleans stale registry. |
| `restart-server.mjs` | Compose stop + start. |

Agents are expected to use the scripts only — no direct curl, signals, or registry edits.

See [`package/minimap/README.md`](package/minimap/README.md) for package internals, [`package/minimap/CONTRACT.md`](package/minimap/CONTRACT.md) for the roadmap file contract.

## Agent integration

Both modes ship as named skills under `package/minimap/skills/`:

| Mode | Skill | Use when |
|---|---|---|
| Spec sessions | [`minimap-spec-review/SKILL.md`](package/minimap/skills/minimap-spec-review/SKILL.md) | Reviewing one specific file across humans and agents. Works from any repo. |
| Roadmap | [`minimap-roadmap/SKILL.md`](package/minimap/skills/minimap-roadmap/SKILL.md) | Reading or updating roadmap state in a repo that uses the minimap roadmap convention. |

Each skill has a short trigger description and quick workflow at the top, with detailed contracts under its `references/`. The two skills layer cleanly: a roadmap item is just a markdown file, and you can attach it as a spec session for anchored review without leaving the planning workflow.

## Tests

```bash
npm test          # logic and file behavior
npm run test:ui   # browser tests (run `npx playwright install chromium` once)
```

---

<a id="spec-sessions-details"></a>
## Spec sessions — details

A spec session attaches to one target file. Once attached, minimap tracks comments, replies, and proposed suggestions against that file. The target file may live in any repo — including a repo that doesn't have minimap installed. Session state lives in a local minimap home (`~/.minimap` on macOS/Linux, `%LOCALAPPDATA%/minimap` on Windows), not in the target repo.

### Comments and suggestions

A comment can be:
- **global** — applies to the whole file
- **section-anchored** — applies to a heading or section
- **quote-anchored** — applies to a precise sentence or passage

A suggestion is a proposed edit (replace / insert / delete) anchored to a quote. Suggestions are previewed as a diff before they are applied. Applying writes the target file; only humans can apply.

Anchors are designed to survive small edits to the surrounding text. When an anchor becomes ambiguous or stale, minimap surfaces that state explicitly instead of silently re-attaching feedback to the wrong place.

### One human, multiple agents

Each comment, suggestion, and applied edit carries an explicit actor (`human`, `claude`, `codex`, …). That makes it possible to run reviews like:

1. The human attaches a target file and asks one agent (e.g. Claude) to review it. Claude leaves anchored comments and concrete suggestions.
2. The human asks a second agent (e.g. Codex) to review *Claude's review* — confirm what looks right, disagree where appropriate, add evidence, propose alternative suggestions. Codex replies to specific comment ids; the threads accumulate.
3. The human reads the converged review next to the file in the UI, resolves what's settled, applies the suggestions that survived.

The point is that review state is persistent and attributed instead of disappearing with a chat session.

### Agent driver

Agents drive spec sessions through the [`minimap-spec-review`](package/minimap/skills/minimap-spec-review/SKILL.md) skill, which includes a self-contained server runtime, lifecycle scripts, and a CLI launcher. Mutations require an explicit `--by` actor on every write.

---

<a id="roadmap-details"></a>
## Roadmap — details

The roadmap mode is a repo-local view over a small file convention:

- `board.md` owns groups and item order
- `scope.md` owns the current-focus narrative
- `features/*.md` owns committed or active work
- `ideas/*.md` owns uncommitted or parked work

The UI never holds a second copy. Editing through the UI writes the markdown back; agents update the same files directly through the [`minimap-roadmap`](package/minimap/skills/minimap-roadmap/SKILL.md) skill.

Default layout:

```text
roadmap/
  board.md
  scope.md
  features/
  ideas/
```

Optional repo-root config:

```json
{
  "roadmapPath": "docs/roadmap"
}
```

For the file contract — required and optional frontmatter, expected sections, board grouping rules, preservation rules — see [`package/minimap/CONTRACT.md`](package/minimap/CONTRACT.md).

### Composing with spec sessions

A roadmap item is just a markdown file. Click `Review` on any item to attach it as a spec session — anchored comments and suggestions on the item live alongside the item's planning state. Items with an open conversation show a small 💬 badge with the open-comment count on the board, so the planning view stays the entry point even when discussion is happening on individual items.

### Other roadmap views

Columns view gives the same data a denser kanban-style layout. Drag-and-drop updates the roadmap files instead of creating a second board state.

![Columns view](docs/images/minimap-board-columns.png)

Each item opens in `Read` mode. `Edit` is a structured form over the common metadata and known sections; `Raw` is full-file editing for richer item shapes. Markdown is allowed inside every section, and unknown frontmatter and extra sections are preserved instead of flattened.

![Item editor](docs/images/minimap-item-editor.png)
