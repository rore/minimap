import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  canonicalGitRemote,
  encodeReferencePart,
  isTrustedParticipantRequest,
  lookupPalliumParticipants,
  parsePalliumEndpoint,
  resolveRoadmapItemReference,
} from "../package/minimap/src/pallium.js";

const WORK_REF = "work:v1:" + "a".repeat(64);

const reference = {
  contract: "minimap-roadmap-item/v1",
  scope_ref: "roadmap:v1:git:github.com/owner/repo#roadmap",
  local_ref: "item:v1:feature",
};

function participant(index = 0) {
  return {
    endpoint_id: `relay-session-${index}`,
    runtime: "codex",
    session_ref: `session-${index}`,
    container_ref: index % 2 ? "git:github.com/owner/repo-worktree" : "git:github.com/owner/repo",
    title: null,
    alias: index === 0 ? "minimap-dev" : null,
    state: "active",
    lifecycle: "recent",
    destination_health: "active",
    first_seen_at: "2026-09-12T09:00:00Z",
    last_seen_at: "2026-09-12T10:00:00Z",
    closed_at: null,
    scope_generation: 0,
    association: {
      work_ref: WORK_REF,
      scope_ref: reference.scope_ref,
      local_ref: reference.local_ref,
      origins: ["explicit"],
      created_at: "2026-09-12T09:00:00Z",
      updated_at: "2026-09-12T10:00:00Z",
    },
  };
}

function page(offset, rows, overrides = {}) {
  return new Response(JSON.stringify({
    contract: "relay-session-work-associations/v1",
    work_ref: WORK_REF,
    scope_ref: reference.scope_ref,
    local_ref: reference.local_ref,
    history_guidance: "copy exact key",
    participants: rows,
    offset,
    limit: 50,
    ...overrides,
  }), { status: 200, headers: { "content-type": "application/json" } });
}

test("canonical Git identity and reference encoding match published vectors", () => {
  const vectors = new Map([
    ["https://github.com/User/Repo.git", "git:github.com/user/repo"],
    ["https://github.com:443/User/Repo.git", "git:github.com/user/repo"],
    ["ssh://git@github.com:22/User/Repo.git", "git:github.com/user/repo"],
    ["git@github.com:User/Repo.git", "git:github.com/user/repo"],
    ["git@source.example.test:Systems/Repo.git", "git:source.example.test/Systems/Repo"],
    ["https://git.example.test/Team/cafe%CC%81.git", "git:git.example.test/Team/café"],
    ["ssh://builder@git.example.test:2222/Team/Repo.git", "git:git.example.test:2222/Team/Repo"],
  ]);
  for (const [input, expected] of vectors) assert.equal(canonicalGitRemote(input), expected);
  for (const invalid of [
    "file:///tmp/repo",
    "C:/repo",
    "https://user:password@example.test/repo.git",
    "https://user@example.test/repo.git",
    "https://example.test/repo.git?token=secret",
    "https://git.example.test/Team/%2e%2e/Repo.git",
    "git@source example.test:Systems/Repo.git",
  ]) {
    assert.equal(canonicalGitRemote(invalid), null);
  }
  assert.equal(encodeReferencePart("e\u0301 space/子"), "%C3%A9%20space%2F%E5%AD%90");
});

test("roadmap item references are stable across worktrees and distinct across tracker roots", async () => {
  const remote = "https://github.com/Owner/Repo.git";
  const resolve = async (repoRoot, gitRoot, roadmapPath, itemId = "é item") => (
    resolveRoadmapItemReference(repoRoot, roadmapPath, itemId, {
      runGit: async (args) => args[0] === "rev-parse" ? gitRoot : remote,
    })
  );

  const first = await resolve("C:/work/a/apps/product", "C:/work/a", "roadmap");
  const second = await resolve("D:/work/b/apps/product", "D:/work/b", "roadmap");
  const other = await resolve("D:/work/b/apps/other", "D:/work/b", "roadmap");

  assert.deepEqual(first, second);
  assert.equal(first.scope_ref, "roadmap:v1:git:github.com/owner/repo#apps/product/roadmap");
  assert.equal(first.local_ref, "item:v1:%C3%A9%20item");
  assert.notEqual(first.scope_ref, other.scope_ref);
});

test("unsafe or missing repository identity is explicitly unavailable", async () => {
  const missing = await resolveRoadmapItemReference("C:/work/repo", "roadmap", "feature", {
    runGit: async (args) => args[0] === "rev-parse" ? "C:/work/repo" : "https://user:password@example.test/repo.git",
  });
  assert.equal(missing, null);

  const tooLong = await resolveRoadmapItemReference("C:/work/repo", "roadmap", "😀".repeat(100), {
    runGit: async (args) => args[0] === "rev-parse" ? "C:/work/repo" : "https://example.test/repo.git",
  });
  assert.equal(tooLong, null);
});

