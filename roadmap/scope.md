This repo now uses the roadmap workspace to plan the roadmap workspace itself.

Current focus:
- complete the self-hosting loop so the app can manage more of its own roadmap files
- eliminate the remaining cases where roadmap authors must edit raw markdown by hand for normal roadmap work
- keep the UI thin and file-canonical while we add the next write paths

Concrete next steps:
- add item creation from the UI for features and ideas
- add scope editing plus deeper board editing from the UI
- add setup guidance for empty or partially configured repos

Recently completed:
- package the app so this repo dogfoods the same minimap bundle a consuming repo would copy in
- add preview, edit, and raw item modes without introducing hidden UI state
- define and hook up the separate agent operating rules for roadmap files

Still out of scope for this phase:
- git history and diff visualization
- custom schemas or arbitrary field builders
- multi-user coordination or remote sync
