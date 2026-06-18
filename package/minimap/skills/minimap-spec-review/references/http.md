# HTTP API

The minimap server exposes a JSON HTTP API on `localhost`. Every operation the CLI performs is a thin wrapper over one of these routes — the server applies the same anchor cascades and markdown tolerance regardless of which path you take.

## When to use HTTP vs the CLI

The CLI ([cli.md](cli.md)) and HTTP routes reach the same server code. Pick whichever fits the surface you're already in:

- **CLI** is usually fine. `mm comment add --json-stdin` and `mm suggest add --json-stdin` accept the same JSON bodies documented here on stdin, with loud failure on malformed JSON.
- **Direct HTTP** is the right call when the CLI can't run in your environment (sandbox restrictions on `node` exec, see [cli.md](cli.md) § "If `node ...` fails to spawn"), when batch-style work is easier as a sequence of `curl` calls, or when an integration is already speaking HTTP.
- **Don't reach for HTTP just to read full comment / suggestion bodies.** `mm context <file> --json --filter all` already returns them; piping through `jq` gives you single-item plucking. The read endpoint here uses different parameter names than the write endpoints (read takes `?path=`, the create-comment POST body takes `file`), which is exactly where agents pick the wrong route.

There is no behavioral difference between the two paths.

## Finding the server

Default port is `4312`. The server falls forward (`4313`, `4314`, …) if `4312` is taken. The current port is recorded in:

```
$MINIMAP_HOME/server.json   # default: ~/.minimap/server.json
```

That file looks like `{ "port": 4312, "pid": 12345, "version": "..." }`. You can also call `node <skill>/scripts/status.mjs` which reads the same file and prints the port.

If you don't have a server running yet, start it with `node <skill>/scripts/start-server.mjs` first.

## Posting JSON from a shell

Both bash and PowerShell can post JSON without writing temp files. Use a single-quoted heredoc on bash (so the shell does not interpret `$`, backticks, or `!`); use `ConvertTo-Json | curl.exe --data-binary '@-'` on PowerShell.

```bash
# bash (Git Bash on Windows works the same)
curl -sS -X POST http://localhost:4312/api/spec-sessions/by-file/comments \
  -H "Content-Type: application/json" \
  --data @- <<'PAYLOAD'
{
  "file": "C:/abs/path/to/spec.md",
  "by": "claude",
  "kind": "concern",
  "scope": "",
  "quote": "exact text from the file",
  "text": "Multi-line `markdown` body.\nNewlines are escaped as \\n inside JSON strings."
}
PAYLOAD
```

```powershell
# PowerShell (Codex default on Windows)
$body = @{
  file  = "C:/abs/path/to/spec.md"
  by    = "claude"
  kind  = "concern"
  scope = ""
  quote = "exact text from the file"
  text  = "Multi-line ``markdown`` body.`nWith embedded newlines."
} | ConvertTo-Json -Compress
$body | curl.exe -sS -X POST http://localhost:4312/api/spec-sessions/by-file/comments `
  -H "Content-Type: application/json" --data-binary '@-'
