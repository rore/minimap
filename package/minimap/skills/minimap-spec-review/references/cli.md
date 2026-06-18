# CLI Contract

All commands run through:

```sh
node <path-to-this-skill>/scripts/minimap.mjs <command>
```

The examples below abbreviate this as `mm`. Substitute the full path when invoking.

The CLI is a thin wrapper over the HTTP API documented in [http.md](http.md). Both paths reach the same server code (anchor cascades, markdown tolerance, idempotency); pick whichever is easier for the shape of input you have. Exit codes are stable: `0` on success, `2` on a 4xx-class error, `1` on a 5xx-class error.

## If `node ...` fails to spawn

Some sandboxes restrict direct subprocess spawning of binaries from the agent's shell tool. If `node <path>/minimap.mjs ...` returns a process-creation error (`CreateProcessWithLogonW failed`, `EACCES`, `permission denied`, or similar), wrap the call in the host shell:

- PowerShell: `powershell -Command "node <path>/minimap.mjs <command>"`
- bash: `bash -c "node <path>/minimap.mjs <command>"`
- cmd: `cmd /c "node <path>/minimap.mjs <command>"`

The host shell typically has the privileges the sandboxed agent shell doesn't. If even that fails, fall back to the HTTP API ([http.md](http.md)) — it requires only `curl`, which most sandboxes allow.

## Writing comments and suggestions: prefer `--json-stdin`

For any value that contains backticks, em-dashes, apostrophes, embedded newlines, or anything else that fights `"…"` / `'…'` quoting, **use `--json-stdin` and pipe the whole request body as JSON on stdin**. This sidesteps every shell's quoting rules and gives loud failure on malformed JSON. Available on `comment add`, `comment reply`, and `suggest add`.

The shell-friendly way to write the body is a single-quoted heredoc — bash interprets nothing inside `<<'PAYLOAD'`, so backticks and `$VAR` survive verbatim:

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

Body shape per command — see [http.md](http.md) for the full field list:

- `comment add`: `{by, kind, text, scope?, headingPath?, quote?, quoteOffset?, lineStart?, lineEnd?}`
- `comment reply`: `{by, text}`
- `suggest add`: `{by, kind, content, rationale?, scope?, headingPath?, quote?, quoteOffset?, lineStart?, lineEnd?}`

**Newlines inside string values must be `\n`, not raw newlines.** The CLI parses the JSON before posting and rejects malformed input loudly.

Inline flags (`--text "..."`, `--quote "..."`, etc.) still work for trivial single-line values with no shell-hostile characters. Use them when you'd write a one-line note in chat. For duplicate quotes, the inline `--line-start N --line-end N` and `--quote-offset N` flags disambiguate without dropping to `--json-stdin` — the same fields the HTTP API and the JSON body accept.

## Reading state: `mm context`

```sh
mm context path/to/spec.md --json
```

Returns the full session metadata, outline, and every comment + suggestion with its current `anchorStatus`. Read the target file directly when you need substantive content.

For typical review work the raw context is too large to scan. Two flags trim it:

