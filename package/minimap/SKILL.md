---
name: minimap
description: Top-level entry point for minimap. Use this to choose between the two minimap capabilities. For roadmap planning and roadmap file updates use `minimap-roadmap`. For collaborative review of one specific spec/design/idea file use `minimap-spec-review`.
---

# Minimap

Minimap is a local workbench for repo planning and spec review. It exposes two capabilities, each with its own skill.

## Choose A Skill

- **Roadmap** — reading, updating, or reorganizing roadmap state in a repo that uses the minimap roadmap convention (`board.md`, `scope.md`, `features/`, `ideas/`).

  Follow [`skills/minimap-roadmap/SKILL.md`](skills/minimap-roadmap/SKILL.md). The package-level roadmap contract lives in [`CONTRACT.md`](CONTRACT.md).

- **Spec sessions** — collaborating around one specific spec, idea, design, or text file, especially across multiple agents or repos that do not host minimap.

  Follow [`skills/minimap-spec-review/SKILL.md`](skills/minimap-spec-review/SKILL.md).

Both skills are self-contained: each bundles its own server runtime, lifecycle scripts (`start-server.mjs`, `status.mjs`, `stop-server.mjs`, `restart-server.mjs`), and CLI launcher. A single running server is shared across both skills and across any number of repos.

## Why The Split

Roadmap work updates files inside the host repo and treats those files as canonical. Spec sessions attach to one external target file, store collaboration state in a global local minimap home, and never modify the target file unless the user explicitly applies a previewed suggestion. The two flows have different ownership and different guardrails, so they live as separate skills with separate references.

## How They Compose

The two skills are not mutually exclusive — they layer. A roadmap item is just a markdown file: `roadmap/features/<id>.md` or `roadmap/ideas/<id>.md`. To collaborate around one specific item's content (comments, suggestions, anchored discussion), attach that file as a spec session. The roadmap skill keeps managing the file's role in planning (status, board placement, scope); the spec-review skill manages the conversation around its content. Spec sessions never auto-mutate the file, so layering is safe.

Use `minimap-roadmap` to plan, prioritize, and update roadmap state. Use `minimap-spec-review` for review threads on a specific spec, design, or roadmap item file.
