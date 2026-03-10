This repo now uses the roadmap workspace to plan the roadmap workspace itself.

Product principles:
- keep the canonical minimap contract as small as possible
- make the UI adapt to repo structure that already exists instead of forcing one workflow model
- derive views, filters, and grouping from file metadata rather than hidden UI state
- preserve unknown frontmatter and markdown sections so repos can keep their own shape
- rely on agents only for the minimum normalization needed to make a repo minimap-compatible

Current focus:
- make minimap stronger as a human visibility and light-control tool over canonical roadmap files
- improve navigation and scanning before adding heavier authoring workflows
- keep edits thin, file-canonical, and generic across different repo structures

Concrete next steps:
- explore higher-level grouping only when repos already expose useful parent metadata
- keep the UI focused on scanning, lightweight control, and file-canonical editing
- keep improving overview density without turning the board into a heavy PM surface

Recently completed:
- ship alternate derived lenses over existing roadmap metadata without inventing a second board state
- ship better cards plus a read-first item review flow
- ship search plus dynamic filters over existing roadmap metadata
- make setup and empty-state behavior clearer for new or partially configured repos
- ship scope editing plus deeper board editing from the UI
- package the app so this repo dogfoods the same minimap bundle a consuming repo would copy in
- add read, edit, and raw item modes without introducing hidden UI state
- define and hook up the separate agent operating rules for roadmap files

Still out of scope for this phase:
- full human-first roadmap authoring as the primary workflow
- git history and diff visualization
- custom schemas or arbitrary field builders
- multi-user coordination or remote sync