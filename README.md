# Minimap

Planning that lives with the repo.

Minimap is a tiny repo-local roadmap and feature planning workspace for humans and agents. The roadmap files stay canonical, git stays the history, and the local UI is a structured lens over those files rather than a second system with hidden state.

This repo dogfoods the packaged minimap app and roadmap contract, so the screenshots and feature list below describe the product as it exists in this repo today.

![Minimap list view](docs/images/minimap-board-list.png)

## What Ships Today

- local server and UI that discover `roadmap/` from repo root, honor `roadmap.config.json`, and fall forward to the next free port if the requested port is busy
- file-canonical roadmap ownership: `board.md` owns groups and item order, `scope.md` owns current focus, and `features/*.md` plus `ideas/*.md` own item detail
- compact board cards with overview excerpts, metadata badges, collapsible groups, and stable deep links back to the selected item
- read-first item flow with `Read`, `Edit`, and `Raw` modes so the default action is review before edit
- structured item editing for common metadata such as `title`, `status`, `priority`, `commitment`, and optional `milestone`, plus markdown section editing
- raw markdown editing for repo-specific frontmatter or section shapes when a file does not fit the structured editor cleanly
- non-destructive saves that preserve unknown frontmatter keys and extra markdown sections instead of flattening files into one strict schema
- board editing from the UI: rename groups, reorder groups, move items between groups, and save canonical changes back to `board.md`
- scope rendering and scope editing in the UI, including markdown display plus a collapsible and resizable scope panel
- search across ids, titles, metadata, and item body text
- dynamic filters that appear only for metadata the repo actually uses
- derived roadmap lenses such as board, status, commitment, priority, kind, milestone, and configured custom metadata fields
- a second `Columns` layout for kanban-like browsing, with drag handles where canonical moves are safe
- overlay item reading and editing from columns mode so the board stays visible while item detail opens on top
- guided setup and workspace initialization when the roadmap folder is missing, empty, or misconfigured
- a portable package in `package/minimap/` that includes the app, roadmap templates, contract docs, and the agent skill

## Interesting Views

List view stays the default for scanning and editing because it keeps the selected item and current scope visible at the same time.

![Minimap columns layout](docs/images/minimap-board-columns.png)

Columns view uses the same canonical grouping source as list view, gives you a denser board for wide screens, and supports safe drag moves for `board.md` groups and configured draggable metadata lenses such as status.

## Why It Is Useful

Use minimap when you want planning to stay close to the repo instead of drifting into chat history or a separate planning tool.

- humans get a local UI for reading and editing the roadmap files directly
- agents follow the same file contract and update the same canonical files
- repo-specific headings, metadata, and section shapes are allowed instead of forcing one workflow
- git remains the history, with no database, sync layer, or hidden UI-only roadmap state

## How It Works

Minimap keeps one rule strict: the files are the source of truth.

- `board.md` owns groups and item order
- `scope.md` owns current-focus narrative
- `features/*.md` owns committed or active work
- `ideas/*.md` owns uncommitted or parked ideas

The UI is only a structured lens and editor over those files. It does not maintain separate roadmap state.

## Portable Package

A copy-in package is prepared at `package/minimap/`.

That folder is the portable bundle for other repos. It includes:

- the local app and server
- the minimap skill
- starter roadmap templates
- host-repo adoption docs
- the canonical minimap contract

To adopt minimap in another repo:

1. copy `package/minimap/` into that repo as `tools/minimap/`
2. copy `tools/minimap/templates/roadmap/` into that repo as `roadmap/` or merge it into an existing roadmap root
3. optionally copy `tools/minimap/templates/roadmap.config.json` to the repo root as `roadmap.config.json` and edit `roadmapPath`
4. run `node tools/minimap/server.js` from the host repo root
5. point the host repo agent instructions at `tools/minimap/SKILL.md`

See `package/minimap/README.md` for package usage and `package/minimap/CONTRACT.md` for the exact file contract.

## Run

The canonical minimap run command in this repo is the package entrypoint:

```bash
node package/minimap/server.js
```

This repo also provides a local shortcut:

```bash
npm start
```

Then open the URL printed by the server. It prefers `http://localhost:4312` and falls forward to the next free port if that one is busy.

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

## Repo Contract

Default roadmap root:

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

Discovery rules:

- if `roadmap.config.json` is absent, use `roadmap/`
- if it exists, resolve `roadmapPath` relative to repo root
- if the configured path is missing or invalid, the app shows a setup error
