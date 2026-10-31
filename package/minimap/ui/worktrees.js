import { getItemLensGroupValue, itemMatchesFilters } from "./filters.js";

const UNASSIGNED_KEY = "__unassigned__";
const UNASSIGNED_LABEL = "Unassigned";
const CONFLICT_FIELDS = ["title", "status", "priority", "commitment", "milestone", "kind", "revision"];

export function currentStatusVersions(versions) {
  return versions.filter((version) => !version.statusSupersededBy?.length);
}

// Summarize saved file states matching the filters, never session activity.
export function recordedStatusSummary(item) {
  const versions = item?.statusVersions ?? item?.matchingVersions;
  const values = versions
    ? versions.map((version) => version.summary?.status ?? version.summary?.metadata?.status)
    : [item?.metadata?.status ?? item?.status];
  const statuses = [...new Set(values.map((value) => {
    const token = String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
    return ["active", "in-progress"].includes(token) ? "active" : token || "unknown";
  }))];
  const active = statuses.includes("active"), blocked = statuses.includes("blocked");
  const differs = statuses.length > 1;
  const label = active && blocked ? "Active · Blocked" : active ? "Active" : blocked ? "Blocked"
    : differs ? "Statuses differ" : !statuses.length || statuses[0] === "unknown" ? "Status unavailable"
      : statuses[0].charAt(0).toUpperCase() + statuses[0].slice(1).replaceAll("-", " ");
  return { label, differs, tone: blocked ? "blocked" : active ? "progress" : statuses.length === 1 && statuses[0] === "done" ? "done" : "" };
}

export function sortDerivedGroupsDoneLast(groups) {
  return groups.map((group) => group.isDerived || group.kind === "derived" ? {
    ...group,
    items: [...group.items].sort((left, right) =>
      Number(recordedStatusSummary(left).tone === "done") - Number(recordedStatusSummary(right).tone === "done")),
  } : group);
}

export function versionDifferences(version, selected) {
  if (!selected || version.sourceKey === selected.sourceKey) return [];
  const differences = CONFLICT_FIELDS.filter((field) => field !== "revision")
    .filter((field) => JSON.stringify(version.summary[field] ?? "") !== JSON.stringify(selected.summary[field] ?? ""))
    .map((field) => `${field[0].toUpperCase()}${field.slice(1)}: ${version.summary[field] || "not set"} (selected: ${selected.summary[field] || "not set"})`);
  if ((version.displayRevision ?? version.summary.revision) !== (selected.displayRevision ?? selected.summary.revision)) differences.push("Content differs");
  return differences;
}

function conflictsForVersions(versions) {
  return CONFLICT_FIELDS.flatMap((field) => {
    const entries = versions.map((version) => ({ field, sourceKey: version.sourceKey, value: version.summary[field] ?? "" }));
    const compared = field === "revision"
      ? versions.map((version) => version.displayRevision ?? version.summary.revision ?? "")
      : entries.map((entry) => entry.value);
    return new Set(compared.map((value) => JSON.stringify(value))).size > 1 ? entries : [];
  });
}

