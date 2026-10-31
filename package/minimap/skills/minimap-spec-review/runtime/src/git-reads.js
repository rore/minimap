import { execFile, spawn } from "node:child_process";
import { Worker } from "node:worker_threads";

let enabled = false, closing = false, state, poisoned;
let nextId = 0;
const MAX_PENDING = 64;

export function enableGitWorkerReads() { enabled = true; }

export function inlineGitRead(root, args, { signal, timeout, maxBuffer, input } = {}) {
  if (input === undefined) return new Promise((resolve, reject) => {
    let result;
    const child = execFile("git", args, { cwd: root, windowsHide: true, shell: false,
      timeout, maxBuffer, encoding: "utf8", signal }, (error, stdout, stderr) => {
      if (error) { error.stdout = stdout; error.stderr = stderr; }
      result = { error, stdout };
    });
    child.once("close", () => result.error ? reject(result.error) : resolve(result.stdout));
  });
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd: root, windowsHide: true, shell: false, signal });
    const chunks = [];
    let size = 0, failure;
    const timer = setTimeout(() => child.kill(), timeout);
    child.on("error", (error) => { failure = error; });
    child.stdin.on("error", (error) => { failure = error; child.kill(); });
    child.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBuffer) { child.kill(); return; }
      chunks.push(chunk);
    });
    child.stderr.resume();
    child.on("close", (code) => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else if (code !== 0 || size > maxBuffer) reject(new Error("ancestor batch unavailable"));
      else resolve(Buffer.concat(chunks));
    });
    child.stdin.end(input);
  });
}

function workerState() {
  if (state) return state;
  if (poisoned) throw poisoned;
  const worker = new Worker(new URL("./git-read-worker.js", import.meta.url), { workerData: { minimapGitRead: true } });
  const current = { worker, pending: new Map(), ready: false, stopping: false, drained: false, failure: null };
  const startupTimer = setTimeout(() => {
    if (current.ready) return;
    current.stopping = true;
    current.failure = new Error("Git worker startup deadline expired.");
    current.drained = true; // No command can be dispatched before readiness.
    void worker.terminate().catch((error) => { current.failure = error; });
  }, 2000);
  current.dispatch = (job) => {
    if (current.stopping) return;
    clearTimeout(job.readyTimer);
    try {
      worker.postMessage(job.request);
      job.dispatched = true;
    } catch (error) {
      current.pending.delete(job.request.id);
      job.signal?.removeEventListener("abort", job.abort);
      if (!current.pending.size && !closing) worker.unref();
      job.reject(error);
    }
  };
  current.exited = new Promise((resolve) => {
    worker.on("message", (message) => {
      if (message?.type === "git-ready") {
        if (current.stopping) return;
        clearTimeout(startupTimer);
        current.ready = true;
        if (!closing) for (const job of current.pending.values()) current.dispatch(job);
        return;
      }
      if (message?.type === "git-drained") { current.drained = true; return; }
      if (message?.type !== "git-result") return;
      const job = current.pending.get(message.id);
      if (!job) return;
      current.pending.delete(message.id);
      clearTimeout(job.readyTimer);
      job.signal?.removeEventListener("abort", job.abort);
      if (job.signal?.aborted) job.reject(job.signal.reason);
      else if (message.error) job.reject(Object.assign(new Error(message.error.message), message.error));
      else job.resolve(message.binary ? Buffer.from(message.value) : message.value);
      if (!current.pending.size && !closing) worker.unref();
    });
    worker.once("error", (error) => { current.failure = error; });
    worker.once("exit", () => {
      clearTimeout(startupTimer);
      const failure = current.failure || new Error("Git execution worker stopped.");
      if ([...current.pending.values()].some((job) => job.dispatched) && !current.drained) {
        // shortcut: native worker termination cannot prove child cleanup; add native ownership if required.
        poisoned = new Error("Git worker exited without confirmed child cleanup; further Git reads are disabled.", { cause: failure });
      }
      for (const job of current.pending.values()) {
        clearTimeout(job.readyTimer);
        job.signal?.removeEventListener("abort", job.abort);
        job.reject(job.signal?.aborted ? job.signal.reason : poisoned || failure);
      }
      current.pending.clear();
      if (state === current) state = null;
      resolve();
    });
    worker.on("messageerror", (error) => {
      current.failure = error;
      worker.postMessage({ type: "git-close" });
    });
  });
  state = current;
  worker.unref();
  return current;
}

export async function readGit(root, args, options) {
  const { signal, ...settings } = options;
  signal?.throwIfAborted();
  if (closing) throw new Error("Git reads are shutting down.");
  if (!enabled) return inlineGitRead(root, args, options);
  const current = workerState();
  if (current.pending.size >= MAX_PENDING) throw new Error("Git execution request limit reached.");
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const job = { resolve, reject, signal, dispatched: false,
      request: { type: "git-read", id, root, args, settings, deadline: Date.now() + settings.timeout },
      abort: () => {
        if (job.dispatched) {
          try { current.worker.postMessage({ type: "git-cancel", id }); }
          catch (error) { current.failure = error; }
        } else {
          current.pending.delete(id);
          clearTimeout(job.readyTimer);
          signal?.removeEventListener("abort", job.abort);
          if (!current.pending.size && !closing) current.worker.unref();
          reject(signal.reason);
        }
      } };
    current.pending.set(id, job);
    job.readyTimer = setTimeout(() => {
      if (job.dispatched || !current.pending.delete(id)) return;
      signal?.removeEventListener("abort", job.abort);
      if (!current.pending.size && !closing) current.worker.unref();
      reject(Object.assign(new Error("Git read deadline expired before launch."), { code: "ETIMEDOUT" }));
    }, Math.max(1, job.request.deadline - Date.now()));
    current.worker.ref();
    signal?.addEventListener("abort", job.abort, { once: true });
    if (current.ready) current.dispatch(job);
  });
}

export async function closeGitWorkerReads() {
  closing = true;
  if (state) {
    const current = state;
    current.stopping = true;
    current.worker.ref();
    for (const [id, job] of current.pending) if (!job.dispatched) {
      current.pending.delete(id);
      clearTimeout(job.readyTimer);
      job.signal?.removeEventListener("abort", job.abort);
      job.reject(job.signal?.aborted ? job.signal.reason : new Error("Git reads are shutting down."));
    }
    if (!current.ready) {
      current.drained = true; // Pre-ready workers cannot own a dispatched Git child.
      await current.worker.terminate();
    } else current.worker.postMessage({ type: "git-close" });
    await current.exited;
    if (!current.drained) throw poisoned || new Error("Git worker cleanup was not confirmed.");
  }
  if (poisoned) throw poisoned;
}
