<!-- agent-workflow:start -->
**Outcome:** The participant panel shows useful participant information first and keeps technical details available without dominating the board.

**Target:** Minimap UI; roadmap/features/distinguish-recent-dormant-participants.md.

**Scope:** Participant panel in `package/minimap/ui/app.js` and `index.html` styles, plus focused Playwright coverage and runtime mirror sync if required.

**Constraints:** No API/backend or participant meaning changes. Preserve participant links, all technical metadata, partial/error notices, and accurate Recent/Dormant semantics.

**Completion criteria:** When a participant panel is opened with one recent participant, the visible panel prioritizes participant identity and last-seen information and is about 150–200px tall on desktop; dormant and technical details remain accessible, and browser coverage verifies desktop/narrow layouts across both board layouts.

**Requirement baseline:**
{"source":"work-record-initial","outcome":"The participant panel shows useful participant information first and keeps technical details available without dominating the board.","scope":"Participant panel in `package/minimap/ui/app.js` and `index.html` styles, plus focused Playwright coverage and runtime mirror sync if required.","constraints":"No API/backend or participant meaning changes. Preserve participant links, all technical metadata, partial/error notices, and accurate Recent/Dormant semantics.","completion_criteria":"When a participant panel is opened with one recent participant, the visible panel prioritizes participant identity and last-seen information and is about 150–200px tall on desktop; dormant and technical details remain accessible, and browser coverage verifies desktop/narrow layouts across both board layouts."}

**Relationships:**
{"schema_version":1,"sources":[{"provider":"minimap","scope_ref":"roadmap:v1:git:github.com/rore/minimap#roadmap","local_ref":"item:v1:distinguish-recent-dormant-participants"}],"pull_requests":["https://github.com/rore/minimap/pull/59"]}

**Risk:** High

**Complexity:** Moderate

**Reason:** Redline reports RED because `playwright/roadmap-ui.spec.js` is an explicit safety/acceptance contract. High risk follows the contract checkpoint. The UI behavior is one coherent change, with moderate complexity for responsive and keyboard-accessible disclosure behavior.

**Discovery:** `renderItemParticipants` currently writes full paragraphs and technical/session metadata before the participant rows. `index.html` wraps the panel in native details; `styles.css` allows a 60vh panel and 52vh body. Existing Playwright coverage checks all lifecycle groups, provider badges, links, refresh behavior, copy reference, and both board layouts. Several tests use a broad `#item-participants summary` selector, which must be narrowed to the panel summary before adding nested disclosures. The related done feature is `distinguish-recent-dormant-participants`, resolved through the roadmap CLI to the relationship tuple above; its acceptance criteria require freshness caveats and preserve participant session/container/availability/origin data. Redline for planned files returned RED: `playwright/roadmap-ui.spec.js` is red as a safety/acceptance regression contract; UI files are gray; no boundary violations. `behaviorContractChanges` is workflow-protected with verification `test`.

**Material assumptions:** The existing participant API already provides all displayed values and existing `buildParticipantNameHtml` safely preserves the session link and accessible name. If the payload lacks a reliable provider or identity fallback, keep the current safe fallback rather than deriving one.

**Plan:** Keep the outer Participants disclosure and status counts. Render recent participants first as compact identity/provider/last-seen rows with technical metadata in native per-person disclosures. Put dormant and closed sessions in separate native disclosures after recent participants. Move scope/item reference and longer guidance after participants into native expandable details, retaining the copy action and a short visible hint clarifying that Recent means last seen within the activity window, does not mean working now, and Dormant does not mean complete. Keep partial/error notices visible. Preserve panel scrolling and keep disclosure summaries free of nested buttons. Narrow existing selectors to target the outer summary. Add or extend browser coverage for full metadata/link preservation, expanded details, keyboard operation, visible notices, approximate panel height, and screenshots at desktop/narrow widths in List and Columns. Sync mirrors after UI edits. Stop if requested coverage needs changes to API semantics.

**Verification plan:** test: A one-recent-participant panel is approximately 150–200px tall on desktop without fixed-height clipping; the row shows identity/provider/last-seen and disclosures preserve every existing session, lifecycle, destination, origin, reference, and link value. test: Keyboard tests exercise native disclosures; partial/error notices and panel scrolling remain usable. manual: Capture screenshots with details open in List and Columns at desktop and narrow widths. test: Run focused Playwright participant tests, `node scripts/sync-mirrors.mjs`, mirror byte-parity, and the Agent Workflow checker using the existing Agent Workflow venv.

