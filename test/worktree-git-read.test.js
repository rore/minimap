import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import { runLineageGitRead } from "../package/minimap/src/worktree-aggregate.js";
import { runGitLaunch } from "../package/minimap/src/worktree-sources.js";

test("Git launches yield between starts without serializing child completion", async () => {
  const order = [], releases = [];
  let firstStarted, allStarted;
  const first = new Promise((resolve) => { firstStarted = resolve; });
  const started = new Promise((resolve) => { allStarted = resolve; });
  const reads = [0, 1, 2].map((index) => runGitLaunch(() => {
    order.push(`launch ${index}`);
    setTimeout(() => order.push(`callback ${index}`), 0);
    if (index === 0) firstStarted();
    if (index === 2) allStarted();
    return new Promise((resolve) => releases.push(resolve));
  }));
  assert.deepEqual(order, [], "launch admission must not drain synchronously");
  await first;
  assert.equal(releases.length, 1);
  await started;
  assert.equal(releases.length, 3, "pending children must not block later launches");
  assert.ok(order.indexOf("callback 0") < order.indexOf("launch 1"));
  assert.ok(order.indexOf("callback 1") < order.indexOf("launch 2"));
  releases.forEach((release) => release());
  await Promise.all(reads);
});

test("queued Git launch cancellation never starts and failures leave admission usable", async () => {
  const controller = new AbortController(), reason = new Error("cancel queued launch");
  let cancelledStarted = false;
  const first = runGitLaunch(() => "first");
  const cancelled = runGitLaunch(() => { cancelledStarted = true; }, controller.signal);
  const last = runGitLaunch(() => "last");
  controller.abort(reason);
  await assert.rejects(cancelled, (error) => error === reason);
  assert.equal(cancelledStarted, false);
  assert.deepEqual(await Promise.all([first, last]), ["first", "last"]);
  await assert.rejects(runGitLaunch(() => { cancelledStarted = true; }, controller.signal), (error) => error === reason);
  assert.equal(cancelledStarted, false);
  const syncFailure = runGitLaunch(() => { throw new Error("sync failure"); });
  const asyncFailure = runGitLaunch(() => Promise.reject(new Error("async failure")));
  const healthy = runGitLaunch(() => "recovered");
  await assert.rejects(syncFailure, /sync failure/);
  await assert.rejects(asyncFailure, /async failure/);
  assert.equal(await healthy, "recovered");
});

test("lineage Git reads overlap but share eight slots across concurrent scans", async () => {
  let running = 0, maximum = 0, started = 0;
  const releases = [];
  const read = async () => {
    started++;
    maximum = Math.max(maximum, ++running);
    await new Promise((resolve) => releases.push(resolve));
    running--;
  };
  const scans = [0, 1, 2].map(() => Promise.all(Array.from({ length: 8 }, () => runLineageGitRead(read))));
  await setImmediate();
  assert.equal(started, 8, "independent scans must share the same eight slots");
  while (started < 24 || releases.length) {
    releases.splice(0).forEach((release) => release());
    await setImmediate();
  }
  await Promise.all(scans);
  assert.equal(maximum, 8, "reads must overlap without multiplying children per scan");
  assert.equal(running, 0);
});

test("aborted queued reads reject promptly, never start, and leave slots usable", async () => {
  const releases = [];
  const blockers = Array.from({ length: 8 }, () => runLineageGitRead(() => new Promise((resolve) => releases.push(resolve))));
  const controller = new AbortController();
  let cancelledReadStarted = false;
  const cancelled = runLineageGitRead(() => { cancelledReadStarted = true; }, controller.signal);
  const healthy = runLineageGitRead(() => "next scan");
  controller.abort(new Error("cancelled scan"));
  await assert.rejects(cancelled, /cancelled scan/);
  assert.equal(cancelledReadStarted, false);
  releases.forEach((release) => release());
  await Promise.all(blockers);
  assert.equal(await healthy, "next scan");
  await assert.rejects(runLineageGitRead(() => { throw new Error("read failed"); }), /read failed/);
  await assert.rejects(runLineageGitRead(() => { cancelledReadStarted = true; }, controller.signal), /cancelled scan/);
  assert.equal(cancelledReadStarted, false);
  assert.equal(await runLineageGitRead(() => "recovered"), "recovered");
});
