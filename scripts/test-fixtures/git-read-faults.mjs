import childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import { syncBuiltinESMExports } from "node:module";
import { promisify } from "node:util";

// Callback/close interception reaches both direct and worker Git reads.
export function installGitReadFaults({ matches, before, after }) {
  const original = childProcess.execFile;
  const run = promisify(original);
  function wrapped(command, args, options, callback) {
    if (typeof options === "function") { callback = options; options = {}; }
    if (!matches(command, args, options)) return original(command, args, options, callback);
    const facade = new EventEmitter();
    const context = { command, args, options, run };
    void (async () => {
      await before?.(context);
      const result = await new Promise((resolve, reject) => {
        let outcome;
        const child = original(command, args, options, (error, stdout, stderr) => { outcome = { error, stdout, stderr }; });
        child.once("close", () => outcome.error
          ? reject(Object.assign(outcome.error, { stdout: outcome.stdout, stderr: outcome.stderr })) : resolve(outcome));
      });
      await after?.({ ...context, ...result });
      return result;
    })().then((result) => {
      callback(null, result.stdout, result.stderr); facade.emit("close", 0);
    }, (error) => {
      callback(error, error.stdout || "", error.stderr || "");
      facade.emit("close", error.code ?? null);
    });
    return facade;
  }
  wrapped[promisify.custom] = (...args) => new Promise((resolve, reject) => {
    wrapped(...args, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr }));
  });
  childProcess.execFile = wrapped;
  syncBuiltinESMExports();
}
