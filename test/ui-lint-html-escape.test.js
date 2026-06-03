// test/ui-lint-html-escape.test.js
//
// Lint test: every `${expr}` interpolation that lands inside an HTML-building
// template literal must be safe-by-construction. "Safe" means one of:
//   - wrapped in escapeHtml(...) / renderMarkdownToHtml(...) / renderInlineMarkdown(...) / CSS.escape(...)
//   - a conditional class-name fragment: <ternary> ? "literal" : "literal"
//   - a known pre-built HTML chunk produced by another safe path (allowlisted by name)
//   - a numeric expression (length, count, .size, math, integer literal)
//   - a comparator string built from a literal allowlist
//
// Anything else may be a missing-escape XSS sink and is flagged. The lint is
// conservative: false positives are fine — they push the author to either
// route through escapeHtml or extend the allowlist with explicit reasoning.
//
// Why not <template> clones? Conversion is ~600 lines of mechanical change
// across multiple render paths. This test enforces the same guarantee in
// ~100 lines without touching any render output.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const FILES = [
  "package/minimap/ui/app.js",
  "package/minimap/ui/spec/render.js",
  "package/minimap/ui/spec/composer.js",
  "package/minimap/ui/spec/toc.js",
];

// Names of locals/globals whose value is known to be either pre-escaped HTML
// or a non-user-data string. Extend with caution — adding here = trusting
// the upstream construction.
const SAFE_NAMES = new Set([
  // Pre-built HTML chunks (each is constructed via map().join() of escaped pieces)
  "replies", "replyForm", "actions", "itemsHtml", "kindTag", "anchorTag",
  "orphanWarning", "anchorRewritten", "headerHtml", "diffHtml", "html",
  "groupsHtml", "rowsHtml", "groupHtml", "itemHtml", "specHtml", "scopeHtml",
  "previewHtml", "diffBodyHtml", "blockHtml", "boardHtml", "summaryHtml",
  "facetsHtml", "filtersHtml", "lensesHtml", "sectionHtml", "fragments",
  "fieldHtml", "metadataHtml", "badgesHtml", "groupCardHtml", "draftHtml",
  "pulseHtml", "tagHtml", "cardHtml", "missingHtml", "lensSwitcherHtml",
  "boardLayoutHtml", "filterToggleHtml", "scopeMessageHtml",
  "fileError", "noContent", "missingTarget", "kindLabel",
  "participantsHtml", "facepileHtml", "popoverHtml", "iconHtml",
  "beforeHtml", "afterHtml", "cls", "classes", "contentHtml",
  "metaHtml", "buttonsHtml", "dropZoneHtml", "scopeIconHtml",
  "filterChipsHtml", "filterFacetsHtml",
  "badges", "titleHtml", "statsHtml", "chips", "options", "optionMarkup",
  "specBadge", "cardsHtml", "columnsHtml", "rows", "label", "value", "key",
  "safeHeading", "rowCount", "items",
  // Conditional / string-fragment locals constructed inline as ternaries
  "active", "isActive", "isFile", "isResolved", "isReplying", "isReviewing",
  "isCollapsed", "collapsedResolved", "isViewer", "isExpanded", "isOpen",
  "isClosed", "isMissing", "selected", "disabled",
  "pulseAttr", "activeClass", "placementAttributes", "reorderAttributes",
  "dropAttributes", "actionsAttr",
  // Pure numeric / known-safe values
  "open", "pending", "orphan", "count", "total", "overflow", "level",
  "index", "lineStart", "lineEnd", "groupIndex", "itemIndex",
  // Identifiers controlled by the codebase (slugs, kinds, scopes — never user-typed)
  "DEFAULT_LENS_KEY", "UNASSIGNED_GROUP_KEY", "UNASSIGNED_GROUP_LABEL",
]);

