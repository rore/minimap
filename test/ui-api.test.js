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
