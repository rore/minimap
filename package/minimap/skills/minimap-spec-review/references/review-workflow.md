# Review Workflow

## Core Rules

- one session per target file
- the target file may live in any repo and does not need minimap files
- do not create minimap folders inside the work repo
- do not edit the target file unless the user explicitly asks you to apply a change
- prefer anchored comments over chat-only feedback for specific passages
- add replies to continue existing threads
- resolve only when an issue is addressed or explicitly dismissed by the user
- treat the user as the merge authority

## Comment Kinds

- `concern` — risks, gaps, contradictions, or weak assumptions
- `recommendation` — proposed direction or concrete improvements
- `question` — missing information
- `disagreement` — explicit conflict with another comment or premise
- `evidence` — source-backed findings
- `instruction` — preserve a user instruction
- `confirmation` — validating that something is correct
- `conclusion` — synthesis after discussion

## Anchoring Rules

When quote anchoring:

- quote exact target-file text
- choose enough text to be unique
- prefer a sentence or short paragraph over a whole section
- if a quote is ambiguous, use a heading anchor or global comment
- if the user selected text in the UI, trust the UI-provided quote

## Suggestions

- a suggestion is a proposed edit, not a decision
- accept/reject does not modify the file
- preview before apply, always; preview re-resolves the anchor and returns a diff
- apply writes the file and should only run on explicit user request

Spec-session comments are review artifacts, not decisions.
