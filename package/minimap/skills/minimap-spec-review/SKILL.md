---
name: minimap-spec-review
description: Use when reviewing or commenting on one specific markdown file (spec, design, RFC, idea, roadmap item) with anchored comments and proposed edits. Works from any repo, including repos without minimap.
---

# Minimap Spec Review

Attach one target file and track comments, replies, and proposed edits against it. The target file stays canonical; nothing is written to it unless the user explicitly applies a previewed suggestion.

Valid targets: any markdown file. When the target is a roadmap item, this skill complements [`minimap-roadmap`](../minimap-roadmap/SKILL.md).

## Quick Workflow

When the user asks to **view** a spec session, give them a URL. When they ask you to **drive** the review (read, comment, suggest), use the bundled CLI. Both paths share steps 1 and 2.

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

1. `minimap.mjs attach <file> --json`
2. `minimap.mjs context <file> --json`
3. Read the target file directly before substantive review.
4. Add comments, replies, or suggestions through minimap.
5. Preview suggestions before applying; apply only when the user explicitly asks.

For the full CLI grammar, read [references/cli.md](references/cli.md). For comment kinds and anchoring rules, read [references/review-workflow.md](references/review-workflow.md).

## Guardrails

- Do not assume the current repo contains minimap.
- Do not create minimap folders inside the work repo.
- Do not edit the target file unless the user explicitly asks.
- Prefer anchored comments over chat-only feedback.
- Treat the user as the merge authority.
- Do not curl the server, send signals, or edit `$MINIMAP_HOME/server.json` by hand. Use the bundled scripts only.
