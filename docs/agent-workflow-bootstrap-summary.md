# agent-workflow bootstrap — verification self-summary

Generated 2026-10-01. Installed locally; no files staged, committed, or pushed by bootstrap finalization.

## Installed (ready for review)

| Control | Path | Notes |
|---|---|---|
| agent-workflow skill | `.claude/skills/agent-workflow/` and `.agents/skills/agent-workflow/` | Identical manifests; native discovery for Claude Code and Codex |
| agent-workflow config | `agent-workflow.yaml` | Backend: local, redline: required |
| agent-redline policy | `agent-redline-policy.yaml` | New approved Node zone-only policy; shadow mode |
| Vendored agent-workflow checker | `scripts/agent-workflow-check.py` | Copied from released Agent Workflow 468f1d5fa5cf856bfd45ebb4ff041bbacc714b02 |
| Vendored agent-redline reporter | `scripts/agent-redline-report.py` | Bundled reporter copied verbatim from Agent Workflow release 468f1d5fa5cf856bfd45ebb4ff041bbacc714b02; separate Redline revision not asserted |
| Runtime adapters | `scripts/agent-workflow-runtime.py/.sh/.ps1` | Shared guard; shell mutation remains outside runtime enforcement |
| Runtime settings | `.claude/settings.json`, `.codex/hooks.json` | Merged without removing third-party hooks; Codex project trust required |
| Suppression markers | `.agent-redline/suppressions.yaml` | Node exemptions: `[]`; protected contract tests remain guarded |
| Root AGENTS.md reference section | `AGENTS.md` | Owned marker appended; original HEAD bytes preserved exactly |
| Per-checkpoint docs (agent-workflow) | `.claude/skills/agent-workflow/templates/checkpoints/`; `.agents/skills/agent-workflow/templates/checkpoints/` | Installed skill package |
| Per-checkpoint docs (redline) | `docs/agent-redline/skills/` | blue-zone, red-zone, gray-zone, boundary-violation, pr-discipline |
| Work Record skeleton | `.agent-workflow/tasks/README.md` | Explains the `{slug}.md` convention |
| OpenCode plugin | `.opencode/plugins/agent-workflow.mjs` | Stable OpenCode 1.x seed + structured-mutation guard; OpenCode 2 beta excluded |
| CI workflow | `.github/workflows/agent-workflow.yml` | Installed in Phase 5 after explicit user confirmation on 2026-10-01; released template plus merge-base numstat and zero-context diff reporter inputs |

## Runtime coverage

| Runtime | Integration | Native mutation coverage | Evidence scope |
|---|---|---|---|
| Claude Code | Installed | Degraded | Four hooks installed; no denied native mutation demonstrated; runtime version/surface coverage unverified |
| Codex | Installed | Degraded | Two portable hooks installed; project trust and denied native mutation unverified |
| OpenCode | Installed plugin | Degraded | Stable 1.x only; no runtime/version or denied native mutation demonstrated |

Installation, trust, and direct checks do not verify coverage.

## Proposed (not applied to platform)

| Control | Path | Notes |
|---|---|---|
| CI proposal | `docs/agent-workflow-ci-proposal.md` | Workflow installed; required-status-checks, conversation resolution, and CODEOWNERS additions remain proposals |

## Needs human action

| Control | What's missing | How to address |
|---|---|---|
| Branch protection rules | Required checks `agent-workflow` and `redline` (bare job names, NOT `workflow / job` — that's display-only) are not in branch protection | Apply via repo settings → Branches → Add rule. The proposal doc names the exact check names. |
| CODEOWNERS additions | `agent-redline/` and `agent-workflow.yaml` not owned in CODEOWNERS | Edit `.github/CODEOWNERS`. The proposal doc names suggested owners. |
| Redline mode flip | Currently `shadow` | After 4 weeks / 30 PRs, flip to `binding` per redline's Phase 5 recommendation. |
| Combined PR execution | PR 38 ran the template, but its reporter lacked suppression and line-count inputs; corrected wiring has not run | Verify `redline`, `agent-workflow`, and existing `test` checks on the PR. |
| Behavior contracts | Selected workflow protection remains pending; no combined PR evidence yet | Enable the approved block only after named verification and combined harness PR execution evidence are complete. |

## Backend reachability probe

Bootstrap probed the Work Record backend:

- **Backend:** local
- **Interpreter:** `C:/Dev/rore/agent-workflow/.venv/Scripts/python.exe` (Python 3.12.14; existing external environment with PyYAML/jsonschema; selected explicitly through `PYTHON`)
- **Probe:** ran installed PowerShell adapter `codex check --repo-root . --slug _probe` on temporary `_probe.md`; retried with `--redline-verdict <temporary reporter verdict>`
- **Outcome:** Pass on retry: exit 0 / clean with genuine reporter-generated low-risk evidence. Literal template command exited 2 because `redline: required` requires a verdict that the probe instructions omit. No configuration was weakened.
- **Cleanup:** `_probe.md` removed after the probe

## Could not verify

- Combined PR execution and resulting PR checks have not run. Behavior-contract activation remains pending.
- Installed hooks do not demonstrate interception or project trust. Shell mutations bypass runtime guards.
- The external selected interpreter proves backend reachability only; portable Python discovery and persistent hook prerequisites remain unverified. No environment was installed.
- Platform protection and CODEOWNERS changes were not applied.
- Skill feedback remains unsent: the bare backend-probe instructions omit the required Redline verdict; combined versus standalone bootstrap documentation paths differ, and the summary template assumes a test exemption that Node overrides. Root records and routes feedback.

## Focused verification evidence

- Two complete package copies: 71 files each; manifests identical; all 140 recorded entries have the specified byte size and exact source bytes. Twenty vendored root artifacts also match source bytes.
- Both configuration schemas pass; hook installers are idempotent; AGENTS marker reconciliation is idempotent.
- Genuine reporter-backed applicability checks: approved ordinary-doc-only paths return exit 0 without a Work Record. README mixed with a roadmap feature, CONTRACT, or generated runtime returns exit 2 and requires a Work Record. Missing risk evidence also blocks.
- Probe and temporary risk-evidence files were removed after the successful retry.
- Workflow YAML parses, has exactly `redline` and `agent-workflow` jobs, retains `needs: [redline]`, and is derived from the release template with four added lines generating and passing `--lines-per-file` and `--diff-unified`; all existing gates and captured exit codes remain.

- Additional unsent upstream feedback: the combined CI template omits `--diff-unified` and `--lines-per-file`, so suppression detection silently does nothing and per-file line counts are absent. Minimap wires merge-base-to-head numstat and `-U0` diff to the reporter; the earlier PR 38 redline pass is not equivalent evidence for corrected CI.
