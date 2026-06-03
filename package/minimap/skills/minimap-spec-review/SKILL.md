---
name: minimap-spec-review
description: Use when reviewing or commenting on one specific markdown file (spec, design, RFC, idea, roadmap item) with anchored comments and proposed edits. Works from any repo, including repos without minimap.
---

# Minimap Spec Review

Attach one target file and track comments, replies, and proposed edits against it. The target file stays canonical; nothing is written to it unless the user explicitly applies a previewed suggestion.

Valid targets: any markdown file. When the target is a roadmap item, this skill complements [`minimap-roadmap`](../minimap-roadmap/SKILL.md).

## Quick Workflow

When the user asks to **view** a spec session, give them a URL. When they ask you to **drive** the review (read, comment, suggest), use the bundled CLI or the HTTP API directly — they hit the same code, including anchor cascades and markdown tolerance. Both paths share steps 1 and 2.

### 1. Resolve the target file to an absolute path

### 2. Make sure the server is running

```bash
node <path-to-this-skill>/scripts/start-server.mjs
```

The launcher prints one line: `Minimap running at http://localhost:<port>` (just started) or `Minimap already running at http://localhost:<port>` (reused). Capture the port — default 4312, falls forward if busy.

For status / stop / restart, see [references/server.md](references/server.md).

### 3a. Showing the session

Attach, then reply with the URL:

```bash
node <path-to-this-skill>/scripts/minimap.mjs attach <absolute-file-path> --json
```

```text
http://localhost:<port>/#view=spec&file=<absolute-file-path>
```

Use forward slashes in the path even on Windows (`C:/foo/bar.md`). If the path contains spaces, `&`, `=`, or `#`, URL-encode it with `encodeURIComponent`.

### 3b. Driving the review

Two equivalent ways to drive the review — both reach the same server code:

- **CLI** ([references/cli.md](references/cli.md)) — easiest for short, single-line `--text` / `--quote` values. For multi-line content (backticks, em-dashes, embedded newlines), use the CLI's `--json-stdin` mode and pipe the JSON body on stdin.
- **HTTP** ([references/http.md](references/http.md)) — POST JSON directly with `curl --data @-` and a single-quoted heredoc. Same anchor rules, same error codes.

The standard flow:

1. `minimap.mjs attach <file> --json` (or `POST /api/spec-sessions/attach`)
2. `minimap.mjs context <file> --json` (or `GET /api/spec-sessions/by-file/context?path=...`)
3. Read the target file directly before substantive review.
4. Add comments, replies, or suggestions.
5. Preview suggestions before applying; apply only when the user explicitly asks.

For comment kinds and anchoring rules, read [references/review-workflow.md](references/review-workflow.md).

## Guardrails

- Use the documented routes — either the CLI commands or the HTTP routes in [references/http.md](references/http.md). Don't invent endpoint names; the reply route is singular `/reply`, not `/replies`.
- Do not assume the current repo contains minimap.
- Do not create minimap folders inside the work repo.
- Do not edit the target file unless the user explicitly asks.
- Prefer anchored comments over chat-only feedback.
- Treat the user as the merge authority.
- Do not edit `$MINIMAP_HOME/server.json` by hand or send process signals to the server. Use the bundled scripts (`start-server.mjs`, `restart-server.mjs`, `stop-server.mjs`).
