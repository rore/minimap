# CLI Contract

Use the bundled CLI wrapper:

```sh
node <path-to-this-skill>/scripts/minimap.mjs <command>
```

During minimap development, that is usually:

```sh
node package/minimap/skills/minimap-spec-review/scripts/minimap.mjs <command>
```

## Attach

Attach the exact file the user wants to review:

```sh
node <path-to-this-skill>/scripts/minimap.mjs attach path/to/spec.md --json
```

## Context

Read collaboration context:

```sh
node <path-to-this-skill>/scripts/minimap.mjs context path/to/spec.md --json
```

The context intentionally excludes full target file content. Read the target file directly when you need substantive understanding.

## Comments

Use a stable actor identity in `--by`, such as `codex:local`, `claude:local`, or `human:local`.

Specific quote:

```sh
node <path-to-this-skill>/scripts/minimap.mjs comment add path/to/spec.md --by codex:local --kind concern --quote "exact text from the file" --text "The issue or recommendation." --json
```

Section-level:

```sh
node <path-to-this-skill>/scripts/minimap.mjs comment add path/to/spec.md --by codex:local --kind recommendation --heading "Heading > Subheading" --text "Section-level feedback." --json
```

Global:

```sh
node <path-to-this-skill>/scripts/minimap.mjs comment add path/to/spec.md --by codex:local --kind question --global --text "File-level question." --json
```

Reply:

```sh
node <path-to-this-skill>/scripts/minimap.mjs comment reply path/to/spec.md comment-id --by codex:local --text "Reply text." --json
```

Resolve:

```sh
node <path-to-this-skill>/scripts/minimap.mjs comment resolve path/to/spec.md comment-id --by codex:local --json
```

Reopen:

```sh
node <path-to-this-skill>/scripts/minimap.mjs comment reopen path/to/spec.md comment-id --by codex:local --json
```

## Suggestions

Use suggestions for exact proposed file edits. Suggestions are separate from comments and do not modify the target file until explicitly applied.

Add a suggestion:

```sh
node <path-to-this-skill>/scripts/minimap.mjs suggest add path/to/spec.md --by codex:local --kind replace --quote "exact text from the file" --content "replacement text" --rationale "Why this edit helps." --json
```

Supported suggestion kinds:

- `replace`
- `insert_after`
- `delete`

Accept or reject a suggestion without changing the target file:

```sh
node <path-to-this-skill>/scripts/minimap.mjs suggest accept path/to/spec.md sug_000001 --by human:local --json
node <path-to-this-skill>/scripts/minimap.mjs suggest reject path/to/spec.md sug_000001 --by human:local --json
```

Preview and apply:

```sh
node <path-to-this-skill>/scripts/minimap.mjs suggest preview path/to/spec.md sug_000001 --json
node <path-to-this-skill>/scripts/minimap.mjs suggest apply path/to/spec.md sug_000001 --by human:local --json
```

Preview re-resolves the anchor and does not write the target file. Apply writes the target file and should only be used when the user explicitly asks.

List sessions:

```sh
node <path-to-this-skill>/scripts/minimap.mjs session list --json
```
