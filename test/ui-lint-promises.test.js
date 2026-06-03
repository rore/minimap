// test/ui-lint-promises.test.js
//
// Lint test: every `void api.*(...)` call in the UI layer must be followed
// by `.catch(...)`. The api.js wrapper rejects on non-2xx and on network
// failure — a bare `void api.foo()` swallows those rejections silently and
// leaves the user staring at a stale UI with no error banner.
//
// Wrapper functions (persist*, load*, save*, switch*, etc.) typically do
// `try { await api.foo() } catch (e) { setBanner(e.message, "error") }`
// internally, so `void persistBoardOrder()` is safe. This lint focuses on
// the bare api.* call sites that bypass that wrapping.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const UI_FILES = [
  "package/minimap/ui/app.js",
];

test("no `void api.foo(...)` calls without a .catch handler", async () => {
  const offenders = [];
  for (const relPath of UI_FILES) {
    const text = await fs.readFile(relPath, "utf8");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      // Match `void api.something(...)` on this line; check the same line
      // and the next 5 lines for `.catch(`.
      if (!/\bvoid\s+api\./.test(line)) continue;
      const window = lines.slice(i, Math.min(i + 6, lines.length)).join("\n");
      if (!/\.catch\(/.test(window)) {
        offenders.push(`${relPath}:${i + 1}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `Found unhandled void api.* calls (each must be followed by .catch):\n${offenders.join("\n")}`,
  );
});
