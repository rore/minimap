---
id: feature-spec-sessions
title: Spec sessions — global, file-attached review workbench
status: done
priority: high
commitment: committed
labels:
  - foundation
  - spec-sessions
  - review
---

## Summary

A global, machine-local workbench that attaches to one arbitrary text/spec file in any repo and coordinates review and suggestion edits between the user and one or more agents. The target file stays in its original repo; comments, suggestions, replies, anchors, and events live in minimap's global local store. The target file changes only when the user explicitly applies a previewed suggestion.

## Why

Iterating on specs across agents was too manual: prompts, critiques, and findings copied between sessions; agent feedback buried in chat history; line-anchored comments going stale as the spec changed; multiple agents unable to easily review each other's input; humans unable to steer agents with persistent comments outside chat. The goal was to replace chat-as-coordinator with local shared session state that agents and the user can both read and update — without forcing the work repo to adopt minimap.

## In Scope

- one target file maps to one minimap session, identified by normalized absolute path
- `minimap attach <file>` is required before comments or suggestions can be added
- comments support `global`, `section`, and `anchor` scopes with one level of replies
- suggestions support `replace`, `insert_after`, and `delete` with preview-before-apply
- resilient anchors store quote, heading path, line range, selected hash, and file hash; resolution is classified `resolved` / `ambiguous` / `stale` / `orphaned`
- agents may create comments and suggestions but may not apply suggestions
- the human UI may create and apply a suggestion in one preview-confirmed flow
- the same minimap local server handles both roadmap mode and spec sessions
- session metadata + counts available to the file list without loading full context
- replies on suggestions
- rollback of an applied suggestion (revert the file edit, restore status to pending)

## Out of Scope

- remote hosting or shared multi-user state — sessions are local-only and machine-local
- writing any minimap metadata into the work repo by default
- agents invoking other agents through minimap
- full target-file snapshots stored by default
- separate decision / evidence / open-question / review entities (until a real workflow demands them)
- archive lifecycle for sessions
- realtime collaboration

## Done When

- a file in a repo without minimap can be attached
- minimap stores session state outside the target repo (`%LOCALAPPDATA%/minimap` on Windows, `~/.minimap` on macOS/Linux; `MINIMAP_HOME` overrides for tests)
- the UI lists recent file sessions, shows the attached file, and renders Markdown when applicable
- the user can create global, section, and anchored comments
- an agent can add comments and suggestions through minimap; another agent can reply or disagree
- the user can accept, reject, preview, apply, or roll back a suggestion
- applying a suggestion modifies only the target file after explicit confirmation
- replying to a suggestion works the same as replying to a comment
- broken anchors after applies are surfaced and the conversation moves with re-anchored content where possible

## Notes

Implemented and live. The CLI, server API, and UI all participate. The agent-facing skill `package/minimap/skills/minimap-spec-review/SKILL.md` documents how agents identify sessions by file path, attach, and write through the API with explicit `--by` actor on every mutation.

The full design — anchoring algorithm, comment kinds and statuses, suggestion lifecycle, server API surface, agent identity rules, implementation phases — is preserved below as `## Design Detail`. It's reference material rather than working spec; current behavior may have evolved past some of the original phasing.

## Design Detail

### Intent

Build a globally installed minimap workflow for iterating on ideas and specs across agents.

The target use case is a user working in any repo, including work repos that do not have minimap installed, and explicitly attaching minimap to an existing text/spec file such as `docs/my-new-feature.md`.

Minimap acts as a local global coordinator for collaboration around that file. The target file stays in its original repo and keeps its own structure. Comments, suggestions, replies, anchor metadata, and operational events live in minimap's global local store. The target file changes only when the user explicitly applies a previewed suggestion.

### Core Product Shape

Minimap has two complementary modes:

- Roadmap mode: the existing repo-local roadmap file convention.
- Spec session mode: a global local workbench that attaches to one arbitrary text file in any repo.

In spec session mode:

- one target file maps to one minimap session
- the attached file is the canonical artifact being converged
- minimap does not impose any document structure on the target file
- minimap owns only the review and suggestion layer
- the work repo does not need minimap files
- the work repo is not modified unless the user explicitly applies a suggestion
- agents interact with minimap through a global skill, CLI, local server API, or MCP integration
- minimap does not invoke agents

### Key Decisions

