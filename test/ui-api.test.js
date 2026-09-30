import test from "node:test";
import assert from "node:assert/strict";
import { createApi, normalizeError } from "../package/minimap/ui/api.js";

function fakeFetch(responses) {
  const calls = [];
  let i = 0;
  const f = async (url, opts = {}) => {
    calls.push({ url, opts });
    const next = responses[i] || responses[responses.length - 1];
    i += 1;
    return {
      ok: next.ok ?? true,
      status: next.status ?? 200,
      json: async () => next.body ?? {},
    };
  };
  f.calls = calls;
  return f;
}

test("loadWorkspace calls /api/workspace and returns the parsed body", async () => {
  const f = fakeFetch([{ body: { items: {}, boardGroups: [] } }]);
  const api = createApi({ fetch: f });
  const result = await api.loadWorkspace();
  assert.equal(f.calls[0].url, "/api/workspace");
  assert.deepEqual(result, { items: {}, boardGroups: [] });
});

test("item participant reads use the exact roadmap endpoint and forward cancellation", async () => {
  const f = fakeFetch([{ body: { status: "disabled", participants: [] } }]);
  const api = createApi({ fetch: f, getRepo: () => "C:/repo" });
  const controller = new AbortController();
  await api.readItemParticipants("item / é", { signal: controller.signal });
  assert.equal(f.calls[0].url, "/api/items/item%20%2F%20%C3%A9/participants");
  assert.equal(f.calls[0].opts.signal, controller.signal);
  assert.equal(new Headers(f.calls[0].opts.headers).get("X-Minimap-Repo"), "C:/repo");
});

test("board participant counts include completed rows only when explicitly requested", async () => {
  const f = fakeFetch([{}]);
  const api = createApi({ fetch: f, getRepo: () => "C:/repo" });
  const controller = new AbortController();
  await api.readBoardParticipantCounts({ includeCompleted: true, signal: controller.signal, cache: "no-store" });
  await api.readBoardParticipantCounts({ includeCompleted: false });
  assert.equal(f.calls[0].url, "/api/board/participant-counts?includeCompleted=1");
  assert.equal(f.calls[1].url, "/api/board/participant-counts");
  assert.equal(f.calls[0].opts.signal, controller.signal);
  assert.equal(f.calls[0].opts.cache, "no-store");
  assert.equal(new Headers(f.calls[0].opts.headers).get("X-Minimap-Repo"), "C:/repo");
  assert.ok(f.calls.every(({ opts }) => !Object.hasOwn(opts, "includeCompleted")));
});

test("board participant counts use one repo-scoped request and forward cancellation", async () => {
  const f = fakeFetch([{ body: { status: "ok", counts: [] } }]);
  const api = createApi({ fetch: f, getRepo: () => "C:/repo" });
  const controller = new AbortController();
  await api.readBoardParticipantCounts({ signal: controller.signal });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, "/api/board/participant-counts");
  assert.equal(f.calls[0].opts.signal, controller.signal);
  assert.equal(new Headers(f.calls[0].opts.headers).get("X-Minimap-Repo"), "C:/repo");
});

test("non-2xx response throws a normalized error carrying code and statusCode", async () => {
  const f = fakeFetch([{ ok: false, status: 422, body: { error: { code: "anchor_orphaned", message: "no match" } } }]);
  const api = createApi({ fetch: f });
  await assert.rejects(
    () => api.loadWorkspace(),
    (err) => err.message === "no match" && err.code === "anchor_orphaned" && err.statusCode === 422,
  );
});

test("error fallback when payload has no error field", async () => {
  const f = fakeFetch([{ ok: false, status: 500, body: {} }]);
  const api = createApi({ fetch: f });
  await assert.rejects(
    () => api.loadWorkspace(),
    (err) => err.message === "Request failed." && err.code === "request_failed",
  );
});

