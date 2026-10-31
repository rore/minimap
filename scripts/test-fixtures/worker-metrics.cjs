const threads = require('node:worker_threads');
const { syncBuiltinESMExports } = require('node:module');

module.exports = (snapshot) => {
  if (!threads.isMainThread) {
    if (threads.workerData?.minimapGitRead) {
      threads.parentPort.on('message', (message) => {
        if (message?.type === 'test-worker-metrics-request') threads.parentPort.postMessage({
          type: 'test-worker-metrics', id: message.id, value: snapshot(),
        });
      });
      const close = threads.parentPort.close.bind(threads.parentPort);
      threads.parentPort.close = () => {
        threads.parentPort.postMessage({ type: 'test-worker-metrics-final', value: snapshot() });
        close();
      };
    }
    return async () => [];
  }
  const entries = [];
  let nextId = 0;
  const Original = threads.Worker;
  threads.Worker = class extends Original {
    constructor(...args) {
      super(...args);
      if (!args[1]?.workerData?.minimapGitRead) return;
      const entry = { worker: this, final: null, exited: false, pending: new Map() };
      entries.push(entry);
      this.on('message', (message) => {
        if (message?.type === 'test-worker-metrics-final') entry.final = message.value;
        if (message?.type !== 'test-worker-metrics') return;
        const pending = entry.pending.get(message.id);
        if (pending) { entry.pending.delete(message.id); clearTimeout(pending.timer); pending.resolve(message.value); }
      });
      this.on('exit', () => {
        entry.exited = true;
        for (const pending of entry.pending.values()) {
          clearTimeout(pending.timer);
          if (entry.final) pending.resolve(entry.final);
          else pending.reject(new Error('Owned Git worker exited without final counters'));
        }
        entry.pending.clear();
      });
    }
  };
  syncBuiltinESMExports();
  return () => Promise.all(entries.map((entry) => {
    if (entry.exited) return entry.final || Promise.reject(new Error('Owned Git counters are unavailable'));
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { entry.pending.delete(id); reject(new Error('Missing owned worker metrics')); }, 2000);
      entry.pending.set(id, { resolve, reject, timer });
      entry.worker.postMessage({ type: 'test-worker-metrics-request', id });
    });
  }));
};