- There is no global "active session" in the product model.
- Sessions are file-first. Commands and APIs should normally identify sessions by target file path.
- `minimap attach <file>` is required before comments or suggestions can be added for that file.
- `attach` is idempotent: it creates the file session if missing and reopens the existing session if present.
- MVP supports exactly one target file per session.
- Sessions are local-only and machine-local.
- Sessions persist on disk and are loaded on demand.
- No archive lifecycle is needed in MVP.
- `lastActiveAt` is updated on attach/reopen and write actions, not on read-only context calls.
- No full target-file snapshots are stored by default.
- No separate decision, evidence, open-question, review, or agent-run entities in MVP.
- Comments and suggestions are separate first-class entities.
- Human comments and human suggestions are first-class.
- Agents can create comments and suggestions, but cannot apply suggestions.
- Human UI can create and apply a suggestion in one preview-confirmed flow.
- Applying a suggestion is preview-first: minimap shows the exact diff before writing the target file.
- The same minimap local server handles both roadmap mode and global spec sessions.
- Server security posture stays the same as existing minimap local server behavior.

### Why This Exists

The current workflow for iterating on ideas and specs across agents is too manual:

- prompts, answers, critiques, and repo findings are copied between sessions
- agent feedback is buried in chat history
- comments on specific lines become stale as the spec changes
- multiple agents cannot easily review each other's comments
- humans cannot easily steer agents with persistent comments outside chat
- final specs can silently lose unresolved objections

The goal is to replace chat-as-coordinator with local shared session state that agents and the user can both read and update.

### Global Coordinator

The existing minimap server should also serve as the global local coordinator for spec sessions.

It is responsible for:

- creating and listing file sessions
- attaching a session to a target file
- reading target file metadata and hashes
- validating anchored comments and suggestions
- storing comments, suggestions, replies, and operational events
- resolving anchors after target files change
- tracking stale or orphaned anchors
- rendering file-session state in the UI
- applying confirmed suggestions back to target files

The server is not a second source of truth for target file content. It is the coordinator and validator for the review layer.

### Global Storage

Use a local minimap home outside the target repo.

Suggested locations:

- Windows: `%LOCALAPPDATA%/minimap`
- macOS/Linux: `~/.minimap`

Allow `MINIMAP_HOME` as an override for tests and advanced users.

Suggested layout:

```text
~/.minimap/
  session-index.json
  sessions/
    my-new-feature-2f4ab9c1/
      session.json
      comments.jsonl
      suggestions.jsonl
      events.jsonl
```

No minimap review metadata is written into the work repo by default.

### Session Identity

The normalized absolute target file path is the durable lookup key.

Use a readable session folder name with a short hash of the normalized absolute path:

```text
sessions/my-new-feature-2f4ab9c1/
```

Maintain a global index:

```json
{
  "version": 1,
  "files": {
    "c:/work/repo/docs/my-new-feature.md": "my-new-feature-2f4ab9c1"
  }
}
```

Session metadata:

```json
{
  "id": "my-new-feature-2f4ab9c1",
  "targetFile": "C:/work/repo/docs/my-new-feature.md",
  "title": "my-new-feature.md",
  "createdAt": "2026-05-28T10:00:00.000Z",
  "lastActiveAt": "2026-05-28T12:45:00.000Z",
  "repoRoot": "C:/work/repo",
  "relativePath": "docs/my-new-feature.md",
  "contentHash": "sha256:...",
  "gitHead": "..."
}
```

`attach <file>` behavior:

- resolve the target path against the caller's working directory
- normalize the absolute path
- reject missing files, directories, and binary files
- create a session if no session exists for that path
- reopen the existing session if one exists
- update target metadata, content hash, git metadata, and `lastActiveAt`

File moves are explicit:

```text
minimap session move old/path/spec.md new/path/spec.md
```

Move behavior:

- updates minimap session metadata and index only
- does not move or rename the actual file
- fails if the new path already has a different session
- re-resolves anchors against the new file

### File Support

MVP is Markdown-first and text-file compatible.

Attach behavior:

- accept known text/spec extensions such as `.md`, `.mdx`, `.txt`, `.rst`, `.adoc`, and extensionless text
- for unknown extensions, attempt UTF-8 text read and reject binary-looking content
- reject directories and binary files
- preserve line endings when applying suggestions as much as practical

Viewer behavior:

- Markdown files render as Markdown and support heading/section navigation
- non-Markdown text files render in a plain text viewer
- non-Markdown text still supports global comments, anchored quote comments, replace/delete/insert suggestions, and diff preview/apply
- non-Markdown files do not get Markdown section comments unless a later parser supports their structure

### Anchoring Model

Line numbers alone are not enough. They drift as the file changes.

Minimap should store resilient anchors:

