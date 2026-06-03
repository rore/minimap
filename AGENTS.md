# AGENTS.md

This repo dogfoods the packaged minimap app. Minimap exposes two capabilities, each shipped as a self-contained skill with its own bundled runtime and lifecycle scripts:

- For roadmap planning and roadmap file updates in this repo, follow [`package/minimap/skills/minimap-roadmap/SKILL.md`](package/minimap/skills/minimap-roadmap/SKILL.md). Treat the roadmap files as canonical and keep behavior aligned with the minimap roadmap contract in [`package/minimap/CONTRACT.md`](package/minimap/CONTRACT.md).
- For spec/design review on a specific file, follow [`package/minimap/skills/minimap-spec-review/SKILL.md`](package/minimap/skills/minimap-spec-review/SKILL.md). The skill works from any repo.

## Server lifecycle — use the packaged scripts only

All server interaction goes through scripts in `<skill>/scripts/`:

- `start-server.mjs` — start (or detect + reuse a running instance)
- `status.mjs` — print status; exit 0 running, 1 stale, 3 not running
- `stop-server.mjs` — graceful shutdown via `POST /api/shutdown`; cleans stale registry
- `restart-server.mjs` — compose stop + start

**Do not** curl the server directly, send signals to it (`process.kill`, `taskkill`), poke `$MINIMAP_HOME/server.json` by hand, or invoke `node package/minimap/server.js` directly. The scripts handle every state (running, stale registry, port busy, race with another launcher) and stay correct on Windows where signal-based stop is unreliable.

A single running server transparently serves both modes for any number of repos. The launchers detect an already-running instance via `$MINIMAP_HOME/server.json` + `/health` and reuse it.

## Tri-tree sync

Top-level `package/minimap/` is the source of truth. After any change to server, CLI, API, UI, or scripts, run:

```
node scripts/sync-mirrors.mjs
```

It rewrites both runtime trees (`package/minimap/skills/minimap-roadmap/runtime/` and `package/minimap/skills/minimap-spec-review/runtime/`) from the top-level files. The unit test `test/sync-mirrors.test.js` runs the script and re-verifies byte-identity in CI; `test/roadmap.test.js`'s portability test additionally guards against any runtime/ tree introducing install-time dependencies (skills install via copy, never `npm install`).

**Do not** hand-edit files under `package/minimap/skills/*/runtime/` — they are derived. Edit the top-level copy and run the sync script.

## Skill-doc drift check — after every behavior change

Behavior changes ship in code + tests, but the prose docs under `package/minimap/skills/*/SKILL.md` and `package/minimap/skills/*/references/*.md` describe that same behavior to agents. Tri-tree sync only handles `runtime/` byte-identity; skill docs are not auto-synced and silently rot. Caught real drift twice in one session: the apply-cascade was widened from exact-quote to range-overlap (commit `e0456c6`) but `references/http.md` still claimed exact-quote; `--json-stdin` made the CLI multi-line-capable but `references/http.md` still framed CLI as "single-line text only."

**Before declaring a behavior change done, grep the skill docs for the OLD behavior's keywords:**

```bash
# After changing the cascade, anchor logic, status semantics, etc.:
grep -rn "<old-behavior-phrase>" package/minimap/skills/*/SKILL.md package/minimap/skills/*/references/

# Sanity sweeps that catch most drift:
grep -rn "exact quote\|same quote\|same old quote" package/minimap/skills/
grep -rn "single-line\|short.*--text\|--text-file\|--quote-file" package/minimap/skills/
```

If the grep finds anything, fix it in the same change set as the behavior. The drift is invisible until a future agent reads the doc and follows the wrong rule, which makes it the kind of bug that survives review (the doc lives in a different file than the code) but stings every agent reading the contract.

This applies to changes in: anchor cascades, comment/suggestion shapes, CLI flag semantics, HTTP route bodies/responses, error codes, server lifecycle. It does NOT apply to UI-only changes that don't reach the documented surface (DOM rendering, layout, etc.).

## Frontend module map

`ui/index.html` loads `app.js` as a native ES module. App.js imports leaf modules directly; the static server serves whatever path the import asks for, so no bundler.

