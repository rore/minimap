# Repo-Local Roadmap UI

A local roadmap workspace where canonical files live in the repo and the UI is only a structured lens/editor over those files.

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

## Canonical Ownership

- `board.md` owns group names and item order
- `scope.md` owns current-focus narrative
- `features/*.md` owns detailed committed or active work
- `ideas/*.md` owns detailed uncommitted ideas

Board headings are freeform and repo-defined. Repos can group items by status, release, milestone, team, stream, or any other planning model that fits the repo.

The UI does not store separate roadmap state.
