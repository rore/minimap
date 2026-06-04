import test from "node:test";
import assert from "node:assert/strict";
import { createState } from "../package/minimap/ui/state.js";

test("createState returns initial state with default appMode and empty repoPath", () => {
  const s = createState();
  const v = s.get();
  assert.equal(v.appMode, "roadmap");
  assert.equal(v.repoPath, "");
  assert.equal(v.activeLens, "board");
  assert.equal(v.boardLayout, "list");
});

test("createState returns initial spec subtree with default review tab", () => {
  const s = createState();
  const v = s.get();
  assert.equal(v.spec.reviewTab, "comments");
  assert.equal(v.spec.commentFilter, "open");
  assert.equal(v.spec.suggestionAnchorMode, "quote");
  assert.equal(v.spec.viewMode, "review");
});

test("initialOverrides shallow-merge into the top level", () => {
  const s = createState({ scopeCollapsed: true, scopeWidth: 320 });
  const v = s.get();
  assert.equal(v.scopeCollapsed, true);
  assert.equal(v.scopeWidth, 320);
  assert.equal(v.appMode, "roadmap"); // not overridden
});

test("initialOverrides.spec merges into the spec subtree without losing other spec keys", () => {
  const s = createState({ spec: { filesCollapsed: true, bodyFrac: 0.7 } });
  const v = s.get();
  assert.equal(v.spec.filesCollapsed, true);
  assert.equal(v.spec.bodyFrac, 0.7);
  assert.equal(v.spec.reviewTab, "comments"); // preserved
  assert.equal(v.spec.commentFilter, "open"); // preserved
});

test("set merges into top level and notifies subscribers", () => {
  const s = createState();
  let count = 0;
  s.subscribe(() => count++);
  s.set({ appMode: "spec" });
  assert.equal(s.get().appMode, "spec");
  assert.equal(count, 1);
});

test("subscribe returns an unsubscribe function", () => {
  const s = createState();
  let count = 0;
  const off = s.subscribe(() => count++);
  off();
  s.set({ appMode: "spec" });
  assert.equal(count, 0);
});

test("update lets the caller mutate in place and notifies", () => {
  const s = createState();
  let count = 0;
  s.subscribe(() => count++);
  s.update((v) => { v.searchQuery = "foo"; });
  assert.equal(s.get().searchQuery, "foo");
  assert.equal(count, 1);
});

test("get always returns the same live object reference", () => {
  const s = createState();
  const a = s.get();
  s.set({ appMode: "spec" });
  const b = s.get();
  assert.strictEqual(a, b, "get() should return the same mutable reference");
});

test("Set and Map fields are independent per-instance", () => {
  const s1 = createState();
  const s2 = createState();
  s1.get().collapsedGroups.add("g1");
  s1.get().spec.expandedResolvedCommentIds.add("cmt1");
  s1.get().spec.replyDrafts.set("k", "v");
  // Second instance must not see s1's mutations
  assert.equal(s2.get().collapsedGroups.size, 0);
  assert.equal(s2.get().spec.expandedResolvedCommentIds.size, 0);
  assert.equal(s2.get().spec.replyDrafts.size, 0);
});

test("createState seeds spec.lastSeenContentHash to empty string and spec.fileChangedDetected to false", () => {
  const s = createState();
  const v = s.get();
  assert.equal(v.spec.lastSeenContentHash, "");
  assert.equal(v.spec.fileChangedDetected, false);
});

test("multiple subscribers all fire on set", () => {
  const s = createState();
  let a = 0, b = 0;
  s.subscribe(() => a++);
  s.subscribe(() => b++);
  s.set({ appMode: "spec" });
  assert.equal(a, 1);
  assert.equal(b, 1);
});
