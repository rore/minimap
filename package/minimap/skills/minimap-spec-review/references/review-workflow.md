# Review Workflow

## Core Rules

- one session maps to one target file
- the target file may live in any repo and does not need minimap files
- do not create minimap folders inside the work repo
- do not edit the target file unless the user explicitly asks you to apply a change
- prefer anchored comments over chat-only feedback for specific passages
- add replies to continue existing threads
- resolve only when an issue is addressed or explicitly dismissed by the user
- treat the user as the merge authority

## Steps

1. Identify the exact target file.
2. Start or verify the minimap server.
3. Attach the target file if needed.
4. Read minimap context and the target file.
5. Add comments, replies, or suggestions through minimap.
6. Do not modify the target file unless explicitly asked.
7. If asked to apply a minimap suggestion, preview it first and apply it through minimap only after explicit confirmation.

## Comment Kinds

Use:

- `concern` for risks, gaps, contradictions, or weak assumptions
- `recommendation` for proposed direction or concrete improvements
- `question` for missing information
- `disagreement` for explicit conflict with another comment or premise
- `evidence` for source-backed findings
- `instruction` only when preserving a user instruction
- `confirmation` when validating that something is correct
- `conclusion` for synthesis after discussion

## Anchoring Rules

When quote anchoring:

- quote exact target-file text
- choose enough text to be unique
- prefer a sentence or short paragraph over a whole section
- if a quote is ambiguous, use a heading anchor or global comment
- if the user selected text in the minimap UI, trust the UI-provided quote

## Human UI Behavior

The minimap UI keeps human review lightweight:

- selecting text or hovering a paragraph exposes Comment and Suggest actions in the spec itself
- comments created from the file view are anchored automatically to the selected text or paragraph
- the top Add action creates a global comment unless text is selected
- suggestions should be started from selected text or a paragraph action so the proposed edit has a clear anchor
- actor, kind, and raw anchor controls are operational details and should not be exposed as the primary human workflow
- dismissing a suggestion means it is rejected, and rejected or accepted suggestions can be reopened if the review was accidental
- applying a suggestion changes the target file and is not treated as a reversible review action
- Preview is a toggle that should show the proposed change in the spec pane itself; turning it off should remove the preview without changing the file
- applying a suggestion should still go through Preview first

Spec-session comments are not decisions. They are review artifacts.

## Refresh Behavior

The minimap UI may refresh review state automatically so new comments and suggestions appear while a session is open.

Refresh must not erase a human draft comment, draft suggestion, or active reply. If the user is reading the spec file itself, avoid changing the file viewer without an explicit refresh or apply action.
