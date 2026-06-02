---
name: minimap-spec-review
description: Use when collaborating around one specific spec, idea, design, or text file through global minimap spec sessions, especially across multiple agents or repos that do not host minimap. Includes a self-contained minimap runtime for starting the local server, attaching a file, reading context, and adding anchored comments without editing the canonical file.
---

# Minimap Spec Review

## Intent

Use minimap as a global local coordinator for review and ideation around one target file.

The target file stays canonical and keeps its own structure. Minimap owns only the collaboration layer: session identity, comments, replies, anchors, status, and UI state.

Valid targets include any markdown spec, design doc, idea, or roadmap item file (`roadmap/features/<id>.md`, `roadmap/ideas/<id>.md`). When the target is a roadmap item, this skill complements [`minimap-roadmap`](../minimap-roadmap/SKILL.md): the roadmap skill manages planning state, this skill manages the conversation around the item's content.

## Quick Workflow

When the user asks to view a spec session for a file, give them a URL. When they ask you to drive the review (read context, leave comments, propose suggestions), use the bundled CLI. The two paths share steps 1 and 2.

### 1. Identify the exact target file

The target may be any markdown spec, design doc, idea, or roadmap item file. Resolve it to an absolute path before the next step.

### 2. Make sure the server is running

```bash
node <path-to-this-skill>/scripts/start-server.mjs
```

Output is one line, either `Minimap running at http://localhost:<port>` (just started) or `Minimap already running at http://localhost:<port>` (reused). Capture the port — the default is 4312 but the launcher falls forward if busy. To check status, stop, or restart, use the matching scripts in the same directory (`status.mjs`, `stop-server.mjs`, `restart-server.mjs`). Do not curl the server, send signals, or edit `$MINIMAP_HOME/server.json` by hand.

### 3a. Showing the spec session to the user

Attach the file and reply with the URL:

```bash
node <path-to-this-skill>/scripts/minimap.mjs attach <absolute-file-path> --json
```

Then give the user:

```text
http://localhost:<port>/#view=spec&file=<absolute-file-path>
```

Use forward slashes in the path even on Windows (`C:/foo/bar.md`); they work cross-platform and avoid the URL-encoding complications of backslashes. If the path contains spaces, `&`, `=`, or `#`, URL-encode the whole path with `encodeURIComponent`.

The user opens the URL and reads or replies in the UI. They don't need to know about the server, the port-fallback, or the registry.

### 3b. Driving the review yourself

Use the bundled CLI for read-and-write operations. After step 2:

1. Attach the target file:
   `node <path-to-this-skill>/scripts/minimap.mjs attach <file> --json`
2. Read context:
   `node <path-to-this-skill>/scripts/minimap.mjs context <file> --json`
3. Read the target file directly before substantive review.
4. Add comments, replies, or suggestions through minimap.
5. Preview suggestions before applying them, and apply only when the user explicitly asks.

## Load More When Needed

- For server startup, health checks, and UI URLs, read [references/server.md](references/server.md).
- For the full command contract, read [references/cli.md](references/cli.md).
- For review rules, comment kinds, and anchoring guidance, read [references/review-workflow.md](references/review-workflow.md).

## Guardrails

- Do not assume the current repo contains minimap.
- Do not create minimap folders inside the work repo.
- Do not edit the target file unless the user explicitly asks.
- Prefer anchored comments over chat-only feedback for specific passages.
- Use suggestions for exact proposed file edits; use comments for discussion, risks, questions, or instructions.
- Treat the user as the merge authority.
