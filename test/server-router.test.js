import test from "node:test";
import assert from "node:assert/strict";
// Import from src/router.js, not server.js — server.js auto-starts the HTTP
// listener on import (the launcher script relies on that side effect), so
// importing it from a test would boot a real server. matchRoute is re-exported
// from server.js for any caller that already imports from there.
import { matchRoute } from "../package/minimap/src/router.js";

test("matchRoute returns the matching handler entry for a fixed path", () => {
  const routes = [
    { method: "GET", pattern: /^\/api\/workspace$/, handler: () => "workspace" },
    { method: "POST", pattern: /^\/api\/board$/, handler: () => "board" },
  ];
  const m = matchRoute(routes, "GET", "/api/workspace");
  assert.equal(m.handler(), "workspace");
});

test("matchRoute returns null for an unknown path", () => {
  const routes = [{ method: "GET", pattern: /^\/api\/workspace$/, handler: () => "x" }];
  assert.equal(matchRoute(routes, "GET", "/nope"), null);
});

test("matchRoute distinguishes by method", () => {
  const routes = [
    { method: "GET", pattern: /^\/api\/items\/([^/]+)$/, handler: () => "get" },
    { method: "POST", pattern: /^\/api\/items\/([^/]+)$/, handler: () => "post" },
  ];
  assert.equal(matchRoute(routes, "GET", "/api/items/abc").handler(), "get");
  assert.equal(matchRoute(routes, "POST", "/api/items/abc").handler(), "post");
});

test("matchRoute exposes captured groups via the match", () => {
  const routes = [{ method: "GET", pattern: /^\/api\/items\/([^/]+)$/, handler: () => null }];
  const m = matchRoute(routes, "GET", "/api/items/foo-1");
  assert.deepEqual(m.params, ["foo-1"]);
});
