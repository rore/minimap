<!-- agent-workflow:start -->
**Outcome:** The participant panel shows useful participant information first and keeps technical details available without dominating the board.

**Target:** Minimap UI.

**Scope:** Participant panel in `package/minimap/ui/app.js` and `index.html` styles, plus focused Playwright coverage and runtime mirror sync if required.

**Constraints:** No API/backend or participant meaning changes. Preserve participant links, all technical metadata, partial/error notices, and accurate Recent/Dormant semantics.

**Completion criteria:** When a participant panel is opened with one recent participant, the visible panel prioritizes participant identity and last-seen information and is about 150–200px tall on desktop; dormant and technical details remain accessible, and browser coverage verifies desktop/narrow layouts across both board layouts.

**Requirement baseline:**
{"source":"work-record-initial","outcome":"The participant panel shows useful participant information first and keeps technical details available without dominating the board.","scope":"Participant panel in `package/minimap/ui/app.js` and `index.html` styles, plus focused Playwright coverage and runtime mirror sync if required.","constraints":"No API/backend or participant meaning changes. Preserve participant links, all technical metadata, partial/error notices, and accurate Recent/Dormant semantics.","completion_criteria":"When a participant panel is opened with one recent participant, the visible panel prioritizes participant identity and last-seen information and is about 150–200px tall on desktop; dormant and technical details remain accessible, and browser coverage verifies desktop/narrow layouts across both board layouts."}

**Relationships:**
{"schema_version":1,"sources":null,"pull_requests":[]}

**Risk:** High

**Complexity:** Moderate

**Reason:** Redline reports RED because `playwright/roadmap-ui.spec.js` is an explicit safety/acceptance contract. High risk follows the contract checkpoint. The UI behavior is one coherent change, with moderate complexity for responsive and keyboard-accessible disclosure behavior.

**Discovery:** `renderItemParticipants` currently writes full paragraphs and technical/session metadata before the participant rows. `index.html` wraps the panel in native details; `styles.css` allows a 60vh panel and 52vh body. Existing Playwright coverage checks all lifecycle groups, provider badges, links, refresh behavior, copy reference, and both board layouts. Several tests use a broad `#item-participants summary` selector, which must be narrowed to the panel summary before adding nested disclosures. Redline for planned files returned RED: `playwright/roadmap-ui.spec.js` is red as a safety/acceptance regression contract; UI files are gray; no boundary violations. `behaviorContractChanges` is workflow-protected with verification `test`.

**Material assumptions:** The existing participant API already provides all displayed values and existing `buildParticipantNameHtml` safely preserves the session link and accessible name. If the payload lacks a reliable provider or identity fallback, keep the current safe fallback rather than deriving one.

**Plan:** Keep the outer Participants disclosure and status counts. Render recent participants first as compact identity/provider/last-seen rows with technical metadata in native per-person disclosures. Put dormant and closed sessions in separate native disclosures after recent participants. Move scope/item reference and longer guidance after participants into native expandable details, retaining the copy action and a short visible hint clarifying that Recent measures last-seen activity and Dormant does not mean complete. Keep partial/error notices visible. Preserve panel scrolling and keep disclosure summaries free of nested buttons. Narrow existing selectors to target the outer summary. Add or extend browser coverage for full metadata/link preservation, expanded details, keyboard operation, visible notices, approximate panel height, and screenshots at desktop/narrow widths in List and Columns. Sync mirrors after UI edits. Stop if requested coverage needs changes to API semantics.

**Verification plan:** Browser assertion verifies a one-recent-participant panel is approximately 150–200px tall on desktop without fixed-height clipping; assertions verify the row shows identity/provider/last-seen and the disclosures preserve every existing session, lifecycle, destination, origin, reference, and link value. Keyboard tests exercise native disclosures. Partial/error notices and panel scrolling remain usable. Capture screenshots with the details open in List and Columns at desktop and narrow widths. Run focused Playwright participants tests, then `node scripts/sync-mirrors.mjs` and mirror checks if canonical UI changed.

**Plan review:** Agent technical review: `/root/scan_review` — approved with no blockers on base `bb2a086`; reviewer inspected panel rendering, CSS bounds, and current participant/browser tests.

**Approvals:** Approved by user 2026-10-18: "ok. now it's fast. now look at the participant section - why so large? and a lot of text no one follows. can't we make this better?"

**Exceptions:** —

<!-- Ready to implement -->
**State:** Ready to implement
<!-- agent-workflow:end -->

## Implementation

Planning record created before product-code discovery. Initial Redline attempt used the bundled Python runtime and found PyYAML missing; no dependency installation was attempted. Re-ran with the existing Agent Workflow environment at `C:/Dev/rore/agent-workflow/.venv/Scripts/python.exe`: planned UI paths are gray, `playwright/roadmap-ui.spec.js` is red for safety/acceptance, with no boundary violation. Plan review approved by `/root/scan_review`; user authorization covers this UI simplification and its tests.

## Discovery update

`renderItemParticipants` emits guidance and session/container/state metadata ahead of the participant rows. The existing lazy-load test already covers both List and Columns plus session links, lifecycle labels, and request scoping; it can be extended rather than duplicated. Existing summary selectors will need to target the outer disclosure explicitly once native per-person disclosures are added.