- scope: `global`, `section`, or `anchor`
- quote text for exact anchored comments/suggestions
- heading path when available
- line range at creation time
- selected text hash
- short nearby context when useful
- target file content hash at creation time

Example anchor:

```json
{
  "scope": "anchor",
  "quote": "Memory visibility is determined by the container.",
  "headingPath": ["Memory Model", "Visibility"],
  "lineStart": 42,
  "lineEnd": 44,
  "selectedHash": "sha256:...",
  "fileHash": "sha256:..."
}
```

Resolution order:

1. exact stored range and selected hash still match
2. quote appears under the same heading path
3. quote appears elsewhere in the file
4. fuzzy match near the original location
5. mark the anchor stale or orphaned

If an anchor is ambiguous or stale, minimap should surface that state instead of silently attaching feedback to the wrong text.

### Comments

Comments are discussion, instruction, evidence, concern, or review feedback.

Comments can be:

- global: applies to the whole file/session
- section: applies to a heading/section
- anchor: applies to a precise quote/range

Comments support one-level replies/threads.

Example:

```json
{
  "id": "cmt_001",
  "by": "ai:codex",
  "kind": "concern",
  "status": "open",
  "scope": "anchor",
  "anchor": {
    "quote": "Memory visibility is determined by the container.",
    "headingPath": ["Memory Model", "Visibility"]
  },
  "text": "This needs to distinguish project scope from user-private scope.",
  "confidence": "high",
  "createdAt": "2026-05-28T10:00:00.000Z",
  "replies": []
}
```

Initial comment kinds:

- instruction
- concern
- question
- evidence
- disagreement
- confirmation
- recommendation
- conclusion

Initial comment statuses:

- open
- resolved
- accepted
- rejected
- deferred
- stale

### Suggestions

Suggestions are executable proposed edits to the target file.

Comments ask "what do we think about this?" Suggestions answer "what exact file change should be made?"

Initial suggestion types:

- replace
- insert_after
- delete

Example:

```json
{
  "id": "sug_001",
  "by": "ai:claude",
  "kind": "replace",
  "status": "pending",
  "anchor": {
    "quote": "Memory visibility is determined by the container.",
    "headingPath": ["Memory Model", "Visibility"]
  },
  "content": "Memory visibility is determined by container scope and explicit visibility policy.",
  "rationale": "The current wording hides the policy layer.",
  "confidence": "medium",
  "createdAt": "2026-05-28T10:00:00.000Z",
  "replies": []
}
```

Initial suggestion statuses:

- pending
- accepted
- rejected
- applied
- stale

Suggestion semantics:

- accepting a suggestion does not modify the target file
- applying a suggestion shows a diff preview first
- the target file is written only after human confirmation
- agents may create suggestions, but agents may not apply them in MVP
- human UI may create and apply a suggestion in one preview-confirmed flow

Applying a suggestion should:

1. re-read the target file
2. re-resolve the anchor
3. block apply if the anchor is stale, orphaned, or ambiguous
4. compute and show a before/after diff
5. update the target file only after user confirmation
6. record an event with before and after hashes

### Context Contract

`minimap context <file> --json` returns collaboration/session state, not full target file content by default.

The target file is available through normal filesystem reads. Agents should read the file directly when needed.

Default context should include:

- session id
- target file path
- content hash
- last active time
- file type / Markdown detection
- heading outline when available
- comments
- suggestions
- anchor resolution status

Read-only context calls do not update `lastActiveAt`.

Future convenience options may include:

```text
minimap context <file> --json --include-content
minimap context <file> --json --section "Architecture"
```

These are not required for MVP.

### Agent Skill Contract

The globally installed minimap skill should tell agents how to participate.

Core rules:

- Use minimap only after the user has attached a target file.
- Identify the session by file path, not by global active state.
- Do not treat chat as the source of truth.
- Read minimap context before reviewing or suggesting.
- Read the target file directly when content is needed.
- Do not directly edit target files unless the user explicitly asks outside the minimap workflow.
- Add comments and suggestions through minimap APIs or CLI commands.
- Anchor feedback to exact quote text when possible.
- Use global or section comments when exact anchoring is not appropriate.
- Separate claim, concern, recommendation, evidence/reference, and confidence inside comment text where useful.
- Reference existing comment and suggestion ids when responding to prior feedback.
- Do not apply suggestions as an agent.
- Use explicit actor identity on every write.

Actor identity:

- Codex should write as `ai:codex` unless a more specific identity is configured.
- Claude should write as `ai:claude` unless a more specific identity is configured.
- Agents never write as `human:*`.
- Human UI actions use a configured human identity or a local default.

