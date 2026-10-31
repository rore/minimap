import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { initializeWorkspace } from "../package/minimap/src/roadmap.js";

const exec = promisify(execFile);
const owned = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-git-worker-test-"));
const preloadFile = path.join(owned, "preload.cjs"), probeFile = path.join(owned, "probe.mjs");
let serverChild;
const preload = String.raw`
const threads = require('node:worker_threads');
const { syncBuiltinESMExports } = require('node:module');
if (threads.isMainThread) {
  if(process.env.MINIMAP_GIT_TEST_MARKER&&/^start-server\.(cjs|mjs)$/.test(require('node:path').basename(process.argv[1]||''))) {
    const fs=require('node:fs/promises'), sync=require('node:fs'), unlink=fs.unlink;
    fs.unlink=async (file,...args)=>{
      if(require('node:path').basename(String(file))==='server.json') {
        const status=await fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>r.status,()=>0);
        sync.writeFileSync(process.env.MINIMAP_GIT_TEST_MARKER+'.registry',JSON.stringify({status,childClosed:sync.existsSync(process.env.MINIMAP_GIT_TEST_MARKER+'.closed')}));
        await new Promise(resolve=>setTimeout(resolve,200));
      }
      return unlink(file,...args);
    };
  }
  globalThis.gitWorkerEvents = [];
  const Original = threads.Worker;
  threads.Worker = class extends Original {
    postMessage(message,...args) {
      if(message?.type==='git-read')globalThis.gitWorkerEvents.push({type:'test-dispatch',id:message.id});
      return super.postMessage(message,...args);
    }
    terminate() {
      if(process.env.MINIMAP_GIT_TEST_LATE_READY==='1')this.emit('message',{type:'git-ready'});
      return super.terminate();
    }
    constructor(...args) {
      super(...args);
      if (!args[1]?.workerData?.minimapGitRead) return;
      globalThis.gitWorkerEvents.push({ type: 'worker-created' });
      this.on('message', e => {
        if(e?.type?.startsWith('test-')) globalThis.gitWorkerEvents.push(e);
        const marker=process.env.MINIMAP_GIT_TEST_MARKER;
        if(marker&&e?.type==='test-child')require('node:fs').writeFileSync(marker,JSON.stringify(e));
        if(marker&&e?.type==='test-child-close')require('node:fs').writeFileSync(marker+'.closed',String(e.pid));
      });
      this.on('exit', () => globalThis.gitWorkerEvents.push({ type: 'worker-exited' }));
    }
  };
  syncBuiltinESMExports();
} else if (threads.workerData?.minimapGitRead) {
  if(process.env.MINIMAP_GIT_TEST_STARTUP==='hold')Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10000);
  const cp = require('node:child_process');
  for (const method of ['execFile', 'spawn']) {
    const original = cp[method];
    cp[method] = (file, args, ...rest) => {
      if(file !== 'git') return original(file,args,...rest);
      const command=args[0];
      if(command === 'minimap-test-hard-failure') process.exit(9);
      if(command === 'minimap-test-block-start') {
        threads.parentPort.postMessage({ type:'test-block-start' });
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,350);
      }
      if(command === 'minimap-test-handled-failure') setImmediate(() => { throw new Error('owned handled failure'); });
      if(command.startsWith('minimap-test-')) {
        if(command === 'minimap-test-hold') { file=process.execPath; args=['-e','setTimeout(() => {},10000)']; }
        else if(command === 'minimap-test-output') { file=process.execPath; args=['-e','process.stdout.write("x".repeat(10000))']; }
        else args=['--version'];
      }
      if(process.env.MINIMAP_GIT_TEST_MARKER&&command==='rev-parse') {
        file=process.execPath;args=['-e','setTimeout(() => {},10000)'];
        setImmediate(()=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,500));
      }
      const child=original(file,args,...rest);
      rest[0]?.signal?.addEventListener('abort',()=>threads.parentPort.postMessage({type:'test-signal-abort',name:rest[0].signal.reason?.name,message:rest[0].signal.reason?.message}),{once:true});
      threads.parentPort.postMessage({type:'test-child',command,pid:child.pid});
      child.once('close',() => threads.parentPort.postMessage({type:'test-child-close',pid:child.pid}));
      return child;
    };
  }
  syncBuiltinESMExports();
}
`;
const probe = String.raw`
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
const {readGit,enableGitWorkerReads,closeGitWorkerReads}=await import(process.env.MINIMAP_GIT_TEST_MODULE);
const scenario=process.argv[2], events=globalThis.gitWorkerEvents;
const read=(command,extra={}) => readGit(process.cwd(),Array.isArray(command)?command:[command],{timeout:2000,maxBuffer:1024*1024,...extra});
async function until(predicate) { const end=Date.now()+2500; while(!predicate()){assert.ok(Date.now()<end,'Owned event deadline');await delay(5);} }
function closed(pid) {
  assert.ok(events.some(e=>e.type==='test-child-close'&&e.pid===pid),'Result must follow child close');
  assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
}
enableGitWorkerReads();
let uncertain=false;
try {
  if(scenario==='idle') {
    assert.match(await read('--version'),/git version/);
  } else if(scenario==='startup-bound') {
    const begin=performance.now();
    await assert.rejects(read('--version',{timeout:150}),/deadline/);
    await closeGitWorkerReads();assert.ok(performance.now()-begin<3000);
    assert.ok(!events.some(e=>e.type==='test-child'));
  } else if(scenario==='startup-watchdog'||scenario==='late-ready') {
    const begin=performance.now();
    await assert.rejects(read('--version',{timeout:10000}),/startup deadline/);
    assert.ok(performance.now()-begin<3000);assert.ok(!events.some(e=>e.type==='test-child'));
    if(scenario==='late-ready')assert.ok(!events.some(e=>e.type==='test-dispatch'),'Failed generation must ignore late readiness');
    process.env.MINIMAP_GIT_TEST_STARTUP='';
    process.env.MINIMAP_GIT_TEST_LATE_READY='';
    assert.match(await read('--version'),/git version/);assert.equal(events.filter(e=>e.type==='worker-created').length,2);
  } else if(scenario==='nonblocking') {
    let finished=false; const pending=read('minimap-test-block-start').finally(()=>{finished=true;});
    await until(()=>events.some(e=>e.type==='test-block-start'));
    let heartbeat=false;setTimeout(()=>{heartbeat=true;},20);await delay(80);
    assert.equal(heartbeat,true);assert.equal(finished,false);assert.match(await pending,/git version/);
  } else if(scenario==='cancellation') {
    const queued=new AbortController(), reason=new Error('queued reason');
    const initial=read('minimap-test-never-start',{signal:queued.signal});queued.abort(reason);
    await assert.rejects(initial,e=>e===reason);await read('--version');
    const first=read('minimap-test-block-start');await until(()=>events.some(e=>e.type==='test-block-start'));
    const waiting=new AbortController(), laterReason=new Error('worker queue reason');
    const second=read('minimap-test-never-start',{signal:waiting.signal});waiting.abort(laterReason);
    await assert.rejects(second,e=>e===laterReason);await first;
    assert.ok(!events.some(e=>e.command==='minimap-test-never-start'));
    const active=new AbortController(), activeReason=Object.assign(new Error('active reason'),{name:'AbortError'});
    const pending=read('minimap-test-hold',{signal:active.signal});
    await until(()=>events.some(e=>e.command==='minimap-test-hold'));
    const pid=events.find(e=>e.command==='minimap-test-hold').pid;active.abort(activeReason);
    await assert.rejects(pending,e=>e===activeReason);closed(pid);assert.match(await read('--version'),/git version/);
    assert.ok(events.some(e=>e.type==='test-signal-abort'&&e.name==='AbortError'&&e.message==='active reason'));
  } else if(scenario==='fidelity') {
    await assert.rejects(read(['rev-parse','--minimap-invalid-option','--verify']),e=>typeof e.stderr==='string'&&e.stderr.length>0&&typeof e.code==='number');
    await assert.rejects(read('--version',{maxBuffer:2}),e=>e.code==='ERR_CHILD_PROCESS_STDIO_MAXBUFFER');
    const buffer=await read('minimap-test-output',{input:'',maxBuffer:20000});assert.equal(Buffer.isBuffer(buffer),true);assert.equal(buffer.length,10000);
    await assert.rejects(read('minimap-test-output',{input:'',maxBuffer:32}),/ancestor batch unavailable/);
    await assert.rejects(read('minimap-test-hold',{timeout:150}),e=>e.killed===true);
    for(const event of events.filter(e=>e.type==='test-child'))closed(event.pid);
  } else if(scenario==='bounded') {
    const controls=Array.from({length:64},()=>new AbortController());
    const pending=controls.map(c=>read('minimap-test-never-start',{signal:c.signal}));const done=Promise.allSettled(pending);
    await assert.rejects(read('--version'),/request limit/);controls.forEach(c=>c.abort());
    assert.ok((await done).every(r=>r.status==='rejected'));assert.ok(!events.some(e=>e.type==='test-child'));
  } else if(scenario==='handled-failure') {
    const active=read('minimap-test-hold');const outcome=assert.rejects(active);
    await until(()=>events.some(e=>e.command==='minimap-test-hold'));const pid=events.find(e=>e.command==='minimap-test-hold').pid;
    await assert.rejects(read('minimap-test-handled-failure'));await outcome;
    await until(()=>events.some(e=>e.type==='worker-exited'));closed(pid);
    assert.match(await read('--version'),/git version/);assert.equal(events.filter(e=>e.type==='worker-created').length,2);
  } else if(scenario==='hard-failure') {
    await assert.rejects(read('minimap-test-hard-failure'),/without confirmed child cleanup/);
    await assert.rejects(read('--version'),/disabled/);await assert.rejects(closeGitWorkerReads(),/cleanup/);uncertain=true;
    assert.ok(!events.some(e=>e.type==='test-child'),'Hard exit must not create an orphan');
  } else if(scenario==='shutdown') {
    const active=read('minimap-test-hold');const outcome=assert.rejects(active);
    await until(()=>events.some(e=>e.command==='minimap-test-hold'));const pid=events.find(e=>e.command==='minimap-test-hold').pid;
    const begin=performance.now();await closeGitWorkerReads();await outcome;assert.ok(performance.now()-begin<3000);closed(pid);
    await assert.rejects(read('--version'),/shutting down/);
  } else throw new Error('Unknown owned probe');
} finally {if(!uncertain&&scenario!=='idle')await closeGitWorkerReads();}
console.log(JSON.stringify({scenario,passed:true}));
`;
await fs.writeFile(preloadFile, preload);
await fs.writeFile(probeFile, probe);
after(async () => {
  assert.ok(!serverChild || serverChild.exitCode !== null, "Keep evidence if the owned test server did not stop");
  assert.equal(path.dirname(owned), os.tmpdir());
  assert.match(path.basename(owned), /^minimap-git-worker-test-/);
  await fs.rm(owned, { recursive: true, force: true });
});
for (const scenario of ["nonblocking", "cancellation", "fidelity", "bounded", "handled-failure", "hard-failure", "shutdown", "startup-bound", "startup-watchdog", "late-ready", "idle"]) {
  test(`Git worker: ${scenario}`, { timeout: 15000 }, async () => {
    const begin = performance.now();
    const { stdout } = await exec(process.execPath, ["--require", preloadFile, probeFile, scenario], {
      windowsHide: true, timeout: 12000,
      env: { ...process.env, MINIMAP_GIT_TEST_MODULE: new URL("../package/minimap/src/git-reads.js", import.meta.url).href,
        MINIMAP_GIT_TEST_STARTUP: scenario.startsWith("startup-") || scenario === "late-ready" ? "hold" : "",
        MINIMAP_GIT_TEST_LATE_READY: scenario === "late-ready" ? "1" : "" },
    });
    assert.deepEqual(JSON.parse(stdout), { scenario, passed: true });
    if (scenario === "idle") assert.ok(performance.now() - begin < 3000, "An idle worker must not hold the process open");
  });
}