| Module | Concern | DOM-touching? | Tests |
|---|---|---|---|
| `ui/api.js` | Single fetch wrapper + every HTTP endpoint as a typed-ish method (`api.loadWorkspace`, `api.saveItem`, etc.). Sets `X-Minimap-Repo` only on roadmap endpoints. | No | `test/ui-api.test.js` |
| `ui/state.js` | `createState({ overrides })` returning `{ get, set, update, subscribe }`. `app.js` aliases `state = stateContainer.get()` so existing direct mutation continues to work. | No | `test/ui-state.test.js` |
| `ui/markdown.js` | Hand-rolled markdown→HTML renderer. Pure string in / string out. | No | `test/ui-markdown.test.js` |
| `ui/filters.js` | Pure board filter / lens / group derivation. State-aware shims (`itemMatchesCurrentFilters`, `getFilteredBoardItemIds`, `getVisibleBoardGroups`) stay in `app.js` and delegate here. | No | `test/ui-filters.test.js` |
| `ui/spec/anchors.js` | Pure offset / text-mapping helpers (whitespace map, rendered selection → source quote, etc.). The state-aware wrappers live in `app.js`. | No | `test/ui-spec-anchors.test.js` |
| `ui/spec/render.js` | Spec doc render, comment & suggestion cards, margin layout, anchor decoration, participants. Initialized via `wireSpecRender({ dom, state, api, helpers })`. | Yes | Playwright |
| `ui/spec/composer.js` | Comment + suggestion form composer, selection-toolbar, anchor-mode UI, suggestion preview/apply/rollback callbacks. Initialized via `wireSpecComposer({ dom, state, api, helpers })`. | Yes | Playwright |
| `ui/spec/index.js` | Single-call aggregator. Exports `initSpec({ dom, state, api, helpers })` that wires render + composer in one shot. App.js imports leaf modules directly for everything else; only the wire call goes through here. | No | Covered transitively |
| `ui/app.js` | Roadmap-side render, board edit / drag / drop, scope panel, item editor, route hash, setup view, top-level event wiring, init. | Yes | Playwright |

DOM-touching modules are exercised end-to-end via Playwright (`playwright/roadmap-ui.spec.js`). Pure-logic modules have `node --test` units that run in milliseconds.

## Backend module map

| File | Concern | Tests |
|---|---|---|
| `package/minimap/server.js` | HTTP listener. `handleApi` dispatches via a `routes` table (`[{method, pattern, handler}]`) using `matchRoute` from `src/router.js`. Helpers `withJsonBody` and `requireFileFromBody` factor out body validation. | `test/roadmap.test.js`, `test/server-router.test.js` |
| `package/minimap/src/router.js` | `matchRoute(routes, method, pathname)` — pure, exported, unit-tested. Imported by both the test and `server.js`. | `test/server-router.test.js` |
| `package/minimap/src/roadmap.js` | Workspace parsing/serialization, board ↔ item logic, frontmatter handling, lens derivation. Pure-functional core. | `test/roadmap.test.js` |
| `package/minimap/src/sessions.js` | Spec session storage (per-file JSONL files), comment + suggestion lifecycle, anchor resolution cascade, suggestion apply/rollback with `writeAllOrNothing` for atomic-ish multi-file writes. | `test/roadmap.test.js`, `test/sessions-atomic.test.js` |
| `package/minimap/src/server-registry.js` | $MINIMAP_HOME/server.json reader / writer. | `test/roadmap.test.js` |

## UI conventions

- **Every `void api.foo(...)` call MUST be followed by `.catch(...)`.** Wrappers like `persistGroupOrder` / `loadWorkspace` / `saveCurrentItem` already do `try { await api.foo() } catch (e) { setBanner(e.message, "error") }` internally, so `void persistGroupOrder()` is fine — the wrapper has the catch. The lint test `test/ui-lint-promises.test.js` enforces this for bare `api.*` call sites.
- **Spec subsystem extension:** add new render functions to `ui/spec/render.js` and new composer/form functions to `ui/spec/composer.js`. Use the captured `DOM`, `STATE`, `API`, `HELPERS` bindings rather than re-querying. New DOM elements need an entry in the `dom: {...}` object passed to `initSpec` in `app.js`.