function canonicalId(id) {
  return encodeURIComponent(String(id).normalize("NFC")).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function worktreeCardId(feature) {
  return JSON.stringify([feature.key, feature.versions[0].groupKind, feature.versions[0].group]);
}

export function normalizeWorktreeCardId(aggregate, id) {
  let placement;
  try { placement = JSON.parse(id); } catch { return id; }
  if (!Array.isArray(placement) || placement.length !== 3) return id;
  const feature = aggregate?.features?.find((entry) => entry.key === placement[0]);
  if (!feature) return id;
  const known = feature.versions.some((version) =>
    (placement[1] === version.groupKind && placement[2] === version.group)
    || (placement[1] === "derived" && version.groupKind !== "unlisted"
      && aggregate.workspace?.availableLenses?.some((lens) => lens.key !== "board"
        && placement[2] === (getItemLensGroupValue(version.summary, lens.key, { defaultLensKey: "board", unassignedKey: UNASSIGNED_LABEL }) || UNASSIGNED_LABEL))));
  return known ? worktreeCardId(feature) : id;
}

export function projectWorktreeGroups(aggregate, {
  lens = "board", searchQuery = "", activeFilters = {}, inPlay = false,
  participantCounts = new Map(), showEmptyGroups = false,
} = {}) {
  if (!aggregate) return [];
  const filtersActive = Boolean(searchQuery || inPlay || Object.keys(activeFilters).length);
  const definitions = aggregate.workspace?.availableLenses || [];
  const definition = definitions.find((entry) => entry.key === lens);
  const derived = lens !== "board" && Boolean(definition);
  const preferred = derived ? definition.values || [] : [];
  const groups = new Map();
  const addGroup = (key, name, kind, originalIndex) => {
    if (!groups.has(key)) {
      groups.set(key, { name, kind, groupKey: key, originalIndex, items: [] });
    }
    return groups.get(key);
  };

  if (derived) preferred.forEach((name, index) => addGroup(name, name, "derived", index));
  else aggregate.groups.forEach((group, index) => addGroup(`${group.kind}:${group.name}`, group.name, group.kind, index));

  const idCounts = new Map();
  const featuresByKey = new Map(aggregate.features.map((feature) => [feature.key, feature]));
  for (const feature of aggregate.features) {
    const id = canonicalId(feature.id);
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }
  const statusEvidence = new Map();
  const matching = new Map(aggregate.features.map((feature) => {
    if (feature.versions.some((version) => version.statusSupersededBy?.length)) {
      const counts = new Map([[feature.id, { participantCount: idCounts.get(canonicalId(feature.id)) > 1 ? 0 : participantCounts.get(feature.key)?.participantCount || 0 }]]);
      const statuses = currentStatusVersions(feature.versions).filter((version) => itemMatchesFilters(version.summary, {
        activeFilters: activeFilters.status ? { status: activeFilters.status } : {},
      }));
      statusEvidence.set(feature.key, statuses);
      if (!statuses.length || inPlay && !statuses.some((version) => itemMatchesFilters({ ...version.summary, id: feature.id }, { inPlay: true, participantCounts: counts }))) return [feature.key, []];
      const { status, ...nonStatusFilters } = activeFilters;
      return [feature.key, feature.versions.filter((version) => itemMatchesFilters(version.summary, { searchQuery, activeFilters: nonStatusFilters }))];
    }
    return [feature.key, feature.versions.filter((version) => itemMatchesFilters({
      ...version.summary, id: version.itemId, searchText: version.summary.searchText,
    }, {
      searchQuery, activeFilters, inPlay,
      participantCounts: new Map([[version.itemId, { participantCount: idCounts.get(canonicalId(feature.id)) > 1 ? 0 : participantCounts.get(feature.key)?.participantCount || 0 }]]),
    }))];
  }));
  const emitted = new Set();
  for (const group of aggregate.groups || []) {
    for (const item of group.items || []) {
      const feature = featuresByKey.get(item.key);
      if (!feature && item.missing) {
        if (!filtersActive && !derived) addGroup(`${group.kind}:${group.name}`, group.name, group.kind, 0).items.push({ ...item, title: item.id, sourceVersion: item.versions?.[0] });
        continue;
      }
      if (!feature || emitted.has(feature.key)) continue;
      const versions = matching.get(feature.key);
      if (!versions.length) continue;
      const version = versions[0];
      if (!derived && (group.kind !== version.groupKind || group.name !== version.group)) continue;
      emitted.add(feature.key);
      const statusVersions = statusEvidence.get(feature.key);
      const name = derived && version.groupKind !== "unlisted"
        ? (getItemLensGroupValue(lens === "status" && statusVersions ? statusVersions[0].summary : version.summary, lens, { defaultLensKey: "board", unassignedKey: UNASSIGNED_KEY }) || UNASSIGNED_KEY)
        : version.group;
      const kind = derived && version.groupKind !== "unlisted" ? "derived" : version.groupKind;
      const key = derived && kind === "derived" ? name : `${kind}:${name}`;
      const index = derived ? preferred.indexOf(name) : aggregate.groups.findIndex((value) => value.kind === kind && value.name === name);
      const projected = addGroup(key, name === UNASSIGNED_KEY ? UNASSIGNED_LABEL : name, kind, index < 0 ? preferred.length + groups.size : index);
      const card = { ...version.summary, id: worktreeCardId(feature), featureKey: feature.key,
        title: version.summary.title || feature.id, versions, matchingVersions: versions,
        ...(statusVersions ? { statusVersions } : {}),
        conflicts: conflictsForVersions(versions), sourceVersion: version };
      projected.items.push(card);
    }
  }
  return sortDerivedGroupsDoneLast([...groups.values()].filter((group) => group.items.length || (showEmptyGroups && !inPlay && derived))
    .sort((a, b) => a.originalIndex - b.originalIndex || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })));
}

export function countDistinctWorktreeFeatures(groups) {
  return new Set(groups.flatMap((group) => group.items.filter((item) => !item.missing).map((item) => item.featureKey || item.id))).size;
}

/** Retain only the current view. Consumers must treat its groups/items as read-only. */
export function createWorktreeProjector() {
  let previous;
  return (aggregate, options = {}) => {
    const signature = JSON.stringify([options.lens, options.searchQuery, options.activeFilters, options.inPlay, options.showEmptyGroups]);
    if (previous?.aggregate === aggregate && previous.signature === signature && previous.counts === options.participantCounts) return previous.result;
    const groups = projectWorktreeGroups(aggregate, options);
    const items = new Map(groups.flatMap((group) => group.items.filter((item) => !item.missing).map((item) => [item.id, item])));
    const result = { groups, items, features: new Map((aggregate?.features || []).map((feature) => [feature.key, feature])) };
    previous = { aggregate, signature, counts: options.participantCounts, result };
    return result;
  };
}
