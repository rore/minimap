import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";
import { loadWorkspace, parseItemText } from "./roadmap.js";
import { discoverWorktreeSources } from "./worktree-sources.js";
import { requireRoadmapInSource } from "./source-bound.js";

const execFileAsync = promisify(execFile);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const relative = (root, file) => path.relative(root, path.isAbsolute(file) ? file : path.resolve(root, file)).replaceAll("\\", "/");

async function git(root, ...args) {
  return (await execFileAsync("git", args, {
    cwd: root, windowsHide: true, shell: false, timeout: 5000,
    maxBuffer: 4 * 1024 * 1024, encoding: "utf8",
  })).stdout.trim();
}

async function ancestorBlobs(root, objects) {
  if (objects.length > 500) throw new Error("ancestor item limit");
  const output = await new Promise((resolve, reject) => {
    const child = spawn("git", ["cat-file", "--batch"], { cwd: root, windowsHide: true, shell: false });
    const chunks = [];
    let size = 0;
    const timer = setTimeout(() => child.kill(), 5000);
    child.on("error", reject);
    child.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size > 8 * 1024 * 1024) { child.kill(); return; }
      chunks.push(chunk);
    });
    child.stderr.resume();
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 || size > 8 * 1024 * 1024) reject(new Error("ancestor batch unavailable"));
      else resolve(Buffer.concat(chunks));
    });
    child.stdin.end(objects.map((entry) => entry.oid).join("\n") + "\n");
  });
  const ids = new Map();
  let offset = 0;
  for (const entry of objects) {
    const end = output.indexOf(10, offset);
    if (end < 0) throw new Error("invalid ancestor batch");
    const header = output.subarray(offset, end).toString("utf8").match(/^([0-9a-f]{40,64}) blob (\d+)$/i);
    if (!header || header[1] !== entry.oid) throw new Error("invalid ancestor blob");
    const length = Number(header[2]);
    if (!Number.isSafeInteger(length) || end + 1 + length >= output.length) throw new Error("invalid ancestor size");
    try { ids.set(entry.file, String(parseItemText(output.subarray(end + 1, end + 1 + length).toString("utf8"), entry.file).frontmatter.id)); }
    catch { /* Invalid ancestor item cannot establish identity. */ }
    offset = end + 2 + length;
  }
  if (offset !== output.length) throw new Error("invalid ancestor tail");
  return ids;
}

// A matching id/path is only one feature when the file survived from common history.
// Missing, shallow, or oversized Git evidence fails closed: the versions stay separate.
async function sharedPaths(left, right, roadmapPath) {
  try {
    const base = await git(left.repoRoot, "merge-base", left.git.headCommit, right.git.headCommit);
    if (!/^[0-9a-f]{40,64}$/i.test(base)) return new Map();
    const dirs = [path.posix.join(roadmapPath, "features"), path.posix.join(roadmapPath, "ideas")];
    const objects = (await git(left.repoRoot, "ls-tree", "-r", "-z", "--long", base, "--", ...dirs))
      .split("\0").filter(Boolean).map((record) => {
        const match = record.match(/^[0-7]{6} blob ([0-9a-f]{40,64}) +\d+\t([\s\S]*)$/i);
        if (!match) throw new Error("ambiguous ancestor tree");
        return { oid: match[1], file: match[2] };
      }).filter((entry) => !/[\r\n]/.test(entry.file) && entry.file.endsWith(".md"));
    if (!objects.length) return new Map();
    const ids = await ancestorBlobs(left.repoRoot, objects);
    const deleted = new Set();
    for (const source of [left, right]) {
      const output = await git(source.repoRoot, "log", "-z", "--format=", "--name-only", "--diff-filter=D", "--no-renames", `${base}..${source.git.headCommit}`, "--", ...dirs);
      for (const file of output.split("\0")) if (file) deleted.add(file);
    }
    return new Map(objects.filter((entry) => !deleted.has(entry.file) && ids.has(entry.file)).map((entry) => [entry.file, ids.get(entry.file)]));
  } catch { return new Map(); }
}

function conflicts(versions) {
  const fields = ["title", "status", "priority", "commitment", "milestone", "kind", "revision"];
  return fields.flatMap((field) => {
    const values = versions.map((version) => ({ field, sourceKey: version.sourceKey, value: version.summary[field] ?? "" }));
    return new Set(values.map((entry) => JSON.stringify(entry.value))).size > 1 ? values : [];
  });
}

