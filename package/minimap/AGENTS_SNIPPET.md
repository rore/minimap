For spec/design review on a specific file, follow `~/.claude/skills/minimap-spec-review/SKILL.md`.
The skill is self-contained — it bundles its own server runtime and lifecycle scripts and works from any repo, including repos that do not host minimap.
Treat the attached file as canonical. Do not modify it unless the user explicitly applies a previewed suggestion.

For roadmap planning and roadmap file updates, follow `~/.claude/skills/minimap-roadmap/SKILL.md`.
The skill is self-contained on the same model as spec-review, and works on the active repo via the `#repo=...` URL convention.
Use the resolved roadmap root from `roadmap.config.json` when present; otherwise use `roadmap/`.
Treat minimap roadmap files as canonical. Do not create parallel roadmap trackers unless explicitly requested.
