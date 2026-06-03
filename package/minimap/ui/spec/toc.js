// package/minimap/ui/spec/toc.js
//
// "On this page" table of contents for the spec workbench.
// Builds a link list from the rendered .spec-body DOM, tracks the
// active section with a single IntersectionObserver, and persists
// collapsed state to localStorage. No framework; pure browser APIs.
//
// Initialized via wireSpecToc({ dom, helpers }) at startup.
// Re-render entry point is buildSpecToc({ bodyEl, tocEl, listEl }),
// called from spec/render.js after the body is rebuilt.

// Convert a heading's textContent into a stable, unique HTML id slug.
// `taken` is a Set of slugs already used in this rebuild — pass it so
// duplicate headings get -2, -3, … suffixes deterministically.
//
// Rules (kept simple on purpose):
//   - lowercase
//   - drop ASCII punctuation; collapse whitespace and dashes
//   - keep non-ASCII letters as-is (HTML ids allow them)
//   - empty result falls back to "section"
//   - mutate `taken` with the chosen slug so the caller's loop stays correct
export function slugifyHeadingId(text, taken) {
  const base = String(text || "")
    .toLowerCase()
    // strip ASCII punctuation but keep letters/digits/underscores from any script
    .replace(/[!"#$%&'()*+,./:;<=>?@\[\\\]^`{|}~]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const seed = base || "section";
  if (!taken.has(seed)) {
    taken.add(seed);
    return seed;
  }
  for (let n = 2; ; n += 1) {
    const candidate = `${seed}-${n}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}

// Collapse runs of any whitespace (including newlines from rendered HTML)
// to single spaces, then trim. Used for both id-slug input and display text.
function normalizeHeadingText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

// Turn a list of heading elements into the model the renderer consumes.
// Each entry: { level, id, text }. Existing ids are kept; missing ids are
// generated via slugifyHeadingId() and assigned via opts.assignId so the
// pure function stays unit-testable with non-DOM stand-ins.
export function buildSpecTocModel(headings, opts) {
  const assignId = opts && opts.assignId;
  const taken = new Set();
  // Pre-seed `taken` with existing ids so generated slugs don't collide.
  for (const h of headings) {
    if (h && h.id) taken.add(h.id);
  }
  const out = [];
  for (const h of headings) {
    if (!h || !h.tagName) continue;
    const tag = String(h.tagName).toUpperCase();
    if (tag !== "H2" && tag !== "H3") continue;
    const level = Number(tag.slice(1));
    const text = normalizeHeadingText(h.textContent);
    let id = h.id;
    if (!id) {
      id = slugifyHeadingId(text, taken);
      if (typeof assignId === "function") {
        assignId(h, id);
      }
    }
    out.push({ level, id, text });
  }
  return out;
}
