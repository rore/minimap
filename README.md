# Minimap

Planning that lives with the repo, not in chat history.

Minimap is a local UI for repo roadmap files. It lets humans and AI agents plan against the same canonical markdown instead of scattering roadmap state across chat threads, ad hoc docs, and separate PM tools.

In practice, an agent drafts or updates roadmap files through normal repo conversations, then a human opens minimap to review the board, scope, and item detail together, make corrections, and commit the markdown changes.

**Files are canonical. Git is the history. The UI is a structured review and editing surface over those files.**

![Minimap hero view](docs/images/minimap-board-list.png)

Board, selected item, and current scope visible together in one local review surface.

This repo dogfoods the packaged app in `package/minimap/`, so the screenshots below are the real product as it exists here today.

## Why Use It

Minimap is for the case where roadmap state starts drifting across agent chats, markdown files, and ad hoc planning docs.

Without a review surface, a human usually has to reconstruct the current plan by hand:

- roadmap updates happen in conversations with the agent
- markdown files remain the source of truth, but they are awkward to inspect as a live board
- separate docs or PM tools create a second planning system
- asking for a summary helps temporarily, but does not give a stable visible view over the actual files

## One Example

Before:

- roadmap updates happen in agent chats
- the actual plan is split across markdown files, chat memory, and ad hoc notes
- a human has to reconstruct the current state by hand

After:

1. Ask an agent to draft a feature or update roadmap files.
2. Open minimap and inspect the board, scope, and selected item together.
3. Fix a title, priority, group, or section if needed.
4. Commit the markdown change like any other repo change.

## Why Not Just Markdown Or GitHub Projects?

Why not just markdown files?

Because raw files are a good canonical format, but a poor live planning surface. Minimap keeps markdown as the source of truth while making it much easier to review, navigate, regroup, and lightly edit roadmap state.

Why not just ask the agent for a summary when needed?

Because summaries are helpful, but they are ephemeral. Minimap gives the human a stable visible view over the actual files the agent wrote, so the shared roadmap does not depend on reconstructing state from a conversation.

Why not GitHub Projects, Linear, or another PM tool?

Because many agent-heavy repo workflows already keep planning in markdown and git. Minimap is for the case where you want that planning to remain in-repo, visible, and editable without introducing a second planning system with its own hidden state.

## What Minimap Adds

- A fast human review layer over roadmap files the agent wrote.
- A clear visible view over the canonical roadmap files instead of split state across chat and docs.
- Lightweight editing without abandoning markdown as the canonical format.
- Search, filters, regrouping, and multiple browse layouts over metadata the repo already has.
- No database, sync layer, or UI-only board state.
- No second planning system sitting beside the markdown files.

## How It Works

Minimap keeps one rule strict: the files are the source of truth.

- `board.md` owns groups and item order
- `scope.md` owns the current-focus narrative
- `features/*.md` owns committed or active work
- `ideas/*.md` owns uncommitted or parked work

The UI is only a lens over those files. It does not maintain a second roadmap state.

Default roadmap layout:

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

## Human-Agent Workflow

1. Work with an agent in normal repo conversations to shape features, priorities, and roadmap state.
2. Let the agent write or update the canonical roadmap files in the repo.
3. Open minimap to quickly see the current roadmap, review what changed, and understand the plan in context.
4. Make lightweight human corrections in the UI when needed, or leave the files as the agent wrote them.
5. Commit the resulting file changes like any other repo change.

## Best Fit

- Repos where roadmap or feature planning already lives in files.
- Teams using agents to draft or update roadmap content.
- Developers who want git-native planning without a hosted PM backend.

## Not Best Fit

- Teams that want enterprise workflow automation or heavy process enforcement.
- Org-wide planning across many repos with centralized reporting needs.
- Teams already happy with GitHub Projects, Linear, or another dedicated PM system.

## Run Locally

From this repo:

```bash
node package/minimap/server.js
```

This repo also provides a shortcut:

```bash
npm start
```

Then open the URL printed by the server. It prefers `http://localhost:4312` and falls forward to the next free port if that one is busy.

## Portable Package

The portable package lives in `package/minimap/`.

To adopt minimap in another repo:

1. Copy `package/minimap/` into that repo as `tools/minimap/`.
2. Copy `tools/minimap/templates/roadmap/` into that repo as `roadmap/`, or merge it into an existing roadmap root.
3. Optionally copy `tools/minimap/templates/roadmap.config.json` to the repo root as `roadmap.config.json` and set `roadmapPath`.
4. Run `node tools/minimap/server.js` from the host repo root.
5. Point the host repo agent instructions at `tools/minimap/SKILL.md`.

See `package/minimap/README.md` for package-focused setup and `package/minimap/CONTRACT.md` for the exact file contract.

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

## More Views

### Columns view

Columns view gives you a denser kanban-style layout over the same canonical data. Safe drag-and-drop actions update the roadmap files instead of creating a second board state.

![Minimap columns view](docs/images/minimap-board-columns.png)

### Item editor

Every item opens in read-first mode, then you can switch to structured editing for common fields or raw markdown when the repo uses a richer shape.

![Minimap editor view](docs/images/minimap-item-editor.png)
