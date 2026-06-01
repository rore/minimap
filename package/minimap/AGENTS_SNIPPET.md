Minimap is a local workbench for repo planning and spec review.

For roadmap planning and roadmap file updates, follow `tools/minimap/skills/minimap-roadmap/SKILL.md`.
Use the resolved roadmap root from `roadmap.config.json` when present; otherwise use `roadmap/`.
Treat minimap roadmap files as canonical. Do not create parallel roadmap trackers unless explicitly requested.

For spec/design review on a specific file, follow `tools/minimap/skills/minimap-spec-review/SKILL.md`.
The spec-review skill is self-contained and works from any repo, including repos that do not host minimap.
Treat the attached file as canonical. Do not modify it unless the user explicitly applies a previewed suggestion.
