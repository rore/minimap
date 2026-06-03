# Spec view — "On this page" table of contents

**Status:** Design / approved for planning
**Date:** 2026-06-03
**Scope:** UI only (`package/minimap/ui/`). No CLI or backend changes.

## Problem

Long specs (e.g. `docs/specs/2026-05-31-operational-fact-memory-design.md`)
have no in-page navigation. Readers scroll blindly or use browser find. The
spec workbench already shows a sessions sidebar on the left and a comments
margin on the right, but neither tells you *where you are inside the current
document*.

## Goal

Add a Docusaurus-style "On this page" table of contents that:

- lists the H2 and H3 headings of the open spec
- has its own scroll independent of the doc body
- highlights the section currently in view
- jumps to a section on click and updates the URL hash
- collapses to a narrow rail when the user wants more reading width

Everything else (sessions sidebar, comments margin, gutter resizer,
suggestion anchoring) stays as-is.

## Layout

The TOC becomes a fourth grid column inside `.spec-doc`, on the **left** of
the body. The existing 3-column grid

```
spec-body | gutter (14px) | margin
```

becomes

```
spec-toc | spec-body | gutter (14px) | margin
```

The outer `spec-workbench` grid (`sessions-sidebar | spec-pane`) is
unchanged. So the full picture from left to right is:

```
sessions-sidebar │ TOC │ doc body │ gutter │ comments margin
```

The TOC column has two states:

- **Expanded** — fixed width, ~200px, shows the heading list.
- **Collapsed** — narrow rail, ~28–32px, shows only the toggle button.

Collapsed state is per-user, persisted in `localStorage` under
`minimap.spec.toc.collapsed`, parallel to the sessions sidebar's existing
collapse memory.

