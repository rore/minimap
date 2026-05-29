# AGENTS.md

For roadmap planning and roadmap file updates in this repo, follow `package/minimap/SKILL.md`.

This repo dogfoods the packaged minimap app and file convention, so roadmap changes should treat the roadmap files as canonical and keep behavior aligned with the minimap contract.

When changing spec-session behavior, commands, APIs, or UI, also update the packaged `minimap-spec-review` skill and its self-contained runtime/docs in `package/minimap/skills/minimap-spec-review/`. Do not finish or commit spec-session changes while the skill contract is stale.
