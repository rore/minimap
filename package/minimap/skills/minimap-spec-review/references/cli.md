# CLI Contract

All commands run through:

```sh
node <path-to-this-skill>/scripts/minimap.mjs <command>
```

The examples below abbreviate this as `mm`. Substitute the full path when invoking.

## Attach

Attach the exact file the user wants to review:

```sh
mm attach path/to/spec.md --json
```

## Context

Read collaboration context (intentionally excludes full file content — read the file directly when you need substantive understanding):

```sh
mm context path/to/spec.md --json
```

## Comments

Use a stable actor identity in `--by`, such as `codex`, `claude`, or `human`.

```sh
# Quote-anchored
mm comment add path/to/spec.md --by codex --kind concern \
   --quote "exact text from the file" --text "The issue or recommendation." --json

# Section-level
mm comment add path/to/spec.md --by codex --kind recommendation \
   --heading "Heading > Subheading" --text "Section-level feedback." --json

# Global
mm comment add path/to/spec.md --by codex --kind question \
   --global --text "File-level question." --json

# Reply / resolve / reopen
mm comment reply   path/to/spec.md <comment-id> --by codex --text "..." --json
mm comment resolve path/to/spec.md <comment-id> --by codex --json
mm comment reopen  path/to/spec.md <comment-id> --by codex --json
```

## Suggestions

Use suggestions for exact proposed file edits. Suggestions are separate from comments and do not modify the target file until explicitly applied.

Supported kinds: `replace`, `insert_after`, `delete`.

```sh
mm suggest add path/to/spec.md --by codex --kind replace \
   --quote "exact text from the file" --content "replacement text" \
   --rationale "Why this edit helps." --json

# Accept / reject (does not modify the file)
mm suggest accept path/to/spec.md <suggestion-id> --by human --json
mm suggest reject path/to/spec.md <suggestion-id> --by human --json

# Preview re-resolves the anchor and returns a diff without writing.
mm suggest preview path/to/spec.md <suggestion-id> --json

# Apply writes the target file. Only when the user explicitly asks.
mm suggest apply   path/to/spec.md <suggestion-id> --by human --json
```

## Sessions

```sh
mm session list --json
```
