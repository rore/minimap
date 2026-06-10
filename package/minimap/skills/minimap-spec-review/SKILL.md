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

The CLI ([references/cli.md](references/cli.md)) and the HTTP API ([references/http.md](references/http.md)) reach the same server code (anchor cascades, markdown tolerance, idempotency). Pick whichever fits — most agents use the CLI.

Standard flow:

1. `minimap.mjs attach <file> --json`
2. `minimap.mjs context <file> --json --summary` — compact scan of unresolved items + a counts block; the right first call for "where am I in this review?". Use `--filter all` (with or without `--summary`) for the full picture, or no flags for the raw shape.
3. Read the target file directly before substantive review.
4. Add comments, replies, or suggestions. For multi-line content (backticks, em-dashes, embedded newlines), use `--json-stdin` and pipe the JSON body — inline `--text` survives only trivial single-line strings. When the same quote appears more than once and `anchor_ambiguous` comes back, read the file to find the line of the occurrence you mean, then retry with `--line-start N --line-end N` (line range) or `--quote-offset N` (exact char offset) — both work inline and via `--json-stdin`.
5. Preview suggestions before applying; apply only when the user explicitly asks.

If `node ...` fails to spawn (sandbox restriction — `CreateProcessWithLogonW failed`, `EACCES`, etc.), [references/cli.md](references/cli.md) has shell-fallback patterns; if those also fail, drop to the HTTP API. **Use only the documented HTTP routes from [references/http.md](references/http.md) — for example, comments are created at `POST /api/spec-sessions/by-file/comments`, not `/api/comment`. Don't guess endpoint names.** For comment kinds and anchoring rules, see [references/review-workflow.md](references/review-workflow.md).

## Guardrails

- Use the documented routes — either the CLI commands or the HTTP routes in [references/http.md](references/http.md). Don't invent endpoint names; the reply route is singular `/reply`, not `/replies`.
- Do not assume the current repo contains minimap.
- Do not create minimap folders inside the work repo.
- Do not edit the target file unless the user explicitly asks.
- Prefer anchored comments over chat-only feedback.
- Treat the user as the merge authority.
- Do not edit `$MINIMAP_HOME/server.json` by hand or send process signals to the server. Use the bundled scripts (`start-server.mjs`, `restart-server.mjs`, `stop-server.mjs`).