Useful agent instructions:

```text
Use minimap for docs/my-new-feature.md. Review the file for architecture risks.
Add anchored comments and suggestions through minimap. Do not edit the file directly.
```

```text
Use minimap for docs/my-new-feature.md. Review comments from ai:claude.
Add confirmations, disagreements, and missing evidence. Reference the original comment ids.
```

### CLI Contract

The CLI should wrap the local server/session implementation so agents can interact with minimap even without custom tool support.

Suggested commands:

```text
minimap attach docs/my-new-feature.md
minimap context docs/my-new-feature.md --json
minimap comment add docs/my-new-feature.md --by ai:codex --quote "..." --text "..." --kind concern
minimap comment add docs/my-new-feature.md --by human:local --global --text "Focus the next review on failure modes."
minimap comment reply docs/my-new-feature.md cmt_001 --by ai:claude --text "..."
minimap comment resolve docs/my-new-feature.md cmt_001 --by human:local
minimap suggest replace docs/my-new-feature.md --by ai:claude --quote "..." --content "..."
minimap suggest accept docs/my-new-feature.md sug_001 --by human:local
minimap suggest reject docs/my-new-feature.md sug_001 --by human:local
minimap suggest preview docs/my-new-feature.md sug_001
minimap suggest apply docs/my-new-feature.md sug_001 --by human:local
minimap session list
minimap session move old/path/spec.md new/path/spec.md
```

Commands should support machine-readable JSON where useful:

```text
minimap context docs/my-new-feature.md --json
minimap attach docs/my-new-feature.md --json
```

If a command tries to write to an unattached file, it should fail clearly:

```text
No minimap session is attached for docs/my-new-feature.md.
Run: minimap attach docs/my-new-feature.md
```

### Server API

Suggested local API surface:

```http
POST /api/spec-sessions/attach
GET  /api/spec-sessions
GET  /api/spec-sessions/by-file?path=...
GET  /api/spec-sessions/by-file/context?path=...
POST /api/spec-sessions/by-file/move

POST /api/spec-sessions/by-file/comments
POST /api/spec-sessions/by-file/comments/:commentId/reply
POST /api/spec-sessions/by-file/comments/:commentId/resolve

POST /api/spec-sessions/by-file/suggestions
POST /api/spec-sessions/by-file/suggestions/:suggestionId/accept
POST /api/spec-sessions/by-file/suggestions/:suggestionId/reject
POST /api/spec-sessions/by-file/suggestions/:suggestionId/preview
POST /api/spec-sessions/by-file/suggestions/:suggestionId/apply
```

Mutating endpoints should eventually require idempotency keys so agent retries do not duplicate comments or suggestions. This can be hardening after the basic flow works.

### UI Shape

First useful UI:

```text
Top:
  Roadmap / Spec Sessions navigation

Spec Sessions list:
  recent sessions sorted by lastActiveAt

Session view:
  left/main: attached file viewer
  right: comments and suggestions
  local controls: add comment, suggest replacement, suggest deletion, suggest insertion
```

Viewer requirements:

- read-oriented file viewer
- Markdown rendering and heading navigation for Markdown files
- plain text viewer for non-Markdown text files
- text selection supports human comments and human suggestions
- no full-file raw editor in MVP
- external file edits are supported through refresh and anchor re-resolution

Core actions:

- add global comment
- add section comment
- add anchored comment from selection
- create human suggestion from selection
- reply to comment or suggestion
- resolve comment
- accept suggestion
- reject suggestion
- preview suggestion diff
- apply suggestion after confirmation

The first UI does not need realtime collaboration or direct agent invocation. It needs clear review and convergence state around a file.

### Human Workflow

1. The user is in any repo.
2. The user attaches a spec file:

```text
minimap attach docs/my-new-feature.md
```

3. Minimap creates or reopens the file session.
4. The user opens minimap UI and sees the file session.
5. The user can add human comments or human suggestions from the file viewer.
6. The user asks an external agent to use minimap for the file.
7. The agent reads minimap context, reads the target file directly, and adds comments or suggestions.
8. The user asks another external agent to review those comments and suggestions.
9. The user replies, resolves comments, accepts/rejects suggestions, or creates more suggestions.
10. The user previews and applies selected suggestions when ready.

### Implementation Phases

#### Phase 1: Global File Session Store

