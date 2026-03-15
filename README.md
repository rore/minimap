# Minimap

Planning that lives with the repo, not in chat history.

Minimap is a local UI for repo roadmap files. It lets humans and AI agents plan against the same canonical markdown instead of scattering roadmap state across chat threads, ad hoc docs, and separate PM tools.

In practice, that usually means an agent drafts or updates roadmap state through normal repo conversations, then a human opens minimap to review the board, scope, and item detail together, make any needed corrections, and commit the resulting markdown changes. The files stay canonical and git stays the history.

This repo dogfoods the packaged app in `package/minimap/`, so the screenshots below are the real product as it exists here today.

## Why Use It

Minimap is for the common case where roadmap state starts drifting across chat threads, markdown files, and ad hoc planning docs.

It gives you a lightweight middle ground:

- roadmap state stays in the repo instead of disappearing into chat history
- agents can draft and update features, scope, and roadmap items through normal conversations
- humans get a local UI to review what the agent wrote, understand the current plan, and adjust it if needed
- both sides work against the same canonical files instead of a second hidden system
- repo-specific structure still works without forcing a heavy PM tool or custom backend

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

## What It Looks Like

### Scan the roadmap without losing context

List view keeps the board, the selected item, and the current scope visible at the same time. It is the best default when you want to review work before changing it.

![Minimap list view](docs/images/minimap-board-list.png)

### Switch to a denser board when you need movement

Columns view gives you a compact kanban-style layout over the same canonical data. Safe drag-and-drop actions update the roadmap files instead of creating a second board state.

![Minimap columns view](docs/images/minimap-board-columns.png)

### Edit the canonical file without fighting the repo

Every item opens in read-first mode, then you can switch to structured editing for common fields or raw markdown when the repo uses a richer shape.

![Minimap editor view](docs/images/minimap-item-editor.png)

## Why Not Just Markdown Or GitHub Projects?

Why not just markdown files?

Because raw files are a good canonical format, but a poor live planning surface. Minimap keeps markdown as the source of truth while making it much easier to review, navigate, regroup, and lightly edit roadmap state.

Why not just ask the agent for a summary when needed?

Because summaries are helpful, but they are ephemeral. Minimap gives the human a stable visible view over the actual files the agent wrote, so the shared roadmap does not depend on reconstructing state from a conversation.

Why not GitHub Projects, Linear, or another PM tool?

Because many agent-heavy repo workflows already keep planning in markdown and git. Minimap is for the case where you want that planning to remain in-repo, visible, and editable without introducing a second planning system with its own hidden state.

## What You Get

- A fast human review layer over roadmap files the agent wrote.
- One visible source of truth in the repo instead of split state across chat and docs.
- Lightweight editing without abandoning markdown as the canonical format.
- Search, filters, regrouping, and multiple browse layouts over metadata the repo already has.
- No database, sync layer, or UI-only board state.
- A portable package you can copy into another repo.

## How It Works

Minimap keeps one rule strict: the files are the source of truth.

- `board.md` owns groups and item order
- `scope.md` owns the current-focus narrative
- `features/*.md` owns committed or active work
- `ideas/*.md` owns uncommitted or parked work

The UI is a structured lens over those files. Git is the history. There is no database, remote sync layer, or hidden UI-only roadmap state.

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

## Portable Package

The portable package lives in `package/minimap/`.

To adopt minimap in another repo:

1. Copy `package/minimap/` into that repo as `tools/minimap/`.
2. Copy `tools/minimap/templates/roadmap/` into that repo as `roadmap/`, or merge it into an existing roadmap root.
3. Optionally copy `tools/minimap/templates/roadmap.config.json` to the repo root as `roadmap.config.json` and set `roadmapPath`.
4. Run `node tools/minimap/server.js` from the host repo root.
5. Point the host repo agent instructions at `tools/minimap/SKILL.md`.

See `package/minimap/README.md` for package-focused setup and `package/minimap/CONTRACT.md` for the exact file contract.

## Run Locally

The canonical entrypoint in this repo is:

```bash
node package/minimap/server.js
```

This repo also provides a shortcut:

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

