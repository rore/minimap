import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import { runLineageGitRead } from "../package/minimap/src/worktree-aggregate.js";

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
