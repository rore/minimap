This repo now uses the roadmap workspace to plan the roadmap workspace itself.

Current focus:
- complete the self-hosting loop by adding item creation from the UI
- make first-run and setup recovery clearer for repos that do not yet have a valid roadmap workspace
- keep the authoring flow thin and file-canonical as we add the next write path

Concrete next steps:
- add item creation from the UI for features and ideas
- add setup guidance for empty or partially configured repos
- decide whether richer board management belongs in the core product or stays an idea

Recently completed:
- ship scope editing plus deeper board editing from the UI
- package the app so this repo dogfoods the same minimap bundle a consuming repo would copy in
- add preview, edit, and raw item modes without introducing hidden UI state
- define and hook up the separate agent operating rules for roadmap files

Still out of scope for this phase:
- git history and diff visualization
- custom schemas or arbitrary field builders
- multi-user coordination or remote sync
