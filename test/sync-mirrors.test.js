// test/sync-mirrors.test.js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const top = path.join(repoRoot, "package/minimap");
const roadmapRuntime = path.join(top, "skills/minimap-roadmap/runtime");
const specRuntime = path.join(top, "skills/minimap-spec-review/runtime");

const RUNTIME_FILES = ["cli.js", "server.js", "package.json"];
const RUNTIME_DIRS = ["src", "ui", "templates"];

async function readBytes(p) {
  return fs.readFile(p);
}

async function listAllFiles(dir, out = [], base = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await listAllFiles(full, out, base);
    } else if (entry.isFile()) {
      out.push(path.relative(base, full).replaceAll("\\", "/"));
    }
  }
  return out;
}

test("sync-mirrors.mjs makes the runtime trees byte-identical to the top-level runtime files", async (t) => {
  for (const target of [roadmapRuntime, specRuntime]) {
    for (const file of RUNTIME_FILES) {
      const a = await readBytes(path.join(top, file));
      const b = await readBytes(path.join(target, file));
      assert.deepEqual(a, b, `${file} differs in ${target}`);
    }
    for (const dir of RUNTIME_DIRS) {
      const filesA = (await listAllFiles(path.join(top, dir))).sort();
      const filesB = (await listAllFiles(path.join(target, dir))).sort();
      assert.deepEqual(filesA, filesB, `${dir}/ tree differs in ${target}`);
      for (const f of filesA) {
        const a = await readBytes(path.join(top, dir, f));
        const b = await readBytes(path.join(target, dir, f));
        assert.deepEqual(a, b, `${dir}/${f} differs in ${target}`);
      }
    }
  }

  // Lifecycle tests import the checked-in mirrors concurrently; sync only a fixture.
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-mirror-test-"));
  t.after(() => fs.rm(fixture, { recursive: true, force: true }));
  const fixtureTop = path.join(fixture, "package/minimap");
  await fs.mkdir(path.join(fixture, "scripts"), { recursive: true });
  await fs.mkdir(fixtureTop, { recursive: true });
  await fs.copyFile(path.join(repoRoot, "scripts/sync-mirrors.mjs"), path.join(fixture, "scripts/sync-mirrors.mjs"));
  for (const entry of [...RUNTIME_FILES, ...RUNTIME_DIRS]) {
    await fs.cp(path.join(top, entry), path.join(fixtureTop, entry), { recursive: true });
  }
  const result = spawnSync(process.execPath, [path.join(fixture, "scripts/sync-mirrors.mjs")], {
    cwd: fixture,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `sync-mirrors exited ${result.status}: ${result.stderr}`);
  for (const skill of ["minimap-roadmap", "minimap-spec-review"]) {
    const target = path.join(fixtureTop, "skills", skill, "runtime");
    const expected = (await listAllFiles(top)).filter((file) => RUNTIME_FILES.includes(file) || RUNTIME_DIRS.some((dir) => file.startsWith(`${dir}/`))).sort();
    assert.deepEqual((await listAllFiles(target)).sort(), expected);
    for (const file of expected) assert.deepEqual(await readBytes(path.join(target, file)), await readBytes(path.join(top, file)), `${skill}: ${file}`);
  }
});
