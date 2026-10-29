# Source-only baseline privacy migration

Use only to redact private `Requirement baseline.source` provenance with explicit human approval. Keep original evidence in ignored local storage; never copy private values or their hashes into public records, commits, PRs, logs or receipts. This edits current content; shared history still contains the original. Do not rewrite shared history without separate authorization.

Before editing, resolve the configured Work Record path and the checker-selected trusted baseline anchor using the actual PR base/head history. Obtain approval binding that exact repository-relative path, full anchor commit and proposed public-safe replacement. Reuse approval covering this tuple; generic task approval does not suffice. Keep unavailable or ambiguous history blocked.

Add this optional field inside the existing marker block, in either record shape:

```text
**Baseline privacy migration:**
{"schema_version":1,"record_path":".agent-workflow/tasks/example.md","anchor_commit":"<full checker-selected commit>","replacements":{"source":"<approved public-safe source>"},"reason":"Privacy redaction preserving authority and requirements.","approval":{"by":"user","reference":"<public-safe approval reference>","verbatim":"<truthful approval of this bound migration>"}}
```

Replace placeholders with approved evidence. Use exactly these keys; `replacements` permits only a nonempty `source` string. The old source must exist and differ. Do not add old values or hashes. Keep all four functional baseline values, current Task Context and existing parsed Behavior changes unchanged from immediately before redaction. Missing/malformed old history cannot be repaired by this receipt. Protected functional text requires a separate supported change route; this migration cannot sanitize it.

Commit the source replacement and receipt together. Validate the committed result with both actual refs:

An already committed redaction cannot be blessed by appending a receipt. Do not restore private text; coordinate a fresh reviewed branch from a trusted pre-redaction PR base, carrying functional changes separately, or report the unavailable route. If the unmerged PR base advances, recheck the selected anchor and exact approval binding; never rebind a committed receipt to make it pass.

```bash
python scripts/agent-workflow-check.py --repo-root . --slug <slug> --base-ref <base> --head-ref <head>
```

In this source repository use `python -m core.checker` instead. Inspect `requirements.baseline_unchanged` and the complete verdict; run the required repository checks. A receipt without valid base/head history fails, including local calls. Callers that omit refs cannot verify migrated records; use the history-aware CLI/CI surface and report that limitation.

Retain the exact receipt and sanitized source in every later descendant; never remove, rebind to a newer base, replay for another record or redact source again. Later normal Task Context changes still require the existing Behavior changes chain. Fail closed on an ambiguous migration merge.

Review approval authenticity, privacy and meaning separately: the checker validates structure and visible Git history, not human authorship, semantic equivalence or rewritten history. Full contract: SPEC §9.1.
