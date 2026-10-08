import assert from "node:assert/strict";
import test from "node:test";
import { createApi } from "../package/minimap/ui/api.js";
import { compactWorktreePayload } from "../package/minimap/ui/worktree-payload.js";

test("compact workspace opt-in preserves request scope and cancellation", async () => {
  const calls = [];
  const oldPayload = { features: [], groups: [], sources: [], partial: true };
  const api = createApi({ getRepo: () => "C:/fixtures/opened", fetch: async (url, options) => {
    calls.push({ url, options }); return { ok: true, json: async () => oldPayload };
  } });
  const controller = new AbortController();
  assert.equal(await api.loadWorktreeWorkspace({ compact: true, cached: true, participants: false,
    openedOnly: true, signal: controller.signal }), oldPayload, "Older servers may return the full payload");
  const query = new URL(calls[0].url, "http://localhost");
  assert.equal(query.searchParams.get("compact"), "1");
  assert.equal(query.searchParams.get("openedOnly"), "1");
  assert.equal(query.searchParams.get("cached"), "1");
  assert.equal(query.searchParams.get("participants"), "0");
  assert.equal(calls[0].options.signal, controller.signal);
  assert.equal(calls[0].options.headers.get("X-Minimap-Repo"), "C:/fixtures/opened");
  assert.equal(Object.hasOwn(calls[0].options, "compact"), false);
  await api.loadWorktreeWorkspace();
  assert.equal(calls[1].url, "/api/worktree-workspace");
});

test("API expands compact payloads and rejects unknown formats", async () => {
  const full = { sources: [], features: [], groups: [], workspace: null, partial: true };
  let payload = compactWorktreePayload(full);
  const api = createApi({ fetch: async () => ({ ok: true, json: async () => payload }) });
  assert.deepEqual(await api.loadWorktreeWorkspace({ compact: true }), full);
  payload = { ...payload, worktreeFormat: "unknown" };
  await assert.rejects(api.loadWorktreeWorkspace({ compact: true }), { code: "invalid_worktree_payload" });
});