test("Pallium endpoint and inbound route admission are loopback-only", () => {
  assert.deepEqual(parsePalliumEndpoint(""), { configured: false, endpoint: null });
  assert.deepEqual(parsePalliumEndpoint("http://127.0.0.1:19836"), { configured: true, endpoint: "http://127.0.0.1:19836" });
  assert.deepEqual(parsePalliumEndpoint("http://[::1]:19836/"), { configured: true, endpoint: "http://[::1]:19836" });
  for (const invalid of [
    "https://127.0.0.1:19836",
    "http://example.test:19836",
    "http://user@127.0.0.1:19836",
    "http://127.0.0.1:19836/api",
    "http://127.0.0.1:19836?token=x",
  ]) {
    assert.deepEqual(parsePalliumEndpoint(invalid), { configured: true, endpoint: null });
  }

  const request = (remoteAddress, host = "localhost:4312", origin) => ({
    socket: { remoteAddress },
    headers: { host, ...(origin === undefined ? {} : { origin }) },
  });
  assert.equal(isTrustedParticipantRequest(request("::1")), true);
  assert.equal(isTrustedParticipantRequest(request("::ffff:127.0.0.1", "127.0.0.1:4312", "http://127.0.0.1:4312")), true);
  assert.equal(isTrustedParticipantRequest(request("10.0.0.2")), false);
  assert.equal(isTrustedParticipantRequest(request("127.0.0.1", "example.test:4312")), false);
  assert.equal(isTrustedParticipantRequest(request("127.0.0.1", "localhost:4312", "http://evil.test")), false);
});

test("disabled lookup returns the authoritative reference with zero network calls", async () => {
  let calls = 0;
  const result = await lookupPalliumParticipants({ configured: false, endpoint: null }, reference, {
    fetchImpl: async () => { calls += 1; throw new Error("must not run"); },
  });
  assert.equal(calls, 0);
  assert.equal(result.status, "disabled");
  assert.deepEqual(result.reference, reference);
  assert.deepEqual(result.participants, []);
});

test("lookup distinguishes empty success and returns only validated participant fields", async () => {
  const empty = await lookupPalliumParticipants(
    { configured: true, endpoint: "http://127.0.0.1:19836" },
    reference,
    { fetchImpl: async () => page(0, []) },
  );
  assert.equal(empty.status, "ok");
  assert.deepEqual(empty.participants, []);
  assert.equal(empty.partial, false);

  const row = participant();
  row.secret = "do-not-copy";
  const found = await lookupPalliumParticipants(
    { configured: true, endpoint: "http://127.0.0.1:19836" },
    reference,
    { fetchImpl: async () => page(0, [row]) },
  );
  assert.equal(found.status, "ok");
  assert.equal(found.participants[0].alias, "minimap-dev");
  assert.equal(Object.hasOwn(found.participants[0], "secret"), false);
});

test("pagination uses exact selectors, no container filter, and reports a bounded partial result", async () => {
  const urls = [];
  const result = await lookupPalliumParticipants(
    { configured: true, endpoint: "http://127.0.0.1:19836" },
    reference,
    {
      fetchImpl: async (url) => {
        urls.push(new URL(url));
        const offset = Number(new URL(url).searchParams.get("offset"));
        return page(offset, Array.from({ length: 50 }, (_, index) => participant(offset + index)));
      },
    },
  );
  assert.equal(result.status, "ok");
  assert.equal(result.participants.length, 200);
  assert.equal(result.partial, true);
  assert.deepEqual(urls.map((url) => url.searchParams.get("offset")), ["0", "50", "100", "150"]);
  for (const url of urls) {
    assert.equal(url.searchParams.get("scope_ref"), reference.scope_ref);
    assert.equal(url.searchParams.get("local_ref"), reference.local_ref);
    assert.equal(url.searchParams.get("include_closed"), "false");
    assert.equal(url.searchParams.has("container_ref"), false);
  }
});

test("one overall deadline spans every page", async () => {
  let calls = 0;
  const result = await lookupPalliumParticipants(
    { configured: true, endpoint: "http://127.0.0.1:19836" },
    reference,
    {
      timeoutMs: 25,
      fetchImpl: async (_url, init) => {
        calls += 1;
        if (calls === 1) return page(0, Array.from({ length: 50 }, (_, index) => participant(index)));
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
        });
      },
    },
  );
  assert.equal(calls, 2);
  assert.equal(result.status, "timeout");
  assert.deepEqual(result.participants, []);
});

test("unsupported, malformed, and oversized responses stay distinct and safe", async () => {
  const config = { configured: true, endpoint: "http://127.0.0.1:19836" };
  assert.equal((await lookupPalliumParticipants(config, reference, {
    fetchImpl: async () => new Response("", { status: 404 }),
  })).status, "unsupported");

  assert.equal((await lookupPalliumParticipants(config, reference, {
    fetchImpl: async () => page(0, [], { contract: "wrong" }),
  })).status, "invalid-response");

  for (const overrides of [
    { work_ref: undefined },
    { history_guidance: null },
  ]) {
    assert.equal((await lookupPalliumParticipants(config, reference, {
      fetchImpl: async () => page(0, [], overrides),
    })).status, "invalid-response");
  }

  const mismatched = participant();
  mismatched.association.work_ref = "work:v1:" + "b".repeat(64);
  assert.equal((await lookupPalliumParticipants(config, reference, {
    fetchImpl: async () => page(0, [mismatched]),
  })).status, "invalid-response");

  let pageCalls = 0;
  assert.equal((await lookupPalliumParticipants(config, reference, {
    fetchImpl: async () => {
      pageCalls += 1;
      return page(
        (pageCalls - 1) * 50,
        pageCalls === 1 ? Array.from({ length: 50 }, (_, index) => participant(index)) : [],
        pageCalls === 2 ? { work_ref: "work:v1:" + "b".repeat(64) } : {},
      );
    },
  })).status, "invalid-response");
  assert.equal(pageCalls, 2);

  assert.equal((await lookupPalliumParticipants(config, reference, {
    maxPageBytes: 16,
    fetchImpl: async () => page(0, []),
  })).status, "over-limit");
});