test("X-Minimap-Repo header is set on roadmap endpoints when getRepo() returns a value", async () => {
  const f = fakeFetch([{}]);
  const api = createApi({ fetch: f, getRepo: () => "C:/path/to/repo" });
  await api.loadWorkspace();
  const headers = new Headers(f.calls[0].opts.headers);
  assert.equal(headers.get("X-Minimap-Repo"), "C:/path/to/repo");
});

test("X-Minimap-Repo header is NOT set on spec endpoints even when getRepo() has a value", async () => {
  const f = fakeFetch([{}, {}, {}]);
  const api = createApi({ fetch: f, getRepo: () => "C:/path/to/repo" });
  await api.listSessions();
  await api.getSessionContext("/some/file.md");
  await api.attachSession("/some/file.md");
  for (const call of f.calls) {
    const headers = new Headers(call.opts.headers || {});
    assert.equal(headers.get("X-Minimap-Repo"), null, `unexpected repo header on ${call.url}`);
  }
});

test("X-Minimap-Repo header is omitted when getRepo() returns empty", async () => {
  const f = fakeFetch([{}]);
  const api = createApi({ fetch: f, getRepo: () => "" });
  await api.loadWorkspace();
  const headers = new Headers(f.calls[0].opts.headers || {});
  assert.equal(headers.get("X-Minimap-Repo"), null);
});

test("aggregate read keeps the selected repo even without a bound item source", async () => {
  const f = fakeFetch([{}]);
  const api = createApi({ fetch: f, getRepo: () => "C:/different/project" });
  await api.loadWorktreeWorkspace();
  assert.deepEqual(f.calls.map((call) => call.url), ["/api/worktree-workspace"]);
  assert.ok(f.calls.every((call) => new Headers(call.opts.headers).get("X-Minimap-Repo") === "C:/different/project"));
});

test("inventory ignores the editor pin and fresh workspace binds the explicitly selected checkout", async () => {
  const f = fakeFetch([{}, {}]);
  const api = createApi({ fetch: f, getRepo: () => "C:/board", getSource: () => ({ mode: "across", identity: null }) });
  await api.discoverWorktreeSources();
  const selected = { repoRoot: "C:/other/β", sourceKey: "selected", git: { branchRef: "refs/heads/β" } };
  await api.loadSourceWorkspace(selected);
  assert.deepEqual(f.calls.map((call) => call.url), ["/api/worktree-sources", "/api/worktree-source-workspace"]);
  assert.equal(new Headers(f.calls[0].opts.headers).get("X-Minimap-Repo"), "C:/board");
  const headers = new Headers(f.calls[1].opts.headers);
  assert.equal(headers.get("X-Minimap-Repo-Encoded"), encodeURIComponent(selected.repoRoot));
  assert.deepEqual(JSON.parse(headers.get("X-Minimap-Source-Context")), selected);
});

test("bound roadmap and spec requests carry an ASCII-safe Unicode source context", async () => {
  const f = fakeFetch([{}, {}, {}]);
  const identity = { repoRoot: "C:/projects/β", sourceKey: "abc", label: "β branch", git: { branchRef: "refs/heads/β" } };
  const api = createApi({ fetch: f, getRepo: () => "C:/other", getSource: () => ({ mode: "across", identity }) });
  await api.readItem("feature-a");
  await api.saveItem("feature-a", { expectedRevision: "1" });
  await api.applySuggestion("C:/projects/β/roadmap/features/feature-a.md", "suggestion-1");
  assert.deepEqual(f.calls.map((call) => call.url), [
    "/api/source/items/feature-a", "/api/source/items/feature-a", "/api/source/spec-sessions/by-file/suggestions/suggestion-1/apply",
  ]);
  for (const call of f.calls) {
    const headers = new Headers(call.opts.headers);
    assert.equal(headers.get("X-Minimap-Repo-Encoded"), encodeURIComponent(identity.repoRoot));
    assert.deepEqual(JSON.parse(headers.get("X-Minimap-Source-Context")), {
      repoRoot: identity.repoRoot, sourceKey: identity.sourceKey, git: identity.git,
    });
  }
});