/** Read-only, opened-first projection of compatible linked worktrees. */
export async function loadWorktreeAggregate(openRepoRoot) {
  const discovery = await discoverWorktreeSources(openRepoRoot);
  const result = { ...discovery, workspace: null, features: [], groups: [],
    coverage: { loaded: 0, excluded: 0, missingBoardRefs: [] } };
  if (!discovery.sources.length) return result;
  if (discovery.unavailable) result.partial = true;

  const loaded = [];
  for (const source of discovery.sources) {
    try {
      await requireRoadmapInSource(source.repoRoot);
      const workspace = await loadWorkspace(source.repoRoot);
      source.roadmapBinding = { roadmapPath: workspace.roadmapPath, resolvedPath: workspace.resolvedPath };
      source.availableLenses = workspace.availableLenses;
      source.availableFilters = workspace.availableFilters;
      if (source === discovery.sources[0]) result.workspace = workspace;
      else if (path.normalize(workspace.roadmapPath) !== path.normalize(result.workspace.roadmapPath)) {
        result.excluded.push({ repoRoot: source.repoRoot, sourceKey: source.sourceKey, reason: "incompatible-roadmap-config" });
        continue;
      }
      loaded.push({ ...source, workspace });
    } catch (error) {
      result.excluded.push({ repoRoot: source.repoRoot, sourceKey: source.sourceKey,
        reason: "workspace-load-failed", code: error.code || null, message: error.message });
      if (source === discovery.sources[0]) {
        result.unavailable = { reason: "opened-workspace-load-failed", code: error.code || null, message: error.message };
        result.partial = true;
        result.coverage.excluded = result.excluded.length;
        return result;
      }
    }
  }
  result.coverage.loaded = loaded.length;
  result.coverage.excluded = result.excluded.length;
  if (!loaded.length) { result.unavailable = { reason: "no-loadable-workspace" }; return result; }
  if (result.excluded.length) result.partial = true;

  for (const source of loaded.slice(1)) {
    for (const field of ["availableLenses", "availableFilters"]) {
      for (const entry of source.workspace[field]) {
        const existing = result.workspace[field].find((candidate) => candidate.key === entry.key);
        if (!existing) result.workspace[field].push({ ...entry });
        else for (const value of entry.values || []) {
          if (!existing.values.includes(value)) existing.values.push(value);
        }
      }
    }
  }

  const lineage = new Map();
  for (let i = 0; i < loaded.length; i += 1) {
    for (let j = i + 1; j < loaded.length; j += 1) {
      lineage.set(`${i}:${j}`, await sharedPaths(loaded[i], loaded[j], relative(loaded[i].repoRoot, loaded[i].workspace.resolvedPath)));
    }
  }
  const features = [];
  const groupMap = new Map();
  const appearanceOrder = [];
  for (const [sourceIndex, source] of loaded.entries()) {
    const memberships = new Map();
    for (const group of source.workspace.boardGroups) {
      const groupKey = `board:${group.name}`;
      if (!groupMap.has(groupKey)) groupMap.set(groupKey, { name: group.name, kind: "board", items: [] });
      for (const item of group.items) {
        if (item.missing) {
          const key = hash(`${source.sourceKey}\0missing\0${group.name}\0${item.id}`);
          const version = { sourceKey: source.sourceKey, repoRoot: source.repoRoot, itemId: item.id,
            summary: item, group: group.name, groupKind: "board", sourceContext: source };
          appearanceOrder.push({ groupKey, missing: { key, id: item.id, missing: true, versions: [version], conflicts: [] } });
          result.coverage.missingBoardRefs.push({ sourceKey: source.sourceKey, group: group.name, itemId: item.id });
        } else {
          const names = memberships.get(item.id) || [];
          names.push(group.name);
          memberships.set(item.id, names);
          appearanceOrder.push({ groupKey, sourceIndex, id: item.id });
        }
      }
    }
    for (const [id, summary] of Object.entries(source.workspace.items)) {
      const filePath = relative(source.repoRoot, summary.filePath);
      const match = features.find((feature) => feature.id === id && feature.filePath === filePath
        && feature.sourceIndexes.every((other) => lineage.get(`${Math.min(other, sourceIndex)}:${Math.max(other, sourceIndex)}`)?.get(filePath) === id));
      const feature = match || { key: hash(`${source.sourceKey}\0${id}\0${filePath}`), id, filePath,
        versions: [], groups: [], conflicts: [], sourceIndexes: [] };
      if (!match) features.push(feature);
      feature.sourceIndexes.push(sourceIndex);
      for (const groupName of memberships.get(id) || ["Not on a board"]) {
        const groupKind = memberships.has(id) ? "board" : "unlisted";
        const groupKey = groupKind === "board" ? `board:${groupName}` : "unlisted";
        if (!groupMap.has(groupKey)) groupMap.set(groupKey, { name: groupName, kind: groupKind, items: [] });
        const version = { sourceKey: source.sourceKey, repoRoot: source.repoRoot, itemId: id,
          summary, group: groupName, groupKind, sourceContext: source };
        feature.versions.push(version);
        if (!feature.groups.some((entry) => entry.name === groupName && entry.kind === groupKind)) feature.groups.push({ name: groupName, kind: groupKind });
        if (!memberships.has(id)) appearanceOrder.push({ groupKey, sourceIndex, id });
      }
    }
  }
  for (const feature of features) {
    feature.conflicts = conflicts(feature.versions);
    delete feature.sourceIndexes;
  }
  for (const appearance of appearanceOrder) {
    const group = groupMap.get(appearance.groupKey);
    if (appearance.missing) { group.items.push(appearance.missing); continue; }
    const feature = features.find((entry) => entry.id === appearance.id
      && entry.versions.some((version) => version.sourceKey === loaded[appearance.sourceIndex].sourceKey));
    if (group.items.some((item) => item.key === feature.key)) continue;
    const versions = feature.versions.filter((version) => `${version.groupKind === "board" ? "board:" + version.group : "unlisted"}` === appearance.groupKey);
    group.items.push({ key: feature.key, id: feature.id, versions, conflicts: conflicts(versions) });
  }
  result.features = features;
  result.groups = [...groupMap.values()];
  return result;
}
