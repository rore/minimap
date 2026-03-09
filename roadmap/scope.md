This repo now uses the roadmap workspace to plan the roadmap workspace itself.

Current focus:
- make minimap stronger as a human visibility and light-control tool over canonical roadmap files
- improve navigation and scanning before adding heavier authoring workflows
- keep edits thin, file-canonical, and generic across different repo structures

Concrete next steps:
- add search and dynamic filters over existing roadmap metadata
- make setup and empty-state behavior clearer for new or partially configured repos
- improve browse quality with better cards, preview, and alternate derived lenses

Recently completed:
- ship scope editing plus deeper board editing from the UI
- package the app so this repo dogfoods the same minimap bundle a consuming repo would copy in
- add preview, edit, and raw item modes without introducing hidden UI state
- define and hook up the separate agent operating rules for roadmap files

Still out of scope for this phase:
- full human-first roadmap authoring as the primary workflow
- git history and diff visualization
- custom schemas or arbitrary field builders
- multi-user coordination or remote sync