test("bound mode never falls back to legacy routes without a chosen source", async () => {
  const f = fakeFetch([{}]);
  const api = createApi({ fetch: f, getRepo: () => "C:/repo", getSource: () => ({ mode: "across", identity: null }) });
  await assert.rejects(api.saveItem("feature-a", {}), /Select one checkout/);
  assert.equal(f.calls.length, 0);
});

test("saveItem POSTs JSON with Content-Type", async () => {
  const f = fakeFetch([{ body: { id: "abc" } }]);
  const api = createApi({ fetch: f });
  await api.saveItem("abc-1", { title: "Hi" });
  assert.equal(f.calls[0].url, "/api/items/abc-1");
  assert.equal(f.calls[0].opts.method, "POST");
  const headers = new Headers(f.calls[0].opts.headers);
  assert.match(headers.get("Content-Type") || "", /application\/json/);
  assert.deepEqual(JSON.parse(f.calls[0].opts.body), { title: "Hi" });
});

test("saveItem url-encodes the id", async () => {
  const f = fakeFetch([{}]);
  const api = createApi({ fetch: f });
  await api.saveItem("foo bar/baz", {});
  assert.equal(f.calls[0].url, "/api/items/foo%20bar%2Fbaz");
});

test("reorderMetadata posts an anchor-based order request with revisions", async () => {
  const f = fakeFetch([{ body: { boardRevision: "next" } }]);
  const api = createApi({ fetch: f, getRepo: () => "C:/repo" });
  await api.reorderMetadata({
    itemId: "feature-a", anchorItemId: "feature-b", placement: "before", expectedBoardRevision: "board-1",
    field: "status", value: "done", expectedItemRevision: "item-1",
  });
  assert.equal(f.calls[0].url, "/api/metadata-order");
  assert.equal(f.calls[0].opts.method, "POST");
  assert.deepEqual(JSON.parse(f.calls[0].opts.body), {
    itemId: "feature-a", anchorItemId: "feature-b", placement: "before", expectedBoardRevision: "board-1",
    field: "status", value: "done", expectedItemRevision: "item-1",
  });
  assert.equal(new Headers(f.calls[0].opts.headers).get("X-Minimap-Repo"), "C:/repo");
});

test("reorderLensGroup posts a config-only anchor request", async () => {
  const f = fakeFetch([{ body: { configRevision: "next" } }]);
  const api = createApi({ fetch: f });
  await api.reorderLensGroup("status", { value: "done", anchorValue: "queued", placement: "after", expectedConfigRevision: "config-1" });
  assert.equal(f.calls[0].url, "/api/lenses/status/order");
  assert.equal(f.calls[0].opts.method, "POST");
  assert.deepEqual(JSON.parse(f.calls[0].opts.body), {
    value: "done", anchorValue: "queued", placement: "after", expectedConfigRevision: "config-1",
  });
});
test("addComment forwards file plus payload as JSON body", async () => {
  const f = fakeFetch([{}]);
  const api = createApi({ fetch: f });
  await api.addComment("/x.md", { by: "me", kind: "concern", text: "ok", scope: "global" });
  assert.equal(f.calls[0].url, "/api/spec-sessions/by-file/comments");
  assert.equal(f.calls[0].opts.method, "POST");
  assert.deepEqual(JSON.parse(f.calls[0].opts.body), {
    file: "/x.md", by: "me", kind: "concern", text: "ok", scope: "global",
  });
});

test("getSessionByFile encodes the path query param", async () => {
  const f = fakeFetch([{}]);
  const api = createApi({ fetch: f });
  await api.getSessionByFile("C:/dir/file with spaces.md");
  assert.equal(
    f.calls[0].url,
    "/api/spec-sessions/by-file?path=C%3A%2Fdir%2Ffile%20with%20spaces.md",
  );
});

test("normalizeError exposes details from server payload", () => {
  const e = normalizeError({ status: 422 }, { error: { code: "x", message: "y", details: { foo: "bar" } } });
  assert.equal(e.code, "x");
  assert.equal(e.message, "y");
  assert.deepEqual(e.details, { foo: "bar" });
  assert.equal(e.statusCode, 422);
});