- implement minimap home resolution with `MINIMAP_HOME` override
- implement session id generation from file basename plus path hash
- implement `session-index.json`
- implement one-session-per-normalized-file lookup
- implement `attach` for one text file
- reject missing files, directories, and binary files
- detect Markdown vs generic text
- compute file content hash
- detect repo root and git head when possible
- write `session.json`
- initialize `comments.jsonl`, `suggestions.jsonl`, and `events.jsonl`
- update `lastActiveAt` on attach/reopen

#### Phase 2: CLI Contract

- add a `minimap` bin entry if one does not already exist
- implement `minimap attach <file>`
- implement `minimap context <file> --json`
- implement `minimap session list`
- implement `minimap session move <old-file> <new-file>`
- make command errors clear and machine-readable where useful

#### Phase 3: Server API

- add spec-session routes without breaking existing roadmap routes
- keep using the same local minimap server/process
- make spec-session APIs work even when the current directory has no roadmap workspace
- expose attach, list, by-file context, and move APIs

#### Phase 4: Anchor Foundation

- parse Markdown heading paths for Markdown files
- create anchors from scope, quote, heading path, line range, selected hash, and file hash
- resolve anchors against current target content
- classify resolution as `resolved`, `ambiguous`, `stale`, or `orphaned`
- expose anchor status in context output

#### Phase 5: Comments And Replies

- implement `comments.jsonl`
- support global, section, and anchor comments
- require `by` on write actions
- support human and agent comments
- support one-level replies
- support resolve/reopen/status updates
- include comments and anchor statuses in context output

#### Phase 6: Suggestions

- implement `suggestions.jsonl`
- support replace, insert_after, and delete suggestions
- require concrete anchors for suggestions
- require `by` on write actions
- support human and agent suggestions
- support suggestion replies
- support pending, accepted, rejected, applied, and stale statuses
- ensure accepted/rejected suggestions do not mutate target files

#### Phase 7: Preview And Apply

- implement apply preview for a single suggestion
- re-read target file before preview/apply
- re-resolve anchor before preview/apply
- block apply when anchor is stale, orphaned, or ambiguous
- compute and show a diff
- apply only after human confirmation
- record before and after hashes in `events.jsonl`
- preserve line endings as much as practical

#### Phase 8: Minimal UI

- add top-level navigation for Roadmap and Spec Sessions
- show recent file sessions sorted by `lastActiveAt`
- show attached file viewer
- render Markdown when applicable
- show comments and suggestions beside the file
- support selection-based human comments and suggestions
- support accept, reject, resolve, preview, and apply actions
- show stale/orphaned anchors distinctly

#### Phase 9: Global Skill Packaging

- write the global minimap spec-session skill
- document file-first session discovery
- document actor identity requirements
- document CLI/API commands agents should use
- include examples for spec review and cross-agent feedback review
- ensure the skill tells agents not to edit target files directly in the minimap workflow

#### Phase 10: Hardening

- add idempotency keys for mutation endpoints
- improve fuzzy anchor recovery
- add larger-file limits and context pagination if needed
- add optional include-content/section context helpers if needed
- add session delete/cleanup if disk clutter becomes a real issue
- add optional full snapshots only behind explicit privacy-conscious setting if needed

### First Implementation Slice

The first coding slice should be intentionally small:

1. Add global minimap home resolution with `MINIMAP_HOME` test override.
2. Add a file-session store module.
3. Add one-session-per-file attach behavior.
4. Add CLI support for `attach <file>`, `context <file> --json`, and `session list`.
5. Add tests proving that attaching a spec file creates only global minimap state and does not modify the target repo.

Do not implement comments, suggestions, anchor resolution, or UI in the first slice. Those depend on the session store and file-first CLI contract being boring and reliable.

### MVP Success Criteria

The MVP is successful when:

- a file in a repo without minimap can be attached
- minimap stores session state outside the target repo
- the UI can list recent file sessions
- the UI can show the attached file
- the user can create global, section, and anchored comments
- an agent can add comments and suggestions through minimap
- another agent can reply to or disagree with those comments
- the user can accept or reject suggestions
- the user can preview and apply a selected suggestion
- applying a suggestion modifies only the target file after explicit confirmation

### Design Guardrails

- Local-only by default.
- Do not write minimap metadata into work repos by default.
- Do not require target repos to adopt minimap.
- Do not use line numbers as the only anchor.
- Do not store full target-file snapshots by default.
- Do not let agents apply suggestions.
- Do not invoke agents from minimap in MVP.
- Do not introduce separate decisions/evidence/reviews/entities until there is real workflow pain.
- Do not treat minimap server state as a replacement for the target file.
- Keep the user as the merge authority.