The TOC's inner panel uses `position: sticky; top: 0; max-height: 100vh;
overflow-y: auto;` so it scrolls independently of `.spec-doc`'s scroll.
This matches Docusaurus's behavior and avoids a custom scroll listener.

### Narrow widths

Below `min-width: 900px` on the spec pane, the TOC defaults to collapsed.
The user can still expand it manually. This keeps narrow windows readable.

If a doc has zero H2/H3 headings, the TOC auto-collapses and the toggle is
disabled until headings appear (e.g. while editing).

## Building the TOC

The TOC is built from the rendered DOM, not by re-parsing markdown. After
`render.js` paints `.spec-body`, a new `buildSpecToc()` helper:

1. Walks `spec-body.querySelectorAll("h2, h3")` in document order — the
   same set `headingElementForPath()` already uses for anchor resolution,
   so the TOC and the rest of the system agree on what counts as a
   heading.
2. Ensures each heading has a stable `id`. If one is already set by the
   markdown renderer, reuse it. Otherwise generate a slug:
   `kebab-case(textContent)` with a `-2`, `-3`… suffix on collisions
   *within the current doc*. IDs are recomputed on every rebuild — they
   are not persisted, since markdown source can change.
3. Builds a flat `<ul>` of `<a href="#slug">` anchors. H3 entries get a
   marker class (`is-sub`) that adds `padding-left` so the indent is
   styling, not nesting. Flat DOM keeps the active-class logic trivial.
4. Wires a single `IntersectionObserver` over all the heading elements;
   the topmost heading currently above the fold gets `is-active` on its
   TOC link.

### When the TOC rebuilds

The TOC is rebuilt whenever `.spec-body` is rebuilt:

- a different spec is opened
- a suggestion is applied (body re-renders)
- view-mode toggles (read ↔ review)
- any other render path that already calls into `render.js`

Hooking into the existing render path (rather than a `MutationObserver`)
keeps the rebuild cost predictable and matches how the rest of the spec
subsystem works.

## Interaction

- **Click → jump.** Each TOC entry is a real `<a href="#slug">`. The
  click handler calls `element.scrollIntoView({behavior: "smooth", block:
  "start"})` and the URL hash is updated so the position is shareable
  and back/forward work.
- **Deep-link on load.** After the first render, if the URL has a hash,
  scroll the matching heading into view. Same hook the rebuild uses, so
  this works both on initial open and after the doc body re-renders.
- **Keyboard.** Real anchors → Tab, Enter, middle-click "open in new
  tab" all work for free. No custom keyboard handling.
- **Toggle button.** A chevron at the top of the TOC column, mirroring
  `.spec-sidebar-toggle`. Collapsed rail shows the chevron pointed the
  other way.
- **Resizing.** The body/margin gutter resizer is unchanged. The TOC
  width is fixed in v1; if users want it resizable, we add it later.

## Styling

Visual treatment matches the existing spec workbench palette
(`--spec-muted`, `--spec-text`, `--spec-accent`, `--spec-line`,
`--spec-panel`, etc.). All values listed below are starting points;
final pixels are for visual review.

- **Container.** No background card or border on the column itself —
  flush against `--spec-bg` like the comments margin. A 1px right border
  in `--spec-line` separates it from the body.
- **Header label.** "On this page", uppercase, 0.78rem, weight 600,
  `--spec-muted`. Same scale as `.spec-sidebar-head h2`.
- **Links.** `--spec-muted` default, `--spec-text` on hover,
  `--spec-accent` when active. No underline. ~0.83rem font.
- **Indent.** H3 entries: `padding-left: 12px` extra. Flat list, no
  nested `<ul>`.
- **Active marker.** 2px left border in `--spec-accent` on the active
  link, with link text shifted right by 2px so nothing jumps.
- **Truncation.** `white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis;` plus `title` attribute carrying the full
  text.
- **Collapsed rail.** Toggle button centered vertically, same idiom as
  `.spec-sidebar[data-collapsed="true"]`.

## Files touched

- **`package/minimap/ui/index.html`** — add an `<aside class="spec-toc"
  id="spec-toc">` element as the first child of `.spec-doc`, before
  `.spec-body`.
- **`package/minimap/ui/spec/render.js`** — after rendering `.spec-body`,
  call a new `buildSpecToc()` helper. Helper lives in this file (or a new
  small `spec/toc.js` if it grows past ~100 LOC) and reuses
  `normalizeVisibleText()` and the heading-walk pattern already present.
- **`package/minimap/ui/styles.css`** — new `.spec-toc`, `.spec-toc-list`,
  `.spec-toc-link`, `.spec-toc-link.is-sub`, `.spec-toc-link.is-active`,
  collapsed-rail rules; update `.spec-doc` `grid-template-columns` to add
  the leading TOC column (with a CSS var `--spec-toc-w` so collapsed/
  expanded width is one source of truth).
- **`package/minimap/ui/spec/index.js`** — no change. The TOC is internal
  to render.js.
- **`package/minimap/ui/spec/composer.js`** — no change.

`localStorage` key: `minimap.spec.toc.collapsed` (string `"true"` /
`"false"`, parallel to existing keys).

## Testing

- **Existing UI lint suites still apply.** No new void `api.*` calls, no
  unsafe interpolation, no DOM-leak regressions (the leak watcher catches
  unbounded re-renders from commit `56490b1`).
- **New: `tests/ui/spec-toc.test.js`** — opens a fixture spec with
  multiple H2/H3, asserts:
  1. the TOC contains one link per heading, in order
  2. clicking a link scrolls the matching heading into view and sets
     `is-active` on that link
  3. collapsing/expanding hides/shows the list and persists across
     re-render
  4. a doc with zero H2/H3 leaves the TOC in its empty/collapsed state
- **Manual visual review** — open
  `docs/specs/2026-05-31-operational-fact-memory-design.md` in the spec
  workbench and confirm the rail looks right at full width and at narrow
  widths (around the 900px breakpoint).

## Out of scope (v1)

- User-resizable TOC width (fixed for now).
- TOC for headings inside admonitions, tables, or other non-flow blocks.
- Showing comment/suggestion counts next to TOC entries.
- Mobile-specific drawer affordance.
- Persisting per-spec scroll position across sessions.
- TOC for the roadmap UI (this design covers `spec-workbench` only).
