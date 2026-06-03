# CLI Contract

All commands run through:

```sh
node <path-to-this-skill>/scripts/minimap.mjs <command>
```

The examples below abbreviate this as `mm`. Substitute the full path when invoking.

The CLI is a thin wrapper over the HTTP API documented in [references/http.md](http.md). Either path reaches the same server code (anchor cascades, markdown tolerance, idempotency); pick whichever is easier for the shape of input you have. Exit codes are stable: `0` on success, `2` on a 4xx-class error, `1` on a 5xx-class error.

## Multi-line content: `--json-stdin`

Anywhere the CLI takes a `--text`, `--quote`, `--content`, or `--rationale` value that's multi-line markdown — backticks, em-dashes, apostrophes, embedded newlines — pass `--json-stdin` and pipe the whole request body as JSON on stdin instead of using inline flags. This avoids every shell's quoting rules and gives loud failure on malformed JSON.

```sh
echo '{"by":"claude","kind":"concern","quote":"`tricky-token`","text":"Don'"'"'t lock the design — `tricky-token` is one of\nseveral options.","scope":""}' \
  | mm comment add path/to/spec.md --json-stdin --json
```

The shell-friendly way to write that body without inline-quoting hell is a single-quoted heredoc:

```sh
mm comment add path/to/spec.md --json-stdin --json <<'PAYLOAD'
{
  "by": "claude",
  "kind": "concern",
  "quote": "`tricky-token`",
  "text": "Don't lock the design — `tricky-token` is one of\nseveral options.",
  "scope": ""
}
PAYLOAD
```

**Rules for the JSON body:**

- Newlines inside string values must be `\n` (not raw newlines). Express's body parser silently strips raw newlines and concatenates fragments — the CLI's `--json-stdin` parses the JSON before posting and rejects malformed input loudly, so you'll see the error rather than corrupted data.
- The body shape matches the HTTP route's body shape exactly. See [references/http.md](http.md) for fields per command (`comment add`, `comment reply`, `suggest add` are the three commands that accept `--json-stdin`).
- For quote-anchored comments, set `scope: ""` (empty string) and pass `quote`. For section comments, set `scope: "section"` and pass `headingPath`. For global, set `scope: "global"`.

## Anchor matching is tolerant

These rules apply server-side — both the CLI and direct HTTP calls get them.

- **Heading anchors** match the canonical full path first; if not, they try a Unicode-normalized comparison (case- and dash-insensitive), then a unique suffix match, then a unique leaf-only match. So `--heading "MCP Impact (Committed)"` works even if the actual outline path is `Operational Fact Memory > MCP Impact (Committed)`, as long as that leaf is unique.
- **Quote anchors** try a literal substring match first; if not, they retry with markdown syntax stripped from both sides (backticks, `*`, `_`, leading `### `). So a quote captured from a rendered view (no backticks) finds its line in the raw markdown, and vice versa.

If a section anchor matches multiple headings, the server returns `anchor_ambiguous` with the candidate paths — pass the full path to disambiguate. If a quote matches multiple locations, pass `quoteOffset` (char offset, strongest hint) or a tighter `lineStart`/`lineEnd` window.

## Shell quoting (when you do pass values inline)

For trivial single-line values (no backticks, no apostrophes, no newlines), inline `--text "..."` is fine on every shell. For anything trickier, prefer `--json-stdin` — it's universal across bash, zsh, PowerShell, and cmd.

If a quote is a heading (`### Schema`), prefer a section anchor with `--heading "Schema"` over a quote anchor — section anchors don't pay the inline-syntax tax.

## Attach

```sh
mm attach path/to/spec.md --json
```

## Context

```sh
mm context path/to/spec.md --json
```

Returns session metadata, outline, comments, and suggestions. Read the target file directly when you need substantive content.

## Comments

Use a stable actor identity in `--by`, such as `codex`, `claude`, or `human`.

```sh
# Quote-anchored, simple inline text
mm comment add path/to/spec.md --by codex --kind concern \
   --quote "exact text from the file" --text "The issue or recommendation." --json

# Section-level
mm comment add path/to/spec.md --by codex --kind recommendation \
   --heading "Heading > Subheading" --text "Section-level feedback." --json

# Global
mm comment add path/to/spec.md --by codex --kind question \
   --global --text "File-level question." --json

# Multi-line / shell-hostile content via stdin
mm comment add path/to/spec.md --json-stdin --json <<'PAYLOAD'
{ "by": "codex", "kind": "concern", "quote": "...", "text": "...", "scope": "" }
PAYLOAD

# Reply / resolve / reopen
mm comment reply   path/to/spec.md <comment-id> --by codex --text "..." --json
mm comment reply   path/to/spec.md <comment-id> --json-stdin --json <<'PAYLOAD'
{ "by": "codex", "text": "Multi-line\nreply." }
PAYLOAD
mm comment resolve path/to/spec.md <comment-id> --by codex --json
mm comment reopen  path/to/spec.md <comment-id> --by codex --json
```

Valid `--kind` values: `concern`, `recommendation`, `question`, `disagreement`, `evidence`, `instruction`, `confirmation`, `conclusion` (see [review-workflow.md](review-workflow.md)).

## Suggestions

Use suggestions for exact proposed file edits. Suggestions are separate from comments and do not modify the target file until explicitly applied.

Supported `--kind` values: `replace`, `insert_after`, `delete`.

```sh
# Inline: trivial single-line content
mm suggest add path/to/spec.md --by codex --kind replace \
   --quote "exact text from the file" --content "replacement text" \
   --rationale "Why this edit helps." --json

# Multi-line content via stdin (recommended for any non-trivial replacement)
mm suggest add path/to/spec.md --json-stdin --json <<'PAYLOAD'
{
  "by": "codex",
  "kind": "replace",
  "quote": "exact text from the file",
  "content": "Multi-line replacement\nwith `markdown`\nand more.",
  "rationale": "Why this edit helps.",
  "scope": ""
}
PAYLOAD

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
mm session move <from-file> <to-file> --json
```