- `--summary` — projects each comment and suggestion to a compact row (`id`, `by`, `kind`, `status`, `anchorScope`, `anchorStatus`, `lineStart`, `headingPath`, `replyCount`, ~120-char snippet of `text` or `rationale`). **`text` and `rationale` are truncated** — use this to scan, drop it to read. Drops the full `outline`. Adds a `counts` block at the top so the high-level numbers are visible at a glance.
- `--filter <open|resolved|all>` — narrows the items returned:
  - `open` — comments with `status=open` plus suggestions with `status=pending` (what's still on your plate). **Default when `--summary` is on without an explicit filter.**
  - `resolved` — comments that have been resolved (or otherwise closed) plus suggestions that have been accepted, rejected, or applied (what's been dealt with).
  - `all` — every comment and suggestion regardless of status.

Pair them: `mm context spec.md --json --summary` gives you "what's still open, in compact form" — the typical "where am I in this review?" call.

```sh
# Typical review-state scan:
mm context path/to/spec.md --json --summary

# Show every item in compact form (for an overview):
mm context path/to/spec.md --json --summary --filter all

# Show what's been dealt with (full bodies):
mm context path/to/spec.md --json --filter resolved
```

Without `--summary` or `--filter`, the response shape is unchanged from previous versions — full session, outline, full bodies on every comment and suggestion. New flags are opt-in only.

### Reading the full body of one comment or suggestion

There is no `mm comment show <id>` — every body lives inside `mm context`. The two everyday patterns:

```sh
# All open items, full bodies — the right call when --summary's snippet
# isn't enough and you want to actually read what someone wrote.
# Drop --summary; --filter all keeps resolved items in view too.
mm context path/to/spec.md --json --filter all

# Pluck one item by id (full body, no truncation).
mm context path/to/spec.md --json --filter all | jq '.comments[]      | select(.id == "cmt_000003")'
mm context path/to/spec.md --json --filter all | jq '.suggestions[]   | select(.id == "sug_000001")'
```

Don't reach for HTTP just to read full bodies — `mm context` already returns them and the HTTP read route uses different param names (`?path=` vs the create-comment body's `file`), which is exactly where agents pick the wrong endpoint.

## Anchor matching is tolerant

These rules apply server-side — both the CLI and direct HTTP calls get them.

- **Heading anchors** match the canonical full path first; if not, they try a Unicode-normalized comparison (case- and dash-insensitive), then a unique suffix match, then a unique leaf-only match. So `--heading "MCP Impact (Committed)"` works even if the actual outline path is `Operational Fact Memory > MCP Impact (Committed)`, as long as that leaf is unique.
- **Quote anchors** try a literal substring match first; if not, they retry with markdown syntax stripped from both sides (backticks, `*`, `_`, leading `### `). So a quote captured from a rendered view (no backticks) finds its line in the raw markdown, and vice versa.

If a section anchor matches multiple headings, the server returns `anchor_ambiguous` with the candidate paths in the message — pass the full path to disambiguate. If a quote matches multiple locations, the server returns `anchor_ambiguous` ("Text anchor quote must match exactly one location"); read the file to find the line numbers of each occurrence, then pass `--quote-offset N` (char offset, strongest hint) or `--line-start N --line-end N` (1-based line range, fallback) to pick one. The same fields work via `--json-stdin` (`quoteOffset`, `lineStart`, `lineEnd`) and HTTP.

## Attach

```sh
mm attach path/to/spec.md --json
```

## Comments

Use a stable actor identity in `--by`, such as `codex`, `claude`, or `human`.

```sh
# Trivial single-line text
mm comment add path/to/spec.md --by codex --kind concern \
   --quote "exact text from the file" --text "The issue or recommendation." --json

# Section-level
mm comment add path/to/spec.md --by codex --kind recommendation \
   --heading "Heading > Subheading" --text "Section-level feedback." --json

# Global
mm comment add path/to/spec.md --by codex --kind question \
   --global --text "File-level question." --json

# Disambiguating a duplicate quote — when the same quote appears more than once,
# add --line-start / --line-end (the line range you mean) or --quote-offset
# (the exact char offset). Without one of these the server returns
# anchor_ambiguous rather than picking arbitrarily.
mm comment add path/to/spec.md --by codex --kind concern \
   --quote "Claude Code" --line-start 42 --line-end 42 \
   --text "About the line-42 occurrence." --json

# Multi-line / shell-hostile content via stdin (recommended for any non-trivial body)
mm comment add path/to/spec.md --json-stdin --json <<'PAYLOAD'
{ "by": "codex", "kind": "concern", "quote": "...", "text": "...", "scope": "" }
PAYLOAD

# PowerShell equivalent of --json-stdin (ConvertTo-Json -Compress + native pipe).
# Build the body as a hashtable, serialize, pipe to node's stdin. Avoids every
# PowerShell quoting trap (backticks, em-dashes, embedded apostrophes).
# Note: PowerShell has no `mm` shell alias — invoke node directly with the
# absolute path to scripts/minimap.mjs.
$body = @{
  by = "codex"; kind = "concern"; scope = ""
  quote = "exact text from the file"
  lineStart = 42; lineEnd = 42
  text  = "Multi-line body with `n embedded newlines and ``backticks``."
} | ConvertTo-Json -Compress
$body | node <skill>/scripts/minimap.mjs comment add path/to/spec.md --json-stdin --json

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
# Trivial single-line content
mm suggest add path/to/spec.md --by codex --kind replace \
   --quote "exact text from the file" --content "replacement text" \
   --rationale "Why this edit helps." --json

# Disambiguating a duplicate quote — same as comment add. Use --line-start /
# --line-end (or --quote-offset) when the quote appears more than once.
mm suggest add path/to/spec.md --by codex --kind replace \
   --quote "TODO" --line-start 87 --line-end 87 \
   --content "Resolved." --rationale "Specific TODO on line 87." --json

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
