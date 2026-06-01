# Minimap

A local workbench for repo planning and spec review.

Minimap is a small local app for collaboration around files in a repo. Humans and AI agents work against the same canonical text — through the UI on one side, through skills and a CLI on the other. There is no hosted service, no database, and no separate planning system. The files are the truth, git is the history.

Minimap has two capabilities:

- **Roadmap** — a repo-local roadmap and feature-planning workspace backed by `roadmap/board.md`, `roadmap/scope.md`, and item files in `features/` and `ideas/`. Use it to keep a living plan in the repo and to review what an agent has drafted or changed.
- **Spec sessions** — a global local workbench for reviewing one specific file (a spec, design doc, RFC, idea). The target file lives in any repo and is never modified unless the user explicitly applies a previewed suggestion. Use it for collaborative review across humans and agents, with anchored comments, replies, and proposed edits.

Both capabilities live in the same local app and follow the same rules. The screenshots below are the real product as it exists in this repo today.

## Roadmap

![Minimap roadmap view](docs/images/minimap-board-list.png)

Board, selected item, and current scope visible together in one local review surface.

An agent drafts or updates roadmap files through normal repo conversations. A human opens minimap to read the board, drill into an item, fix a title, priority, group, or section, and commit the markdown change like any other.

- `board.md` owns groups and item order
- `scope.md` owns the current-focus narrative
- `features/*.md` owns committed or active work
- `ideas/*.md` owns uncommitted or parked work

The UI is only a lens over those files. It does not maintain a second roadmap state.

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

Columns view gives the same canonical data a denser kanban-style layout. Drag-and-drop updates the roadmap files instead of creating a second board state.

![Minimap columns view](docs/images/minimap-board-columns.png)

Each item opens in `Read` mode by default. Switch to `Edit` for a structured form over the common metadata and known sections, or `Raw` for full-file editing when the repo uses a richer item shape. Markdown is allowed inside every section, and minimap preserves unknown frontmatter and extra sections instead of flattening them.

![Minimap editor view](docs/images/minimap-item-editor.png)

For the file contract — required and optional frontmatter, expected sections, board grouping rules, preservation rules — see [`package/minimap/CONTRACT.md`](package/minimap/CONTRACT.md).

## Spec sessions

![Minimap spec sessions view](docs/images/minimap-spec-session.png)

Pick any text file in any repo and turn it into a shared review surface. Selecting a sentence in the rendered document creates an anchored comment or a proposed suggestion. Suggestions show their exact change inline; the user previews the diff and applies it explicitly. Replies, resolutions, and review history live in minimap, never in the target file.

Spec sessions are deliberately separate from the roadmap workspace:

- the target file may live in any repo, including a repo that does not have minimap installed
- session state lives in a local minimap home (`~/.minimap` on macOS/Linux, `%LOCALAPPDATA%/minimap` on Windows), not in the target repo
- the target file is the canonical artifact; minimap owns only the review and suggestion layer
- the target file is never modified unless the user explicitly applies a previewed suggestion

Comments can be global, section-anchored, or quote-anchored. Anchors survive small edits to the surrounding text, and ambiguous or stale anchors are surfaced explicitly rather than silently re-attached.

Agents drive spec sessions through the bundled `minimap-spec-review` skill, which includes a self-contained server runtime and CLI launcher so the skill works from any work repo. See [`package/minimap/skills/minimap-spec-review/SKILL.md`](package/minimap/skills/minimap-spec-review/SKILL.md) and the deeper plan in [`docs/global-spec-sessions-plan.md`](docs/global-spec-sessions-plan.md).

## Shared Principles

Both capabilities share the same product shape:

- **Files are canonical.** Roadmap files for the planning workspace, the attached target file for spec sessions. The UI never holds a second source of truth.
- **Local first.** No hosted service, no database, no sync layer. The roadmap workspace stores everything in the repo; spec sessions store collaboration state in a local minimap home.
- **Human-agent symmetry.** Humans use the UI; agents use skills and a CLI. Both update the same state.
- **The user is the merge authority.** Agents propose; humans accept, reject, and apply.

