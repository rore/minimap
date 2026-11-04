import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const preload = String.raw`
const cp = require('node:child_process');
const threads = require('node:worker_threads');
if (threads.isMainThread) {
  globalThis.gitCalls = [];
  globalThis.gitDispatches = [];
  const original = cp.execFile;
  cp.execFile = (file, args, ...rest) => {
    if (file === 'git' && (args[0] === 'rev-parse' || args[1] === 'get-url')) {
      globalThis.gitCalls.push({ args, options: rest[0] });
    }
    return original(file, args, ...rest);
  };
  cp.execFile[require('node:util').promisify.custom] = (...args) => new Promise((resolve, reject) => {
    cp.execFile(...args, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr }));
  });
  const OriginalWorker = threads.Worker;
  threads.Worker = class extends OriginalWorker {
    postMessage(message, ...rest) {
      if (message?.type === 'git-read') globalThis.gitDispatches.push(message);
      return super.postMessage(message, ...rest);
    }
  };
  require('node:module').syncBuiltinESMExports();
}
`;
const probe = String.raw`
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const { resolveRoadmapItemReference: resolve } = await import(process.env.MINIMAP_PALLIUM_TEST_MODULE);
const { enableGitWorkerReads, closeGitWorkerReads } = await import(process.env.MINIMAP_GIT_TEST_MODULE);
const worker = process.argv[2] === 'worker';
if (worker) enableGitWorkerReads();
const root = process.cwd(), signal = new AbortController().signal;
const expected = (name) => ({ contract: 'minimap-roadmap-item/v1',
  scope_ref: 'roadmap:v1:git:github.com/example/' + name + '#roadmap%20space', local_ref: 'item:v1:caf%C3%A9' });
try {
  assert.deepEqual(await resolve(root, 'roadmap space', 'café', { signal }), expected('first'));
  assert.equal(globalThis.gitCalls.length, worker ? 0 : 2, 'Worker-enabled resolution must not launch foreground Git');
  const reads = worker ? globalThis.gitDispatches : globalThis.gitCalls;
  assert.deepEqual(reads.map(call => call.args), [['rev-parse', '--show-toplevel'], ['remote', 'get-url', 'origin']]);
  for (const call of reads) {
    const settings = worker ? call.settings : call.options;
    assert.equal(worker ? call.root : settings.cwd, root);
    assert.equal(settings.timeout, 2000);
    assert.equal(settings.maxBuffer, 64 * 1024);
    if (!worker) { assert.equal(settings.signal, signal); assert.equal(settings.windowsHide, true); assert.equal(settings.shell, false); }
  }
  const git = (...args) => promisify(execFile)('git', args, { cwd: root, windowsHide: true, shell: false });
  await git('remote', 'set-url', 'origin', 'https://github.com/example/second.git');
  assert.deepEqual(await resolve(root, 'roadmap space', 'café'), expected('second'), 'Next lookup must read the changed origin');
  await git('remote', 'remove', 'origin');
  assert.equal(await resolve(root, 'roadmap space', 'café'), null, 'Missing origin must remain unavailable');
  if (worker) assert.equal(globalThis.gitCalls.length, 0);

  const before = [globalThis.gitCalls.length, globalThis.gitDispatches.length], injected = [];
  assert.deepEqual(await resolve(root, 'roadmap space', 'café', { signal, runGit: async (args, cwd, receivedSignal) => {
    injected.push({ args, cwd, signal: receivedSignal });
    return args[0] === 'rev-parse' ? root : 'https://github.com/example/injected.git';
  } }), expected('injected'));
  assert.deepEqual(injected.map(call => call.args), [['rev-parse', '--show-toplevel'], ['remote', 'get-url', 'origin']]);
  assert.ok(injected.every(call => call.cwd === root && call.signal === signal));
  assert.deepEqual([globalThis.gitCalls.length, globalThis.gitDispatches.length], before);

  const controller = new AbortController(), reason = new Error('caller cancellation');
  const pending = resolve(root, 'roadmap space', 'café', { signal: controller.signal });
  controller.abort(reason);
  await assert.rejects(pending, error => error === reason);
} finally {
  await closeGitWorkerReads();
}
console.log(JSON.stringify({ mode: worker ? 'worker' : 'inline', passed: true }));
`;

for (const mode of ["worker", "inline"]) {
  test(`Pallium reference resolver uses ${mode} Git with fresh identity and caller cancellation`, { timeout: 15000 }, async () => {
    const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-pallium-git-test-"));
    try {
      const repo = path.join(owned, "repo");
      await fs.mkdir(path.join(repo, "roadmap space"), { recursive: true });
      const git = (...args) => exec("git", args, { cwd: repo, windowsHide: true, shell: false });
      await git("init", "--quiet");
      await git("remote", "add", "origin", "https://github.com/example/first.git");
      const preloadFile = path.join(owned, "preload.cjs"), probeFile = path.join(owned, "probe.mjs");
      await fs.writeFile(preloadFile, preload);
      await fs.writeFile(probeFile, probe);
      const { stdout } = await exec(process.execPath, ["--require", preloadFile, probeFile, mode], {
        cwd: repo, windowsHide: true, shell: false, timeout: 12000,
        env: { ...process.env,
          MINIMAP_PALLIUM_TEST_MODULE: new URL("../package/minimap/src/pallium.js", import.meta.url).href,
          MINIMAP_GIT_TEST_MODULE: new URL("../package/minimap/src/git-reads.js", import.meta.url).href },
      });
      assert.deepEqual(JSON.parse(stdout), { mode, passed: true });
    } finally {
      assert.equal(path.dirname(owned), os.tmpdir());
      assert.match(path.basename(owned), /^minimap-pallium-git-test-/);
      await fs.rm(owned, { recursive: true, force: true });
    }
  });
}
