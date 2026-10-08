import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../package/minimap/ui/api.js";

test("suggestion preview does not invalidate roadmap snapshots but applying does", async () => {
  for (const scoped of [false, true]) {
    const mutations = [];
    const api = createApi({
      getSource: () => scoped ? { mode: "across", identity: { repoRoot: "C:/checkouts/blue", sourceKey: "blue", git: {} } } : null,
      onMutation: (url) => mutations.push(url),
      fetch: async () => ({ ok: true, json: async () => ({}) }),
    });
    await api.previewSuggestion("feature.md", "suggestion");
    assert.deepEqual(mutations, []);
    await api.applySuggestion("feature.md", "suggestion");
    assert.equal(mutations.length, 1);
    assert.match(mutations[0], /\/suggestions\/suggestion\/apply$/);
  }
});

function fixture() {
  const calls = [];
  const api = createApi({
    getRepo: () => "C:/projects/example",
    getSource: () => ({ mode: "across", identity: { repoRoot: "C:/checkouts/blue", sourceKey: "blue", git: {} } }),
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({}) };
    },
  });
  return { api, calls };
}

test("snapshot opt-ins are explicit and preserve abort ownership", async () => {
  const { api, calls } = fixture();
  const controller = new AbortController();
  await api.loadWorktreeWorkspace({ cached: true, participants: false, signal: controller.signal });
  const query = new URL(calls[0].url, "http://localhost");
  assert.equal(query.pathname, "/api/worktree-workspace");
  assert.equal(query.searchParams.get("cached"), "1");
  assert.equal(query.searchParams.get("participants"), "0");
  assert.equal(calls[0].options.signal, controller.signal);
  assert.equal(calls[0].options.headers.get("X-Minimap-Repo"), "C:/projects/example");
  await api.loadWorktreeWorkspace();
  assert.equal(calls[1].url, "/api/worktree-workspace");
});

test("observations bind the opened repo even while a sibling version is selected", async () => {
  const { api, calls } = fixture();
  const controller = new AbortController();
  await api.readBoardObservations({ snapshot: "snapshot / one", includeCompleted: true, signal: controller.signal });
  const query = new URL(calls[0].url, "http://localhost");
  assert.equal(query.pathname, "/api/board/observations");
  assert.equal(query.searchParams.get("snapshot"), "snapshot / one");
  assert.equal(query.searchParams.get("includeCompleted"), "1");
  assert.equal(calls[0].options.headers.get("X-Minimap-Repo"), "C:/projects/example");
  assert.equal(calls[0].options.headers.has("X-Minimap-Source-Context"), false);
  assert.equal(calls[0].options.signal, controller.signal);
});

test("This checkout cached reads retain selected-source guards and cancellation", async () => {
  const { api, calls } = fixture();
  const controller = new AbortController();
  await api.loadWorkspace({ cached: true, signal: controller.signal });
  assert.equal(calls[0].url, "/api/source/workspace?cached=1");
  assert.equal(calls[0].options.headers.get("X-Minimap-Repo"), "C:/checkouts/blue");
  assert.equal(calls[0].options.signal, controller.signal);
});
