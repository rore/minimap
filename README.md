# Minimap

A local workbench for collaboration on repo content — between humans, AI agents, and across multiple AI agents.

Minimap is a small local app that gives humans and AI agents a shared place to work on the same canonical text. Files are the truth. Git is the history. There is no hosted service, no database, no second source of state.

Minimap has two capabilities:

- **Spec sessions** — a global local workbench for collaborative review of one specific file: a spec, design doc, RFC, idea, or any text artifact. Multiple agents and humans can review the same file together: leaving anchored comments, replying to each other, proposing concrete edits, and converging on a final version. The target file is never modified unless a human explicitly applies a previewed change.
- **Roadmap** — a repo-local roadmap and feature-planning workspace backed by `roadmap/board.md`, `roadmap/scope.md`, and item files in `features/` and `ideas/`. A living plan that lives in the repo instead of in chat history.

Both capabilities share the same product shape: files are canonical, the UI is only a lens, the user is the merge authority. The same local server hosts both — toggle with the segmented control in the top right.

## The Problem

Iterating on a spec, design, or roadmap with AI agents tends to drift across chat threads:

- prompts, answers, critiques, and findings are copied between sessions
- agent feedback is buried in chat history and goes stale as the file changes
- multiple agents can't easily see — let alone build on — each other's review
- humans cannot easily steer agents with persistent comments outside chat
- final artifacts silently lose unresolved objections

Minimap replaces chat-as-coordinator with local shared session state that humans and agents can both read, write, and converge on. The artifact stays canonical; everything else (review, threading, proposed edits) lives around it.

## Spec Sessions

Spec sessions are the heart of minimap. They turn any text file in any repo into a multi-party review surface.

![Minimap spec sessions view](docs/images/minimap-spec-session.png)

### What A Session Is

A spec session attaches to one specific target file. The target file may live in any repo, including a work repo that doesn't have minimap installed. From the moment a session is attached, minimap tracks comments, replies, and proposed suggestions against that file in a global local store (`~/.minimap` on macOS/Linux, `%LOCALAPPDATA%/minimap` on Windows). The target file itself stays canonical and untouched.

A comment can be:
- **global** — applies to the whole file
- **section-anchored** — applies to a heading or section
- **quote-anchored** — applies to a precise sentence or passage

A suggestion is an executable proposed edit (replace / insert / delete) anchored to a specific quote. Suggestions are previewed as a diff before they are applied. Applying a suggestion is a deliberate user action — agents propose, humans apply.

Anchors are designed to survive small edits to the surrounding text. When an anchor becomes ambiguous or stale, minimap surfaces that state explicitly instead of silently re-attaching feedback to the wrong place.

### The Collaboration Workflow

Spec sessions are designed for the case where review is genuinely distributed across multiple participants:

**Human ↔ Agent:**

1. The human attaches a target file and asks an agent to review it.
2. The agent reads minimap context and the target file directly, then leaves anchored comments and concrete suggestions through minimap.
3. The human opens minimap, sees the agent's review next to the file, replies in-line, accepts or rejects suggestions, and previews the diff before applying anything.
4. The target file is only modified when the human explicitly applies a suggestion.

**Agent ↔ Agent:**

1. The human asks one agent (say Claude) to review the file. Claude leaves anchored comments and suggestions.
2. The human asks a second agent (say Codex) to review *Claude's review*: confirm what looks right, disagree where appropriate, add evidence, and propose alternative suggestions.
3. Each comment carries an explicit actor identity (`ai:claude`, `ai:codex`, `human:local`), so attribution is preserved in the persistent record.
4. Agents reply to each other's comments by id; threads accumulate concrete review state instead of evaporating with the chat session.
5. The human reads the converged review at the end, resolves what's settled, and applies the suggestions that survived scrutiny.

This is the workflow minimap was built for: **persistent, attributed, anchored review state that multiple agents and humans can build on, not a transient chat thread that has to be summarized by hand.**

### Why The Target File Stays Canonical

Spec sessions deliberately keep the work cheap and reversible:

- the target file lives in any repo and isn't modified by minimap
- session state lives in a local minimap home, not in the target repo
- the target file is the canonical artifact; minimap owns only the review and suggestion layer
- applying a suggestion is preview-first and explicit, recorded with before/after hashes

That means an agent can be invited to review a file with no risk of accidental edits, and a human can revisit a session weeks later and still see what was proposed, by whom, against what.

### Agent Hookup

Agents drive spec sessions through the bundled [`minimap-spec-review`](package/minimap/skills/minimap-spec-review/SKILL.md) skill, which includes a self-contained server runtime and a CLI launcher. The skill works from any work repo without copying minimap into that repo. Each agent uses an explicit identity on every write so multi-agent reviews stay attributable.

The deeper design — anchoring model, comment kinds and statuses, suggestion lifecycle, server API — lives in [`docs/global-spec-sessions-plan.md`](docs/global-spec-sessions-plan.md).