**Plan review:** Agent technical review: `/root/scan_review` — approved with no blockers on base `bb2a086`; reviewer inspected panel rendering, CSS bounds, and current participant/browser tests.

**Approvals:** Approved by user 2026-10-18: "ok. now it's fast. now look at the participant section - why so large? and a lot of text no one follows. can't we make this better?"

**Exceptions:** —

**Behavior changes:** [{"target":"repository-contract","path":"playwright/roadmap-ui.spec.js","classification":"requirement-change","before":"Expanded participant details show all lifecycle groups, each participant's session/container references, provider and availability, origins and freshness inline, preceded by full guidance and references.","after":"The open panel presents Recent participants first with identity/provider/last-seen visible. Dormant and closed groups, per-session technical metadata, scope/item references, and long guidance remain accessible through native disclosures. Existing participant links, lifecycle, destination, origins, session/container values, partial/error states, and copy-reference action remain available and correctly labelled.","reason":"The user asked to make the oversized participant section easier to scan while retaining its information.","impact":"Technical detail and long guidance become opt-in; this reduces default visual height without deleting data or changing lifecycle semantics.","alternatives":"Keeping every field expanded preserves the current height problem. Hiding or removing metadata would lose useful detail.","authority":{"scope":"task","name":"task-owner"},"approval":{"by":"user","reference":"user request in this conversation, 2026-10-18","verbatim":"ok. now it's fast. now look at the participant section - why so large? and a lot of text no one follows. can't we make this better?"}}]

<!-- Ready to implement -->
**State:** Ready for review
<!-- agent-workflow:end -->

## Implementation

Planning record committed before product-code edits as `5c0f5d9`. Initial Redline attempt used the bundled Python runtime and found PyYAML missing; no dependency installation was attempted. Re-ran with the existing Agent Workflow environment at `C:/Dev/rore/agent-workflow/.venv/Scripts/python.exe`: planned UI paths are gray, `playwright/roadmap-ui.spec.js` is red for safety/acceptance, with no boundary violation. Plan review approved by `/root/scan_review`; user authorization covers this UI simplification and its tests.

The recent participant row now appears first with its session link, provider, and last-seen time. Per-session metadata remains under native disclosures; dormant/closed sessions and reference/guidance are separately collapsed. The short hint keeps the Recent/Dormant caveats visible. Same-item refresh retains disclosure state, while changing participant scope collapses the reference disclosure. CSS reduces default height without clipping. The one-recent browser fixture measures 192.1px and has no inner scrollbar. Both packaged runtime mirrors were regenerated from the canonical UI.

Focused Playwright: the main participant test passed for List and Columns, including keyboard disclosure, metadata/link checks, refresh state, and five screenshots; the linked-name fallback test passed; the 200-record usability test passed; and the one-participant sizing test passed. A focused dense-board test exercised its cases but failed during Windows temp-fixture cleanup with `EBUSY` while removing `%TEMP%\\minimap-large-roadmap-*`; the remaining tests in that invocation were rerun separately and passed. No fixture assertions were weakened. Screenshots are available in `artifacts/compact-participants/`: `participant-detail-list-desktop.png`, `participant-detail-list-narrow.png`, `participant-detail-columns-desktop.png`, `participant-detail-columns-narrow.png`, and `participant-detail-expanded-reference.png`.

`node --check` passed for `package/minimap/ui/app.js` and `playwright/roadmap-ui.spec.js`; `git diff --check` passed. Runtime mirror sync completed. The complete workflow check with fresh Redline and NUL path evidence is advisory only because the repository runs its architecture-review checkpoint in shadow mode; the acceptance-contract classification and user authority checks passed. The redline-free direct check is not valid evidence because this repository requires Redline input.

Product change committed as `65c0639` (`Compact participant details panel`).

## Result review

Agent technical review: `/root/scan_review` approved the final UI and test changes; all review findings were resolved.
Reviewed revision: `65c0639` (`Compact participant details panel`).
Verification adequacy: adequate for the UI change based on focused List/Columns, fallback, dense-record, and 192.1px sizing browser coverage plus desktop/390px screenshots. The dense-board fixture cleanup `EBUSY` remains recorded for CI follow-up; its scenario assertions completed before cleanup failed.

## Discovery update

`renderItemParticipants` emits guidance and session/container/state metadata ahead of the participant rows. The existing lazy-load test already covers both List and Columns plus session links, lifecycle labels, and request scoping; it can be extended rather than duplicated. Existing summary selectors will need to target the outer disclosure explicitly once native per-person disclosures are added.