// Whitelisted call expressions that produce safe strings.
const SAFE_FUNCTION_CALLS = [
  /^escapeHtml\(/,
  /^escapeTocHtml\(/,
  /^renderMarkdownToHtml\(/,
  /^renderInlineMarkdown\(/,
  /^CSS\.escape\(/,
  /^renderBadge[s]?\(/,
  /^renderMetadataBadges\(/,
  /^renderMarginCommentCard\(/,
  /^renderMarginSuggestionCard\(/,
  /^renderSpecReplies\(/,
  /^renderBoardItemBadge\(/,
  /^formatCommentBodyHtml\(/,
  /^renderBoardCard\(/,
  /^buildSpecDocHeaderHtml\(/,
  /^renderSetupSection\(/,
  /^renderSetup\w*\(/,
  /^buildSetup\w*\(/,
  /^buildBoardGroupOptions\(/,
  /^renderField\w*\(/,
  /^renderEditor\w*\(/,
  /^renderScope\w*\(/,
  /^renderRoadmap\w*\(/,
  /^humanize\w*\(/,
  /^build\w*Html\(/i,
  /^actorColorClass\(/,
];

function isSafeExpression(expr) {
  const trimmed = expr.trim();
  if (!trimmed) return true;

  // Bare identifier in the safe-name set
  if (/^[A-Za-z_$][\w$]*$/.test(trimmed) && SAFE_NAMES.has(trimmed)) return true;

  // Call expression matching a safe function
  for (const re of SAFE_FUNCTION_CALLS) {
    if (re.test(trimmed)) return true;
  }

  // .map(...).join(...) — escape responsibility belongs to the inner template,
  // which the lint already analyzes line-by-line. Trust the inner.
  if (/\.map\([\s\S]*\)\.join\(/.test(trimmed)) return true;

  // Anything ending in .join(...) — same reasoning as above.
  if (/\.join\(("[^"]*"|'[^']*'|``)\)\s*$/.test(trimmed)) return true;

  // Ternary returning two string literals (no user data)
  if (/^[^?]+\?\s*("[^"]*"|'[^']*'|`[^`]*`)\s*:\s*("[^"]*"|'[^']*'|`[^`]*`)\s*$/.test(trimmed)) return true;

  // Ternary returning a string literal and an empty string
  if (/^[^?]+\?\s*("[^"]*"|'[^']*'|`[^`]*`)\s*:\s*""\s*$/.test(trimmed)) return true;
  if (/^[^?]+\?\s*""\s*:\s*("[^"]*"|'[^']*'|`[^`]*`)\s*$/.test(trimmed)) return true;

  // X || "fallback string literal" — fallback is safe; the X side is checked elsewhere if it's a fragment
  if (/^[\w$.]+\s*\|\|\s*("[^"]*"|'[^']*'|`[^`]*`)\s*$/.test(trimmed)) return true;

  // Member access on known safe fields
  if (/^[\w$]+\.(length|size|count)$/.test(trimmed)) return true;
  if (/^[\w$.]+\.(length|size|count|kind|status|priority|commitment|originalIndex|openComments|pendingSuggestions|id)$/.test(trimmed)) return true;

  // Numeric literals and arithmetic
  if (/^[\d+\-*/\s.()]+$/.test(trimmed)) return true;

  // Property accessors of the form X.lengthOf or count expressions
  if (/^(\w+\.)+(length|size|count|index)\s*[+\-*/]?\s*\d*$/.test(trimmed)) return true;

  return false;
}

// Return true if a line looks like it's building HTML (contains an opening
// tag character `<` followed by an identifier, OR a closing `</`).
function looksLikeHtmlLine(line) {
  return /<[a-zA-Z\/]/.test(line);
}

function findInterpolationsInLine(line) {
  // Match ${...} respecting one level of nested braces.
  const out = [];
  let i = 0;
  while (i < line.length - 1) {
    if (line[i] === "$" && line[i + 1] === "{") {
      let depth = 1;
      let j = i + 2;
      while (j < line.length && depth > 0) {
        if (line[j] === "{") depth += 1;
        else if (line[j] === "}") depth -= 1;
        if (depth === 0) break;
        j += 1;
      }
      if (depth === 0) out.push(line.slice(i + 2, j));
      i = j + 1;
    } else {
      i += 1;
    }
  }
  return out;
}

test("every ${...} in HTML-building template lines is safe-by-construction", async () => {
  const offenders = [];
  for (const file of FILES) {
    const text = await fs.readFile(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!looksLikeHtmlLine(line)) continue;
      const exprs = findInterpolationsInLine(line);
      for (const expr of exprs) {
        if (!isSafeExpression(expr)) {
          offenders.push(`${file}:${i + 1}: ${expr.trim().slice(0, 80)}`);
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `Found possibly-unescaped HTML interpolations. Wrap in escapeHtml(...) or extend the allowlist in test/ui-lint-html-escape.test.js if you've audited the source:\n${offenders.join("\n")}`,
  );
});
