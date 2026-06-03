// scripts/sync-mirrors.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const TOP = path.join(repoRoot, "package/minimap");
const TARGETS = [
  path.join(TOP, "skills/minimap-roadmap/runtime"),
  path.join(TOP, "skills/minimap-spec-review/runtime"),
];

const FILES = ["cli.js", "server.js", "package.json"];
const DIRS = ["src", "ui"];

async function copyFile(src, dst) {
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.copyFile(src, dst);
}

async function copyDir(srcDir, dstDir) {
  await fs.rm(dstDir, { recursive: true, force: true });
  await fs.mkdir(dstDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      await copyDir(src, dst);
    } else if (entry.isFile()) {
      await copyFile(src, dst);
    }
  }
}

async function syncTarget(targetRoot) {
  for (const file of FILES) {
    await copyFile(path.join(TOP, file), path.join(targetRoot, file));
  }
  for (const dir of DIRS) {
    await copyDir(path.join(TOP, dir), path.join(targetRoot, dir));
  }
}

for (const target of TARGETS) {
  await syncTarget(target);
  process.stdout.write(`synced -> ${path.relative(repoRoot, target)}\n`);
}
