# CLI Contract

All commands run through:

```sh
node <path-to-this-skill>/scripts/minimap.mjs <command>
```

The examples below abbreviate this as `mm`. Substitute the full path when invoking.

**Use the CLI, not raw HTTP.** Do not call `/api/spec-sessions/...` routes directly — agents that try miss the anchor cascades and the markdown-tolerance fallback, and routinely guess wrong endpoint names (the reply route is singular `/reply`, not `/replies`). The CLI exit codes are stable: 0 on success, 2 on a 4xx-class error, 1 on a 5xx-class error.

## File-input flags for shell-hostile text

Any `--text`, `--quote`, `--content`, or `--rationale` value may instead be passed as a `--*-file` flag pointing at a UTF-8 text file. The file's contents become the value (trailing newline trimmed). This sidesteps every shell's quoting rules and is the correct path whenever the value contains apostrophes, backticks, em-dashes, ampersands, newlines, or anything else that fights `"…"` / `'…'` quoting.

```sh
# Write the comment text to a file, then point the CLI at it.
echo "Don't lock the design — \`tricky-token\` is one of several." > /tmp/note.md
mm comment add path/to/spec.md --by codex --kind concern \
   --quote-file /tmp/quote.md --text-file /tmp/note.md --json
```

Inline value wins if both `--text` and `--text-file` are passed; the CLI errors out instead of silently picking one. Same pattern for `--quote`/`--quote-file`, `--content`/`--content-file`, `--rationale`/`--rationale-file`.

## Anchor matching is tolerant

Section and quote anchors are forgiving:

- **Heading anchors** match the canonical full path first; if not, they try a Unicode-normalized comparison (case- and dash-insensitive), then a unique suffix match, then a unique leaf-only match. So `--heading "MCP Impact (Committed)"` works even if the actual outline path is `Operational Fact Memory > MCP Impact (Committed)`, as long as that leaf is unique.
- **Quote anchors** try a literal substring match first; if not, they retry with markdown syntax stripped from both sides (backticks, `*`, `_`, leading `### `). So a quote captured from a rendered view (no backticks) finds its line in the raw markdown, and vice versa.

If a section anchor matches multiple headings, the CLI returns `anchor_ambiguous` with the candidate paths — pass the full path to disambiguate.

## Shell quoting (when you do pass values inline)

For trivial values (no backticks, no apostrophes, no newlines), inline `--text "..."` is fine on every shell. For anything trickier, prefer `--text-file` — it's universal.

If you must pass complex text inline on PowerShell: backticks are PowerShell's escape character, so a `--quote` containing markdown inline code will have its backticks consumed before minimap sees it. Two safe options:

- Use **single quotes** around the argument; PowerShell does not interpret backticks inside single quotes:
  ```powershell
  mm comment add path/to/spec.md --by codex --kind concern `
     --quote 'Fact identity = `(category, command_family, scope_kind)`.' `
     --text "..." --json
  ```
- Or **escape each backtick** with another backtick (`` `` ``):
  ```powershell
  --quote "Fact identity = ``(category, command_family)``."
  ```

bash, zsh, and cmd.exe don't have the backtick-escape problem — double quotes are fine. The file-input flags work the same on every shell.

If the quote you want to anchor on is a heading (`### Schema`), prefer a section anchor with `--heading "Schema"` over a quote anchor — section anchors don't pay the inline-syntax tax.

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

# Any --text or --quote can be replaced with --text-file / --quote-file:
mm comment reply path/to/spec.md <comment-id> --by codex --text-file /tmp/reply.md --json
```

## Suggestions

Use suggestions for exact proposed file edits. Suggestions are separate from comments and do not modify the target file until explicitly applied.

Supported kinds: `replace`, `insert_after`, `delete`.

```sh
mm suggest add path/to/spec.md --by codex --kind replace \
   --quote "exact text from the file" --content "replacement text" \
   --rationale "Why this edit helps." --json

# Or, with file-input flags (recommended for multi-line content):
mm suggest add path/to/spec.md --by codex --kind replace \
   --quote-file /tmp/q.md --content-file /tmp/c.md --rationale-file /tmp/r.md --json

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
