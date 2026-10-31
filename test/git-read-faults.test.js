import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import { syncBuiltinESMExports } from "node:module";
import { installGitReadFaults } from "../scripts/test-fixtures/git-read-faults.mjs";

const original = childProcess.execFile;
afterEach(() => { childProcess.execFile = original; syncBuiltinESMExports(); });

for (const phase of ["success", "before", "after", "native"]) {
  test(`Git fault interceptor settles exactly once after ${phase}`, async () => {
    const reason = new Error("injected failure"), order = [];
    let started = 0, nativeClosed = false;
    childProcess.execFile = (_command, _args, _options, callback) => {
      started++;
      const child = new EventEmitter();
      setImmediate(() => {
        callback(phase === "native" ? reason : null, "output", "diagnostic");
        nativeClosed = true;
        child.emit("close", phase === "native" ? 1 : 0);
      });
      return child;
    };
    installGitReadFaults({ matches: () => true,
      before: () => { if (phase === "before") throw reason; },
      after: () => { assert.equal(nativeClosed, true); if (phase === "after") throw reason; },
    });
    let outcome;
    const child = childProcess.execFile("git", [], {}, (error, stdout, stderr) => {
      order.push("callback"); outcome = { error, stdout, stderr };
      assert.equal(nativeClosed, phase !== "before");
    });
    await new Promise((resolve) => child.on("close", () => { order.push("close"); resolve(); }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(order, ["callback", "close"]);
    assert.equal(started, phase === "before" ? 0 : 1);
    assert.equal(outcome.error, phase === "success" ? null : reason);
    if (phase === "native" || phase === "success") {
      assert.equal(outcome.stdout, "output"); assert.equal(outcome.stderr, "diagnostic");
    }
  });
}
