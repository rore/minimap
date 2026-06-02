---
name: minimap-spec-review
description: Use when collaborating around one specific spec, idea, design, or text file through global minimap spec sessions, especially across multiple agents or repos that do not host minimap. Includes a self-contained minimap runtime for starting the local server, attaching a file, reading context, and adding anchored comments without editing the canonical file.
---

# Minimap Spec Review

## Intent

Use minimap as a global local coordinator for review and ideation around one target file.

The target file stays canonical and keeps its own structure. Minimap owns only the collaboration layer: session identity, comments, replies, anchors, status, and UI state.

## Quick Workflow

1. Identify the exact target file.
2. Start or verify the bundled server:
   `node <path-to-this-skill>/scripts/start-server.mjs`
   To check status, stop, or restart, use the matching scripts in the same directory (`status.mjs`, `stop-server.mjs`, `restart-server.mjs`). Do not curl the server, send signals, or edit `$MINIMAP_HOME/server.json` by hand.
3. Attach the file:
   `node <path-to-this-skill>/scripts/minimap.mjs attach <file> --json`
4. Read context:
   `node <path-to-this-skill>/scripts/minimap.mjs context <file> --json`
5. Read the target file directly before substantive review.
6. Add comments, replies, or suggestions through minimap.
7. Preview suggestions before applying them, and apply only when the user explicitly asks.

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
