import { parentPort } from "node:worker_threads";
import { inlineGitRead } from "./git-reads.js";

const jobs = new Map(), queue = [];
let scheduled = false, closing = false, closed = false;
const errorData = (error) => Object.fromEntries(["name", "message", "stack", "code", "killed", "signal", "cmd", "stdout", "stderr"]
  .filter((key) => error[key] !== undefined).map((key) => [key, error[key]]));

function finishClose() {
  if (!closing || jobs.size || closed) return;
  closed = true;
  parentPort.postMessage({ type: "git-drained" });
  parentPort.close();
}

function schedule() {
  if (scheduled || !queue.length) return;
  scheduled = true;
  // Give queued cancellation/control messages a turn between native child starts.
  setTimeout(() => {
    scheduled = false;
    const job = queue.shift();
    if (!job) { finishClose(); return; }
    const timeout = job.deadline - Date.now();
    const read = job.controller.signal.aborted ? Promise.reject(job.controller.signal.reason)
      : timeout <= 0 ? Promise.reject(new Error("Git read deadline expired before launch."))
        : inlineGitRead(job.root, job.args, { ...job.settings, timeout, signal: job.controller.signal });
    Promise.resolve(read).then((value) => {
      parentPort.postMessage({ type: "git-result", id: job.id, value, binary: Buffer.isBuffer(value) });
    }, (error) => {
      parentPort.postMessage({ type: "git-result", id: job.id, error: errorData(error) });
    }).finally(() => { jobs.delete(job.id); finishClose(); });
    schedule();
  }, 0);
}

function drain() {
  if (closing) return;
  closing = true;
  for (const job of [...jobs.values()]) cancel(job);
  finishClose();
}

function cancel(job) {
  if (!job) return;
  job.controller.abort(new Error("Git worker read cancelled."));
  const index = queue.indexOf(job);
  if (index < 0) return;
  queue.splice(index, 1);
  jobs.delete(job.id);
  parentPort.postMessage({ type: "git-result", id: job.id, error: errorData(job.controller.signal.reason) });
  finishClose();
}

parentPort.on("message", (message) => {
  if (message?.type === "git-close") { drain(); return; }
  if (message?.type === "git-cancel") { cancel(jobs.get(message.id)); return; }
  if (message?.type !== "git-read") return;
  if (closing || jobs.size >= 64) {
    parentPort.postMessage({ type: "git-result", id: message.id, error: { message: "Git worker is unavailable." } });
    return;
  }
  const job = { ...message, controller: new AbortController() };
  jobs.set(job.id, job);
  queue.push(job);
  schedule();
});
process.on("uncaughtException", drain);
process.on("unhandledRejection", drain);
parentPort.postMessage({ type: "git-ready" });
