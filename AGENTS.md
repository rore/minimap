# AGENTS.md

This repo dogfoods the packaged minimap app. Minimap exposes two capabilities, each with its own skill:

- For roadmap planning and roadmap file updates in this repo, follow [`package/minimap/skills/minimap-roadmap/SKILL.md`](package/minimap/skills/minimap-roadmap/SKILL.md). Treat the roadmap files as canonical and keep behavior aligned with the minimap roadmap contract in [`package/minimap/CONTRACT.md`](package/minimap/CONTRACT.md).
- For spec/design review on a specific file, follow [`package/minimap/skills/minimap-spec-review/SKILL.md`](package/minimap/skills/minimap-spec-review/SKILL.md). The skill is self-contained and works from any repo.

When changing spec-session behavior, commands, APIs, or UI, also update the packaged `minimap-spec-review` skill and its self-contained runtime/docs in [`package/minimap/skills/minimap-spec-review/`](package/minimap/skills/minimap-spec-review/). Do not finish or commit spec-session changes while the skill contract is stale.