## Roadmap

The other capability minimap provides is a repo-local roadmap and feature-planning workspace. Where spec sessions are about converging on one file, the roadmap workspace is about keeping a living plan in the repo itself.

![Minimap roadmap view](docs/images/minimap-board-list.png)

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

For the full file contract — required and optional frontmatter, expected sections, board grouping rules, preservation rules — see [`package/minimap/CONTRACT.md`](package/minimap/CONTRACT.md). Agents drive the roadmap workspace through the [`minimap-roadmap`](package/minimap/skills/minimap-roadmap/SKILL.md) skill.

### Other Roadmap Views

Columns view gives the same canonical data a denser kanban-style layout. Drag-and-drop updates the roadmap files instead of creating a second board state.

![Minimap columns view](docs/images/minimap-board-columns.png)

Each item opens in `Read` mode by default. Switch to `Edit` for a structured form over the common metadata and known sections, or `Raw` for full-file editing when the repo uses a richer item shape. Markdown is allowed inside every section, and minimap preserves unknown frontmatter and extra sections instead of flattening them.

![Minimap editor view](docs/images/minimap-item-editor.png)

## Shared Principles

Both capabilities follow the same rules:

- **Files are canonical.** Roadmap files for the planning workspace; the attached target file for spec sessions. The UI never holds a second source of truth.
- **Local first.** No hosted service, no database, no sync layer. The roadmap workspace stores everything in the repo; spec sessions store collaboration state in a local minimap home.
- **Human-agent symmetry.** Humans use the UI; agents use skills and a CLI. Both update the same state.
- **Explicit attribution.** Every comment, suggestion, and applied edit carries the actor (`human:local`, `ai:claude`, `ai:codex`, …) so multi-party review stays accountable.
- **The user is the merge authority.** Agents propose; humans accept, reject, and apply.

## Why Not …

**Why not raw markdown files and chat?**
Markdown is a good canonical format and a poor live review surface. Chat is a fine collaboration medium and a terrible persistent record. Minimap keeps the canonical file canonical while turning the review around it into durable, attributed state.

**Why not GitHub PR review or code-review tools?**
Those work great for code that's already in PR shape. Minimap is for the iteration loop that comes earlier — converging on a spec or design with multiple agents and a human before there's even a PR to file, on files that may live anywhere.

**Why not a hosted spec/review tool?**
Spec sessions are deliberately local-only and machine-local. The target file never leaves the user's machine, and there's no shared server to manage or trust. The model also doesn't assume the reviewers are humans on a SaaS — agents are first-class participants.

**Why not GitHub Projects, Linear, or another PM tool for the roadmap part?**
Many agent-heavy repo workflows already keep planning in markdown and git. Minimap is for the case where you want planning to remain in-repo, visible, and editable without introducing a second planning system with its own hidden state.

## Best Fit

- Specs, designs, or RFCs that need careful review before they ship — especially across multiple agents.
- Multi-agent workflows where Claude, Codex, and humans iterate on the same artifact.
- Repos where roadmap or feature planning already lives in files.
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

Then open the URL printed by the server. It prefers `http://localhost:4312` and falls forward to the next free port if that one is busy. The same window hosts both Spec sessions and Roadmap; switch with the segmented control in the top right.

## Adopt The Package

The portable package lives in `package/minimap/`.

To use minimap in another repo:

1. Copy `package/minimap/` into that repo as `tools/minimap/`.
2. For the roadmap capability, copy `tools/minimap/templates/roadmap/` as `roadmap/` (or merge into an existing roadmap root). Optionally copy `tools/minimap/templates/roadmap.config.json` and set `roadmapPath`.
3. Run `node tools/minimap/server.js` from the host repo root.
4. Point the host repo's agent instructions at the relevant skill — `tools/minimap/skills/minimap-spec-review/SKILL.md` for spec review or `tools/minimap/skills/minimap-roadmap/SKILL.md` for roadmap work.

The spec-review skill is self-contained — it includes its own runtime and launcher scripts, so it can also be installed globally and used from work repos that do not contain minimap at all.

See [`package/minimap/README.md`](package/minimap/README.md) for package-focused setup and [`package/minimap/CONTRACT.md`](package/minimap/CONTRACT.md) for the roadmap file contract.

## Agent Integration

Both capabilities ship as named skills under `package/minimap/skills/`:

| Capability | Skill | When to use |
|---|---|---|
| Spec sessions | [`minimap-spec-review/SKILL.md`](package/minimap/skills/minimap-spec-review/SKILL.md) | Collaborating around one specific spec, idea, design, or text file across agents and repos. |
| Roadmap | [`minimap-roadmap/SKILL.md`](package/minimap/skills/minimap-roadmap/SKILL.md) | Reading, updating, or reorganizing roadmap state in a repo that uses the minimap roadmap convention. |

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