test("packaged stop keeps health available until the active Git child is drained", { timeout: 15000 }, async () => {
  const repo = path.join(owned, "repo"), home = path.join(owned, "home"), marker = path.join(owned, "child.json");
  await fs.mkdir(repo); await fs.mkdir(home); await initializeWorkspace(repo);
  const listener = http.createServer();
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const port = listener.address().port; await new Promise((resolve) => listener.close(resolve));
  const scripts = fileURLToPath(new URL("../package/minimap/skills/minimap-roadmap/scripts/", import.meta.url));
  const env = { ...process.env, MINIMAP_HOME: home, PORT: String(port), MINIMAP_PALLIUM_ENDPOINT: "",
    MINIMAP_PALLIUM_DASHBOARD_ENDPOINT: "", MINIMAP_PALLIUM_SETTINGS_PATH: path.join(owned, "empty-settings.json"),
    MINIMAP_GIT_TEST_MARKER: marker, NODE_OPTIONS: `--require="${preloadFile.split(path.sep).join("/")}"` };
  await fs.writeFile(env.MINIMAP_PALLIUM_SETTINGS_PATH, "{}");
  const stop = () => exec(process.execPath, [path.join(scripts, "stop-server.mjs")], { env, windowsHide: true, timeout: 5000 });
  try {
    serverChild = spawn(process.execPath, [path.join(scripts, "start-server.cjs")], {
      env, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => reject(new Error(output || "Owned server startup deadline")), 5000);
      const receive = (chunk) => {
        output += chunk;
        if (output.includes("Minimap running at")) { clearTimeout(timer); resolve(); }
      };
      serverChild.stdout.on("data", receive); serverChild.stderr.on("data", receive);
      serverChild.once("error", reject);
    });
    const url = `http://127.0.0.1:${port}`;
    assert.equal((await (await fetch(`${url}/health`)).json()).pid, serverChild.pid);
    const headers = { "X-Minimap-Repo-Encoded": encodeURIComponent(repo) };
    const pending = fetch(`${url}/api/workspace`, { headers }).catch(() => null);
    const end = Date.now() + 3000;
    while (!await fs.access(marker).then(() => true, () => false)) {
      assert.ok(Date.now() < end); await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const { pid } = JSON.parse(await fs.readFile(marker, "utf8"));
    const begin = performance.now();
    const stopped = stop();
    let draining = false;
    while (serverChild.exitCode === null && performance.now() - begin < 2000) {
      const response = await fetch(`${url}/api/workspace`, { method: "POST", headers }).catch(() => null);
      if (response?.status === 503) { draining = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(draining, true);
    assert.equal((await fetch(`${url}/health`)).status, 200, "Health must remain reachable during child drainage");
    assert.match((await stopped).stdout, /stopped/i);
    assert.ok(performance.now() - begin < 3000);
    if (serverChild.exitCode === null) await new Promise((resolve) => serverChild.once("exit", resolve));
    await pending;
    assert.equal(await fs.readFile(`${marker}.closed`, "utf8"), String(pid));
    assert.deepEqual(JSON.parse(await fs.readFile(`${marker}.registry`, "utf8")), { status: 200, childClosed: true },
      "Health must remain available through registry removal after confirmed child drainage");
    assert.throws(() => process.kill(pid, 0), (error) => error.code === "ESRCH");
    await assert.rejects(fs.access(path.join(home, "server.json")));
  } finally {
    if (serverChild?.exitCode === null) {
      await stop();
      if (serverChild.exitCode === null) await new Promise((resolve) => serverChild.once("exit", resolve));
    }
  }
});
