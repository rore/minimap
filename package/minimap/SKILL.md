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

  Follow [`skills/minimap-spec-review/SKILL.md`](skills/minimap-spec-review/SKILL.md). The skill is self-contained and bundles its own server runtime and CLI launcher.

## Why The Split

Roadmap work updates files inside the host repo and treats those files as canonical. Spec sessions attach to one external target file, store collaboration state in a global local minimap home, and never modify the target file unless the user explicitly applies a previewed suggestion. The two flows have different ownership and different guardrails, so they live as separate skills with separate references.

Use whichever skill fits the task. Do not use the roadmap skill for arbitrary spec review, and do not use the spec-review skill to mutate roadmap files.
