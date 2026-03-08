# Minimap

Planning that lives with the repo.

Minimap is a tiny repo-local, file-based roadmap and feature planning workspace for humans and agents. It keeps roadmap state in normal repo files, gives humans a local UI, and lets agents work against the same canonical source of truth.

## Where It Came From

Minimap came out of a very practical loop.

I have a few projects that I build together with AI agents. In practice, roadmap management often turned into a repeated conversation pattern: we would work on a feature, I would ask the agent to update the roadmap, then later I would need to ask the agent again what was planned, what changed, or what was still next.

That worked, but it was too loose. I wanted more structure in how roadmap state is managed, and I also wanted a small local UI where I could see the roadmap directly instead of only through conversation with the agent.

Minimap is the result: a thin shared planning layer where humans and agents work against the same repo files.

## Why This Exists

Most planning tools force an awkward tradeoff:
- repo-native planning is flexible but messy to read and edit
- polished planning tools are easier for humans but detached from the repo and hard for agents to follow deterministically

Minimap is meant to stay in the middle:
- roadmap and feature planning live in normal repo files
- humans get a simple local UI over those files
- agents follow the same file contract and update the same state
- git stays the history

The goal is not to build another planning platform. The goal is to make repo-local planning easier to read, edit, and share without introducing a second system of record.

## What It Is Good For

Use minimap when you want a repo to carry its own roadmap and feature planning in a way that works for both humans and agents.

Typical use cases:
- keep roadmap state close to the code and specs it refers to
- let humans review and update roadmap items without hand-editing markdown every time
- let agents read and update planning state deterministically
- keep planning lightweight and git-native instead of pushing it into a separate tool

The current editor supports three complementary ways to work with an item:
- structured editing for common metadata and known sections
- preview mode for reading markdown as a document before saving
- raw mode for uncommon metadata, extra sections, or formatting that does not fit the structured editor

## Portable Package

A copy-in package is prepared at `package/minimap/`.

That folder is the portable bundle for other repos. It includes:
- the local app and server
- the minimap skill
- starter roadmap templates
- host-repo adoption docs
- a canonical minimap contract

To adopt minimap in another repo:

1. copy `package/minimap/` into that repo as `tools/minimap/`
2. copy `tools/minimap/templates/roadmap/` into that repo as `roadmap/` or merge it into an existing roadmap root
3. optionally copy `tools/minimap/templates/roadmap.config.json` to the repo root as `roadmap.config.json` and edit `roadmapPath`
4. run `node tools/minimap/server.js` from the host repo root
5. point the host repo agent instructions at `tools/minimap/SKILL.md`

See `package/minimap/README.md` for package usage and `package/minimap/CONTRACT.md` for the actual product and file contract.

## Run

The canonical minimap run command is the package entrypoint:

```bash
node package/minimap/server.js
```

This repo also provides a local shortcut:

```bash
npm start
```

Here, `npm start` just runs the same packaged server from the repo root. In a consuming repo, the equivalent command would be `node tools/minimap/server.js`.

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

## Canonical Ownership

- `board.md` owns group names and item order
- `scope.md` owns current-focus narrative
- `features/*.md` owns detailed committed or active work
- `ideas/*.md` owns detailed uncommitted ideas

Board headings are freeform and repo-defined. Repos can group items by status, release, milestone, team, stream, or any other planning model that fits the repo.

Item files use markdown with a small core of required frontmatter and sections, but they can also carry optional metadata such as `milestone` and additional markdown sections. Minimap preserves unknown frontmatter and extra sections, and raw mode gives you an escape hatch when a repo needs richer item files.

The UI does not store separate roadmap state.
