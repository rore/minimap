export function relatedWorkSources(feature) {
  return [...new Map((feature?.versions || []).map((version) => [version.sourceKey, version])).values()];
}

export function acrossRelatedWorkKey(repo, feature, provisional = false) {
  return JSON.stringify([repo, "across-related", feature?.key, provisional,
    relatedWorkSources(feature).map((version) => [version.sourceContext, version.itemId, version.summary.revision])]);
}

function project(states, visibleLimit, provisional) {
  const byId = new Map();
  const coverage = {};
  for (const state of states) {
    for (const [key, value] of Object.entries(state.result?.coverage || {})) {
      if (typeof value === "number") coverage[key] = (coverage[key] || 0) + value;
    }
    for (const record of state.result?.records || []) {
      if (!byId.has(record.id)) byId.set(record.id, { ...record, versions: [] });
      byId.get(record.id).versions.push({ ...record, sourceContext: state.version.sourceContext,
        itemId: state.version.itemId, generation: state.result.generation });
    }
  }
  const all = [...byId.values()];
  const incomplete = provisional || !states.length || states.some((state) => state.error || state.result?.status !== "ok" || state.result.nextOffset != null);
  const failed = states.some((state) => state.error || ["unavailable", "stale"].includes(state.result?.status));
  return { across: true, states, provisional, visibleLimit, records: all.slice(0, visibleLimit), total: all.length, incomplete,
    status: failed && all.length ? "stale" : states.some((state) => state.error || state.result?.status !== "ok") || provisional || !states.length ? "partial" : "ok",
    coverage, nextOffset: all.length > visibleLimit || states.some((state) => state.result?.nextOffset != null) ? visibleLimit : null,
    notices: states.filter((state) => state.notice).map((state) => `${state.version.sourceContext.repoRoot}: ${state.notice}`),
    reason: states.some((state) => state.result?.reason === "validation_due") ? "validation_due" : null,
    generation: JSON.stringify(states.map((state) => [state.version.sourceKey, state.result?.generation])) };
}

export function createAcrossRelatedWork(feature, provisional = false) {
  return project(relatedWorkSources(feature).map((version) => ({ version })), 20, provisional);
}

export function cacheAcrossRelatedWork(view) {
  return project(view.states.map((state) => ({ ...state, result: state.firstPage || state.result })), 20, view.provisional);
}

export async function readAcrossRelatedWork(previous, { read, signal, fresh = false, append = false } = {}) {
  const states = previous.states.map((state) => ({ ...state }));
  const visibleLimit = append ? previous.visibleLimit + 20 : previous.visibleLimit;
  // Show already-loaded rows before asking any source for another page.
  if (append && previous.total > previous.visibleLimit) return project(states, visibleLimit, previous.provisional);
  let next = 0;
  const worker = async () => {
    while (next < states.length) {
      signal?.throwIfAborted();
      const state = states[next++];
      if (append && state.result?.nextOffset == null) continue;
      if (fresh) state.notice = null;
      const old = state.result;
      const load = async (options) => {
        const result = await read(state.version.itemId, { ...options, signal, sourceContext: state.version.sourceContext });
        signal?.throwIfAborted();
        const source = state.version.sourceContext;
        if (result.source?.repoRoot !== source.repoRoot || result.source?.sourceKey !== source.sourceKey
          || result.source?.headCommit !== source.git.headCommit) throw new Error("Task source changed. Refresh linked tasks.");
        return result;
      };
      try {
        let result;
        try {
          result = await load(append ? { generation: old.generation, offset: old.nextOffset } : { fresh });
          if (append && result.generation !== old.generation) throw Object.assign(new Error("Task generation changed."), { code: "related_work_changed" });
        } catch (error) {
          if (!append || error.code !== "related_work_changed") throw error;
          // The immutable cursor expired; keep peers, never mix this source's generations.
          state.result = undefined;
          state.firstPage = undefined;
          state.notice = "Task records changed. Reloaded the first page; earlier pages from this worktree were removed.";
          result = await load({ fresh: true });
        }
        const sameGeneration = state.result?.generation && result.generation === state.result.generation;
        if (!append || !sameGeneration) state.firstPage = result;
        state.result = sameGeneration && append ? { ...result, records: [...state.result.records, ...result.records] }
          : sameGeneration && state.result.records.length > result.records.length
            ? { ...result, records: state.result.records, nextOffset: state.result.nextOffset } : result;
        state.error = null;
      } catch (error) {
        if (signal?.aborted) throw error;
        state.error = error.message;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, states.length) }, worker));
  signal?.throwIfAborted();
  return project(states, visibleLimit, previous.provisional);
}