## Why Use It

The case minimap is built for is the one where roadmap state and spec discussion start drifting across agent chats, ad hoc docs, and PM tools.

Without a shared review surface, a human usually has to reconstruct current state by hand:

- roadmap updates happen in conversations with the agent, then have to be transferred to files
- comments on a spec live in chat threads and become stale as the file changes
- multiple agents can't easily build on each other's review
- the canonical artifact silently loses unresolved objections

Minimap replaces chat-as-coordinator with local shared session state that humans and agents can both read, write, and converge on.

## Why Not Just …

**Why not raw markdown files?**
Markdown is a good canonical format and a poor live planning surface. Minimap keeps markdown as the source of truth while making it easier to review, navigate, regroup, and lightly edit.

**Why not ask the agent for a summary when needed?**
Summaries are helpful but ephemeral. Minimap gives a stable visible view over the actual files the agent wrote, so shared state does not depend on reconstructing it from a conversation.

**Why not GitHub Projects, Linear, or another PM tool?**
Many agent-heavy repo workflows already keep planning in markdown and git. Minimap is for the case where you want that planning to remain in-repo, visible, and editable without introducing a second planning system with its own hidden state.

**Why not a hosted spec review tool?**
Spec sessions are deliberately local-only and machine-local. The target file never leaves the user's machine, and there is no shared server to manage or trust.

## Best Fit

- Repos where roadmap or feature planning already lives in files.
- Specs, designs, or RFCs that need careful review before they ship, especially across multiple agents.
- Teams using agents to draft or update roadmap content, or to review specs.
- Developers who want git-native planning and spec collaboration without a hosted backend.

## Not Best Fit

- Teams that want enterprise workflow automation or heavy process enforcement.
- Org-wide planning across many repos with centralized reporting needs.
- Teams already happy with GitHub Projects, Linear, or a hosted review tool.

## Run Locally

From this repo:

```bash
node package/minimap/server.js
```

Or:

```bash
npm start
```

Then open the URL printed by the server. It prefers `http://localhost:4312` and falls forward to the next free port if that one is busy. The same window hosts both Roadmap and Spec sessions; switch with the segmented control in the top right.

## Adopt The Package

The portable package lives in `package/minimap/`.

To use minimap in another repo:

1. Copy `package/minimap/` into that repo as `tools/minimap/`.
2. For the roadmap capability, copy `tools/minimap/templates/roadmap/` as `roadmap/` (or merge into an existing roadmap root). Optionally copy `tools/minimap/templates/roadmap.config.json` and set `roadmapPath`.
3. Run `node tools/minimap/server.js` from the host repo root.
4. Point the host repo's agent instructions at the relevant skill — `tools/minimap/skills/minimap-roadmap/SKILL.md` for roadmap work or `tools/minimap/skills/minimap-spec-review/SKILL.md` for spec review.

The spec-review skill is self-contained — it includes its own runtime and launcher scripts, so it can also be installed globally and used from work repos that do not contain minimap at all.

See [`package/minimap/README.md`](package/minimap/README.md) for package-focused setup and [`package/minimap/CONTRACT.md`](package/minimap/CONTRACT.md) for the roadmap file contract.

## Agent Integration

Both capabilities ship as named skills under `package/minimap/skills/`:

| Capability | Skill | When to use |
|---|---|---|
| Roadmap | [`minimap-roadmap/SKILL.md`](package/minimap/skills/minimap-roadmap/SKILL.md) | Reading, updating, or reorganizing roadmap state in a repo that uses the minimap roadmap convention. |
| Spec sessions | [`minimap-spec-review/SKILL.md`](package/minimap/skills/minimap-spec-review/SKILL.md) | Collaborating around one specific spec, idea, design, or text file across agents and repos. |

Both skills follow progressive disclosure: a short trigger description and quick workflow at the top of `SKILL.md`, with detailed contracts under each skill's `references/` directory.

## Test

Logic and file behavior:

```bash
npm test
```

UI in a real browser:

```bash
npm run test:ui
```

First-time browser setup:

```bash
npx playwright install chromium
```