```

### The literal-newline foot-gun

**Newlines inside JSON string values must be escaped as `\n`, never embedded as raw newlines.** Express's body parser silently strips raw newlines and concatenates the line fragments into one string. The route still returns `200 OK` — your data ends up corrupted, not rejected. This is the most common way to misuse the API. Either:

1. Write the JSON inline with `\n` escapes (as in the bash example above), or
2. Build the object and serialize with `JSON.stringify` / `ConvertTo-Json -Compress`, or
3. Use the CLI's `--json-stdin` mode, which validates the JSON before posting.

## Routes

All routes return JSON. On error the response is `4xx`/`5xx` with `{"error": {"code": "...", "message": "...", "details": null}}`. The `code` values are stable identifiers — match on them, not on the message.

### `POST /api/spec-sessions/attach`

Create or re-attach a session for a file.

**Body**: `{ "file": "<absolute or cwd-relative path>" }`

**Response 200**: `{ "created": <bool>, "session": {...} }`. `created: false` when an existing session was reused (idempotent).

**Errors**: `bad_request` (file missing), `target_missing` (404, file doesn't exist), `invalid_target` (422, binary or non-UTF-8).

### `GET /api/spec-sessions`

List all sessions, sorted by `lastActiveAt` descending. Each entry includes `counts: { openComments, pendingSuggestions }` but no inline comments/suggestions.

**Response 200**: `{ "sessions": [{...}, ...] }`.

### `GET /api/spec-sessions/by-file?path=<urlencoded>`

Get session metadata for a file (no comments/suggestions).

**Response 200**: `{ "session": {...} }`. **Errors**: `bad_request`, `not_found`.

### `GET /api/spec-sessions/by-file/context?path=<urlencoded>`

Full collaboration context: session metadata + outline + comments + suggestions, each with a freshly-resolved `anchorStatus`.

**Response 200**: `{ "session", "outline", "comments", "suggestions" }`. See [Comment shape](#comment-shape) and [Suggestion shape](#suggestion-shape) below.

**Errors**: `bad_request`, `not_found`, `target_missing` (file deleted after attach).

### `GET /api/spec-sessions/by-file/content?path=<urlencoded>`

Session metadata + outline + the raw file text. Read this when you need the substantive content of the file. Returns no comments/suggestions.

**Response 200**: `{ "session", "outline", "content": "<raw file text>" }`.

### `DELETE /api/spec-sessions/by-file?path=<urlencoded>`

Remove a session and all its comments/suggestions. Does **not** delete the target file. Use when starting fresh.

**Response 200**: `{ "removed": true, "session": {...} }`.

### `POST /api/spec-sessions/by-file/move`

Move a session from one path to another (e.g. when the spec moves in the repo). Re-anchors all comments and suggestions against the new file.

**Body**: `{ "from": "<old path>", "to": "<new path>" }`

**Response 200**: `{ "session": {...} }`. **Errors**: `bad_request`, `not_found`, `invalid_target`, `conflict` (a session already exists at `to`).

### `POST /api/spec-sessions/by-file/comments`

Create a comment.

**Body**:
- `file` (string, required) — absolute or cwd-relative path.
- `by` (string, required) — actor identity (`claude`, `codex`, `human`, …).
- `kind` (string, required) — one of: `instruction`, `concern`, `question`, `evidence`, `disagreement`, `confirmation`, `recommendation`, `conclusion`.
- `scope` (string, required) — one of: `"global"`, `"section"`, or `""` (empty string for quote-anchored). The server uses this to pick the anchor branch.
- `text` (string, required) — comment body.
- For `scope: "section"`: `headingPath` (array of strings, required) — e.g. `["Top heading", "Sub heading"]`.
- For `scope: ""` (quote anchor): `quote` (string, required), plus optional `headingPath` to scope the quote search.
- For quote disambiguation when the same phrase appears more than once: `quoteOffset` (integer, char offset in file, strongest hint), `lineStart` / `lineEnd` (1-based line range, fallback hint).
- Optional: `confidence` (string, free-form).

**Response 200**: `{ "comment": {...}, ... }`. The comment's `anchorStatus` will be `resolved` for valid anchors.

**Errors**:
- `bad_request` — missing fields, invalid `kind`, `scope: "section"` without `headingPath`, etc.
- `not_found` — no session for `file`, or file deleted.
- `anchor_orphaned` (422) — `quote` doesn't match any line in the file (after the markdown-stripping fallback).
- `anchor_ambiguous` (422) — `quote` matches more than one location and no disambiguating hint resolved it; pass `quoteOffset` or a tighter `lineStart`/`lineEnd`.

### `POST /api/spec-sessions/by-file/comments/<id>/reply`

**Body**: `{ "file", "by", "text" }` (all required).

**Response 200**: the parent comment with the reply appended to `replies`.

### `POST /api/spec-sessions/by-file/comments/<id>/resolve`
### `POST /api/spec-sessions/by-file/comments/<id>/reopen`

**Body**: `{ "file", "by" }`.

**Response 200**: the comment with updated `status` (`resolved` or `open`) and `statusBy`.

### `POST /api/spec-sessions/by-file/suggestions`

Create a suggestion. **Suggestions never modify the target file** — they are proposals. Use `apply` to write.

**Body** — same anchor fields as a comment, plus:
- `kind` (string, required) — one of: `replace`, `insert_after`, `delete`.
- `content` (string) — replacement / insertion text. Required for `replace` and `insert_after`. May be empty for `delete`.
- `rationale` (string, optional) — why this edit helps.
- `scope` cannot be `"global"`. Use `"section"` (with `headingPath`) or `""` (with `quote`).
- Literal escapes (`\n`, `\r`, `\t`, `\\`) in `content` are decoded; line endings are normalized to the file's detected style.

**Response 200**: `{ "suggestion": {...}, ... }`.

**Errors**: `bad_request` (including the `unsupported_suggestion_anchor` case for `section + (replace|delete)` — only `insert_after` works with section anchors), plus the same `anchor_*` errors as comments.

### `POST /api/spec-sessions/by-file/suggestions/<id>/reply`

**Body**: `{ "file", "by", "text" }`. Same shape as comment reply.

### `POST /api/spec-sessions/by-file/suggestions/<id>/accept`
### `POST /api/spec-sessions/by-file/suggestions/<id>/reject`
### `POST /api/spec-sessions/by-file/suggestions/<id>/reopen`

Status transitions; do **not** modify the target file. **Body**: `{ "file", "by" }`. **Response 200**: the updated suggestion.

### `POST /api/spec-sessions/by-file/suggestions/<id>/preview`

Re-resolve the anchor and produce a diff without writing.

**Body**: `{ "file" }`.

**Response 200**: `{ "suggestion", "preview": { "kind", "before", "after", "diff", "anchorStatus", "willChange" } }`.

**Errors**: `anchor_orphaned`, `anchor_ambiguous`, `unsupported_suggestion_anchor`.

### `POST /api/spec-sessions/by-file/suggestions/<id>/apply`

Apply the suggestion: write the file. Only do this when the user explicitly asks. For `replace` suggestions the server re-anchors any sibling suggestions and comments whose anchor range overlapped the replaced span — char-offset overlap when both sides have `offset`, line-range overlap when one side lacks it, and exact-quote equality as a final fallback for legacy records. Each rewritten anchor gets an `anchorRewrittenAt` timestamp; the suggestion's pre-apply anchor is stored as `originalAnchor` for rollback.

**Body**: `{ "file", "by" }`.

**Response 200**: `{ "suggestion": { ..., "status": "applied", "appliedBy", "appliedAt", "beforeHash", "afterHash", "originalAnchor" }, "preview": {...} }`.

**Errors**: `bad_request`, `not_found`, `anchor_orphaned`, `anchor_ambiguous`, `conflict` (already applied / rejected / stale), `drift` (file changed since suggestion was created — hash mismatch).

### `POST /api/spec-sessions/by-file/suggestions/<id>/rollback`

Reverse a previously-applied suggestion. **Body**: `{ "file", "by" }`. Refuses with `conflict` if the file changed since `apply` (hash mismatch), `rollback_unsupported` for `delete`, or `rollback_ambiguous` / `rollback_mismatch` if the post-apply content can no longer be unambiguously reverted.

### `GET /health`

Returns `{ "ok": true }`. Useful to confirm the server is alive at a given port.

### `POST /api/shutdown`

Graceful shutdown. Returns `{ "shuttingDown": true }`. Used by `restart-server.mjs`; agents should not need to call this.

## Comment shape

```jsonc
{
  "id": "cmt_000001",
  "by": "claude",
  "kind": "concern",
  "status": "open",                    // open | resolved | accepted | rejected | deferred | stale
  "anchor": {
    "scope": "anchor",                 // global | section | anchor
    "quote": "...",                    // for quote anchors
    "headingPath": ["Top", "Sub"],     // canonical full path; for section or quote+section
    "lineStart": 21,                   // anchor's 1-based line in the file at creation time
    "lineEnd": 21,
    "offset": 211,                     // char offset of the quote in the file at creation time
    "selectedHash": "sha256:...",
    "fileHash": "sha256:..."
  },
  "anchorStatus": {                    // re-computed every read
    "status": "resolved",              // resolved | orphaned | ambiguous
    "strategy": "line_range",          // global | heading_path | line_range | heading_quote | quote | missing_quote
    "lineStart": 21,
    "lineEnd": 21
  },
  "text": "...",
  "confidence": "",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "statusBy": "human",                 // present after a status change
  "anchorRewrittenAt": "ISO8601",      // present when the apply cascade re-anchored this comment
  "replies": [
    { "id": "rpl_000001", "by": "human", "text": "...", "createdAt": "ISO8601" }
  ]
}
```

## Suggestion shape

Same as a comment, plus `content`, `rationale`, and apply-time fields (`appliedBy`, `appliedAt`, `beforeHash`, `afterHash`, `originalAnchor`, `anchorRewrittenAt`).

```jsonc
{
  "id": "sug_000001",
  "by": "claude",
  "kind": "replace",                   // replace | insert_after | delete
  "status": "pending",                 // pending | accepted | rejected | applied | stale
  "anchor": { ... },
  "anchorStatus": { ... },
  "content": "replacement text",
  "rationale": "why",
  "confidence": "",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "replies": []
  // After apply: status="applied", appliedBy, appliedAt, beforeHash, afterHash,
  //              originalAnchor (the pre-apply anchor; used by rollback)
  // After cascade re-anchor: anchorRewrittenAt
}
```

## Anchor matching (server-side)

These rules apply on every create AND on every read (via `anchorStatus`). They are server-side; the CLI does not add anything on top.

**Heading anchors** (`scope: "section"`):
1. Exact full-path match.
2. Unicode-NFC-normalized comparison (case-insensitive, em-dash → hyphen).
3. Unique suffix match.
4. Unique leaf-only match.

If multiple headings match at the same precedence level, the server returns `anchor_ambiguous` with the candidate full paths in the error `details`. Pass the full path explicitly to disambiguate.

**Quote anchors** (`scope: ""`, with `quote`):
1. Literal substring match.
2. Both sides stripped of inline markdown markers (backticks, `*`, `_`, leading `### `).

If the quote matches more than one location:
- `quoteOffset` (char offset) selects the exact occurrence — strongest hint.
- `lineStart` / `lineEnd` narrows by row range — fallback when offset is unknown.
- Without either, the server returns `anchor_ambiguous`.

**Pick a quote that's unique.** A whole sentence is usually unique; a single word rarely is.
