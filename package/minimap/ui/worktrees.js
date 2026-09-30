import { getItemLensGroupValue, itemMatchesFilters } from "./filters.js";

const UNASSIGNED_KEY = "__unassigned__";
const UNASSIGNED_LABEL = "Unassigned";
const CONFLICT_FIELDS = ["title", "status", "priority", "commitment", "milestone", "kind", "revision"];

function conflictsForVersions(versions) {
  return CONFLICT_FIELDS.flatMap((field) => {
    const entries = versions.map((version) => ({ field, sourceKey: version.sourceKey, value: version.summary[field] ?? "" }));
    return new Set(entries.map((entry) => JSON.stringify(entry.value))).size > 1 ? entries : [];
  });
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
    if (!groups.has(key)) groups.set(key, { name, kind, groupKey: key, originalIndex, items: [] });
    return groups.get(key);
  };

  if (derived) preferred.forEach((name, index) => addGroup(name, name, "derived", index));
  else aggregate.groups.forEach((group, index) => addGroup(`${group.kind}:${group.name}`, group.name, group.kind, index));

  const duplicateIds = new Set(aggregate.features.filter((feature) => aggregate.features.some((other) => other !== feature && other.id === feature.id)).map((feature) => feature.id));
  for (const group of aggregate.groups || []) {
    for (const item of group.items || []) {
      const feature = aggregate.features.find((entry) => entry.key === item.key);
      if (!feature && item.missing) {
        if (!filtersActive && !derived) addGroup(`${group.kind}:${group.name}`, group.name, group.kind, 0).items.push({ ...item, title: item.id, sourceVersion: item.versions?.[0] });
        continue;
      }
      if (!feature) continue;
      const versions = item.versions.filter((version) => itemMatchesFilters({
        ...version.summary, id: version.itemId, searchText: version.summary.searchText,
      }, {
        searchQuery, activeFilters,
        inPlay,
        participantCounts: new Map([[version.itemId, { participantCount: duplicateIds.has(feature.id) ? 0 : participantCounts.get(feature.key)?.participantCount || 0 }]]),
      }));
      if (!versions.length) continue;
      const byGroup = new Map();
      for (const version of versions) {
        const name = derived && version.groupKind !== "unlisted"
          ? (getItemLensGroupValue(version.summary, lens, { defaultLensKey: "board", unassignedKey: UNASSIGNED_KEY }) || UNASSIGNED_KEY)
          : version.group;
        const kind = derived && version.groupKind !== "unlisted" ? "derived" : version.groupKind;
        const key = derived && kind === "derived" ? name : `${kind}:${name}`;
        if (!byGroup.has(key)) byGroup.set(key, { name: name === UNASSIGNED_KEY ? UNASSIGNED_LABEL : name, kind, versions: [] });
        byGroup.get(key).versions.push(version);
      }
      for (const [key, entry] of byGroup) {
        const index = derived ? preferred.indexOf(entry.name) : aggregate.groups.findIndex((value) => value.kind === entry.kind && value.name === entry.name);
        const projected = addGroup(key, entry.name, entry.kind, index < 0 ? preferred.length + groups.size : index);
        const appearanceId = JSON.stringify([feature.key, entry.kind, entry.name]);
        const existing = derived && projected.items.find((card) => card.featureKey === feature.key);
        if (existing) {
          const sources = new Set(existing.matchingVersions.map((version) => `${version.sourceKey}\0${version.groupKind}\0${version.group}`));
          existing.matchingVersions.push(...entry.versions.filter((version) => !sources.has(`${version.sourceKey}\0${version.groupKind}\0${version.group}`)));
          const sourceOrder = new Map(feature.versions.map((version, order) => [`${version.sourceKey}\0${version.groupKind}\0${version.group}`, order]));
          existing.matchingVersions.sort((left, right) => sourceOrder.get(`${left.sourceKey}\0${left.groupKind}\0${left.group}`) - sourceOrder.get(`${right.sourceKey}\0${right.groupKind}\0${right.group}`));
          existing.versions = existing.matchingVersions;
          existing.sourceVersion = existing.matchingVersions[0];
          existing.conflicts = conflictsForVersions(existing.matchingVersions);
          continue;
        }
        projected.items.push({ ...entry.versions[0].summary, id: appearanceId, featureKey: feature.key,
          title: entry.versions[0].summary.title || feature.id, versions: entry.versions, matchingVersions: entry.versions,
          conflicts: conflictsForVersions(entry.versions), sourceVersion: entry.versions[0] });
      }
    }
  }
  return [...groups.values()].filter((group) => group.items.length || (showEmptyGroups && !inPlay && derived))
    .sort((a, b) => a.originalIndex - b.originalIndex || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

export function countDistinctWorktreeFeatures(groups) {
  return new Set(groups.flatMap((group) => group.items.filter((item) => !item.missing).map((item) => item.featureKey || item.id))).size;
}
