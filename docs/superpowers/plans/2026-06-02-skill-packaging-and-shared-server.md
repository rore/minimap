# Skill Packaging & Shared Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package both minimap modes (`minimap-spec-review`, `minimap-roadmap`) as fully self-contained skills bundling their own runtime, and make a single running server transparently serve roadmap requests for any number of repos plus all global spec sessions — with launchers that discover and reuse a running server instead of forking new ones.

**Architecture:** Three structural shifts:

1. **Discovery file at `$MINIMAP_HOME/server.json`.** The server writes `{pid, port, startedAt, version}` on listen and deletes it on shutdown. Both skills' `start-server.mjs` shims read it, hit `/health`, and exit early when a live server already serves the port. The file is a hint, never authoritative — `/health` validates. Concurrency: launchers do a one-shot probe-before-bind on the registered port and treat EADDRINUSE on the *first* port attempt as "another launcher beat me to it" (re-probe instead of falling forward).
2. **Repo-agnostic server.** Drop the module-scope `repoRoot = process.cwd()` / `repoName` in [server.js](package/minimap/server.js). Roadmap endpoints (`/api/workspace`, `/api/setup/initialize`, `/api/board`, `/api/scope`, `/api/items/:id`) take repo from the request `X-Minimap-Repo` header. Spec-session endpoints already use `MINIMAP_HOME` and are unchanged. `cwd` becomes a back-compat default only. (No `?repo=` query fallback — header-only is simpler and the UI controls all callers.)
3. **URL-driven repo selection in the UI.** The browser reads `repo` from the hash (`#repo=/abs/path&view=board`), keeps it in `state.repoPath`, and `fetchJson` adds the `X-Minimap-Repo` header on every roadmap call. The hash parser, builder, and apply-from-location *all* preserve `repo`, so navigation events (item click, mode change) don't drop it. No in-app switcher — switching repos means changing the URL. Spec sessions are unaffected because they're already global.

Build order ships value in two halves: half 1 (discovery + roadmap-skill packaging + port-doc fix) lands as an independent improvement that makes "two agents in one repo" stop forking servers, **but does not yet enable multi-repo** — half 1 docs say so explicitly. Half 2 (repo-agnostic refactor + UI repo state) lands the multi-repo capability and must land server + UI together to keep tests green. Each task ends with a commit so we can bisect and roll back.

**Tech Stack:** Node.js (ESM), `node:http`, `node:test`, Playwright. No new deps. Windows + bash shell. Existing test conventions: `node --test` for server/unit, `playwright test` for UI.

---

## File Structure

**New files:**
- `package/minimap/src/server-registry.js` — read/write/delete `$MINIMAP_HOME/server.json`, single responsibility.
- `package/minimap/skills/minimap-spec-review/scripts/health-check.mjs` — small helper used by `start-server.mjs` for the registry-then-`/health` probe. Re-exported via the runtime so both skills share it.
- `package/minimap/skills/minimap-roadmap/runtime/` — full mirror of `minimap-spec-review/runtime/` (server.js, cli.js, src/, ui/, package.json). Created by copy in Task 12; thereafter the two trees are kept in sync the same way `minimap-spec-review/runtime/` is today.
- `package/minimap/skills/minimap-roadmap/scripts/start-server.mjs` — one-line shim into bundled runtime.
- `package/minimap/skills/minimap-roadmap/scripts/minimap.mjs` — one-line shim into bundled CLI (parity with spec-review even though roadmap CLI is currently empty).
- `package/minimap/skills/minimap-roadmap/references/server.md` — server lifecycle docs for the roadmap skill.

**Modified files:**
- `package/minimap/server.js` — registry write/delete on listen/shutdown; drop module-scope `repoRoot`/`repoName`; resolve repo per-request for roadmap endpoints; remove `__REPO_NAME__` substitution.
- `package/minimap/skills/minimap-spec-review/scripts/start-server.mjs` — health-check-then-spawn (no longer one-line).
- `package/minimap/skills/minimap-spec-review/references/server.md` — fix `5812` → `4312`; document discovery; URL hash includes `repo=` for roadmap mode.
- `package/minimap/skills/minimap-roadmap/SKILL.md` — point at bundled runtime and discovery, document the `#repo=` URL.
- `package/minimap/ui/app.js` — read `repo` from URL hash, store in state, attach `X-Minimap-Repo` header in `fetchJson`. Drop reliance on `__REPO_NAME__` substitution (already secondary).
- `package/minimap/ui/index.html` — keep `<title>Minimap</title>` (no template var); JS sets repo name once workspace loads.
- `test/roadmap.test.js` — update server integration tests for the new repo-via-header contract; add tests for registry behavior and repo-agnostic serving.
- `playwright/roadmap-ui.spec.js` — pass `repo=...` in the URL hash so the UI knows what repo to ask about.
- `playwright.config.js` — `webServer.env` keeps `PORT`; nothing else changes structurally, but the playwright server now serves the project's own roadmap via header rather than cwd, so we keep cwd as the back-compat default.
- `AGENTS.md` — mention both skills bundle their own runtime; agents should rely on the bundled `start-server.mjs`.
- `package/minimap/CONTRACT.md`, `package/minimap/README.md` — short notes on multi-repo URL convention and discovery (kept terse — these docs are authoritative).

**Files renamed/synced:**
- The bundled runtime under `minimap-spec-review/runtime/` is currently a duplicate of top-level `package/minimap/{server.js, cli.js, src/, ui/}`. Today they're synced manually. After Task 12 there are three copies. We will not introduce a build step in this plan; the sync rule (per [AGENTS.md](AGENTS.md)) is restated, and Task 17 verifies all three trees match by `diff -r`.

---

## Half 1 — Discovery + Roadmap Skill Packaging (independent, ships first)

### Task 1: Server registry module

**Files:**
- Create: `package/minimap/src/server-registry.js`
- Test: `test/roadmap.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to [test/roadmap.test.js](test/roadmap.test.js):

```javascript
import {
  readServerRegistry,
  writeServerRegistry,
  deleteServerRegistry,
  registryPath,
} from "../package/minimap/src/server-registry.js";

test("server-registry: writeServerRegistry then readServerRegistry round-trips", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  await writeServerRegistry({ pid: 1234, port: 4312, startedAt: "2026-06-02T10:00:00Z", version: "0.1.0" }, { minimapHome: home });
  const value = await readServerRegistry({ minimapHome: home });
  assert.deepEqual(value, { pid: 1234, port: 4312, startedAt: "2026-06-02T10:00:00Z", version: "0.1.0" });
});

test("server-registry: readServerRegistry returns null when missing", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const value = await readServerRegistry({ minimapHome: home });
  assert.equal(value, null);
});

test("server-registry: deleteServerRegistry removes the file and is idempotent", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  await writeServerRegistry({ pid: 1, port: 4312, startedAt: "x", version: "y" }, { minimapHome: home });
  await deleteServerRegistry({ minimapHome: home });
  await deleteServerRegistry({ minimapHome: home }); // second call must not throw
  const value = await readServerRegistry({ minimapHome: home });
  assert.equal(value, null);
});

test("server-registry: readServerRegistry returns null on malformed JSON", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  await fs.mkdir(home, { recursive: true });
  await fs.writeFile(registryPath(home), "{ not json", "utf8");
  const value = await readServerRegistry({ minimapHome: home });
  assert.equal(value, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd c:/Dev/rore/minimap && npm test -- --test-name-pattern="server-registry"
```

Expected: All 4 tests FAIL with module-not-found.

- [ ] **Step 3: Implement `server-registry.js`**

Create `package/minimap/src/server-registry.js`:

```javascript
import fs from "node:fs/promises";
import path from "node:path";
import { resolveMinimapHome } from "./sessions.js";

const REGISTRY_FILE = "server.json";

export function registryPath(minimapHome) {
  return path.join(minimapHome, REGISTRY_FILE);
}

function resolveHome(options) {
  return options?.minimapHome || resolveMinimapHome(options?.env || process.env, options?.platform || process.platform);
}

export async function readServerRegistry(options = {}) {
  const home = resolveHome(options);
  try {
    const raw = await fs.readFile(registryPath(home), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

export async function writeServerRegistry(entry, options = {}) {
  const home = resolveHome(options);
  await fs.mkdir(home, { recursive: true });
  await fs.writeFile(registryPath(home), `${JSON.stringify(entry, null, 2)}\n`, "utf8");
}

export async function deleteServerRegistry(options = {}) {
  const home = resolveHome(options);
  try {
    await fs.unlink(registryPath(home));
  } catch (error) {
    if (error && error.code === "ENOENT") return;
    throw error;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd c:/Dev/rore/minimap && npm test -- --test-name-pattern="server-registry"
```

Expected: All 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add package/minimap/src/server-registry.js test/roadmap.test.js
git commit -m "feat(server): add server registry module for discovery"
```

---

### Task 2: Server writes & cleans up registry

**Files:**
- Modify: `package/minimap/server.js:448-458`
- Test: `test/roadmap.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to [test/roadmap.test.js](test/roadmap.test.js):

```javascript
test("server writes registry on start and removes it on SIGTERM", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const repoRoot = await makeTempRepo();
  const child = spawn(process.execPath, [path.join(projectRoot, "package", "minimap", "server.js")], {
    cwd: repoRoot,
    env: { ...process.env, PORT: "4413", MINIMAP_HOME: home },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server did not start.")), 5000);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("http://localhost:4413")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.on("exit", (code) => reject(new Error(`Server exited early with code ${code}.`)));
  });

  try {
    const registryRaw = await fs.readFile(path.join(home, "server.json"), "utf8");
    const registry = JSON.parse(registryRaw);
    assert.equal(registry.port, 4413);
    assert.equal(typeof registry.pid, "number");
    assert.match(registry.startedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(typeof registry.version, "string");
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.on("exit", resolve));
  }

  // After clean shutdown, registry should be gone.
  await assert.rejects(fs.readFile(path.join(home, "server.json"), "utf8"), { code: "ENOENT" });
});

test("server removes registry on SIGINT as well as SIGTERM", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const repoRoot = await makeTempRepo();
  const child = spawn(process.execPath, [path.join(projectRoot, "package", "minimap", "server.js")], {
    cwd: repoRoot,
    env: { ...process.env, PORT: "4424", MINIMAP_HOME: home },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server did not start.")), 5000);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("http://localhost:4424")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  child.kill("SIGINT");
  await new Promise((resolve) => child.on("exit", resolve));

  await assert.rejects(fs.readFile(path.join(home, "server.json"), "utf8"), { code: "ENOENT" });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd c:/Dev/rore/minimap && npm test -- --test-name-pattern="writes registry"
```

Expected: FAIL — registry file does not exist.

- [ ] **Step 3: Modify [server.js](package/minimap/server.js)**

Add the registry import near the other imports:

```javascript
import { writeServerRegistry, deleteServerRegistry } from "./src/server-registry.js";
```

Read version from `package.json` once at module load. Use the existing async `fs` import (style consistency):

```javascript
const packageJsonPath = path.join(__dirname, "package.json");
const serverVersion = JSON.parse(await fs.readFile(packageJsonPath, "utf8")).version || "0.0.0";
```

(This requires top-level await, which works because `server.js` is already an ESM module — `package.json` declares `"type": "module"` and the `import` syntax confirms it. Place this read after the import block, before the listener creation.)

Replace the bottom `listenOnAvailablePort(...).then(...)` block (currently [server.js:450-458](package/minimap/server.js#L450)) with:

```javascript
listenOnAvailablePort(server, requestedPort)
  .then(async (boundPort) => {
    const fallbackNote = boundPort === requestedPort ? "" : ` (requested ${requestedPort})`;
    await writeServerRegistry({
      pid: process.pid,
      port: boundPort,
      startedAt: new Date().toISOString(),
      version: serverVersion,
    });
    process.stdout.write(`Minimap running at http://localhost:${boundPort}${fallbackNote}\n`);
  })
  .catch(async (error) => {
    try { await deleteServerRegistry(); } catch {}
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });

async function shutdown(signal) {
  try {
    await deleteServerRegistry();
  } catch (error) {
    process.stderr.write(`Registry cleanup failed: ${error.message}\n`);
  }
  process.exit(signal === "SIGINT" ? 130 : 0);
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
```

(Task 4 will further extend this block with the `MINIMAP_NO_PORT_FALLBACK` race-safety hook. For now, Task 2's version is correct standalone.)

- [ ] **Step 4: Run test to verify it passes**

```bash
cd c:/Dev/rore/minimap && npm test -- --test-name-pattern="writes registry"
```

Expected: PASS.

- [ ] **Step 5: Run full unit test suite to confirm nothing else regressed**

```bash
cd c:/Dev/rore/minimap && npm test
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add package/minimap/server.js test/roadmap.test.js
git commit -m "feat(server): write server registry on listen, delete on shutdown"
```

---

### Task 3: Sync registry module into bundled runtime

**Files:**
- Create: `package/minimap/skills/minimap-spec-review/runtime/src/server-registry.js`

The bundled launcher (Task 4) imports `../runtime/src/server-registry.js`. That file must exist before the launcher can be tested — that's why this task comes before Task 4.

- [ ] **Step 1: Copy file into bundled runtime**

```bash
cp c:/Dev/rore/minimap/package/minimap/src/server-registry.js \
   c:/Dev/rore/minimap/package/minimap/skills/minimap-spec-review/runtime/src/server-registry.js
```

- [ ] **Step 2: Verify the copy is identical**

```bash
diff -q c:/Dev/rore/minimap/package/minimap/src/server-registry.js \
        c:/Dev/rore/minimap/package/minimap/skills/minimap-spec-review/runtime/src/server-registry.js
```

Expected: no output (identical).

- [ ] **Step 3: Commit**

```bash
git add package/minimap/skills/minimap-spec-review/runtime/src/server-registry.js
git commit -m "chore(runtime): sync server-registry into bundled spec-review runtime"
```

---

### Task 4: Smart launcher — health-check before binding, with race-safe EADDRINUSE handling

**Files:**
- Create: `package/minimap/skills/minimap-spec-review/scripts/health-check.mjs`
- Modify: `package/minimap/skills/minimap-spec-review/scripts/start-server.mjs`
- Test: `test/roadmap.test.js` (append)

- [ ] **Step 1: Read the existing one-line shim to confirm starting state**

```bash
cat c:/Dev/rore/minimap/package/minimap/skills/minimap-spec-review/scripts/start-server.mjs
```

Expected output:
```
#!/usr/bin/env node
import "../runtime/server.js";
```

- [ ] **Step 2: Write the failing tests**

Append to [test/roadmap.test.js](test/roadmap.test.js):

```javascript
test("start-server.mjs reuses a running server instead of spawning a second one", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const repoRoot = await makeTempRepo();

  // Spawn first server.
  const first = spawn(process.execPath, [path.join(projectRoot, "package", "minimap", "server.js")], {
    cwd: repoRoot,
    env: { ...process.env, PORT: "4414", MINIMAP_HOME: home },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("First server did not start.")), 5000);
    first.stdout.on("data", (chunk) => {
      if (String(chunk).includes("http://localhost:4414")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  try {
    const launcherPath = path.join(
      projectRoot,
      "package", "minimap", "skills", "minimap-spec-review", "scripts", "start-server.mjs",
    );
    const second = spawn(process.execPath, [launcherPath], {
      cwd: repoRoot,
      env: { ...process.env, MINIMAP_HOME: home },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    second.stdout.on("data", (chunk) => { stdout += String(chunk); });
    const exitCode = await new Promise((resolve) => second.on("exit", resolve));
    assert.equal(exitCode, 0, "launcher must exit cleanly when reusing");
    assert.match(stdout, /already running/i);
    assert.match(stdout, /4414/);
  } finally {
    first.kill("SIGTERM");
    await new Promise((resolve) => first.on("exit", resolve));
  }
});

test("two launchers racing for the same port: only one server ends up running", async () => {
  // Race: both launchers see no registry, both try to bind. The loser's
  // EADDRINUSE on the first attempt must NOT fall forward to a different port —
  // it must re-probe the registry, find the winner, and exit cleanly.
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const repoRoot = await makeTempRepo();
  const launcherPath = path.join(
    projectRoot,
    "package", "minimap", "skills", "minimap-spec-review", "scripts", "start-server.mjs",
  );

  const sharedEnv = { ...process.env, PORT: "4422", MINIMAP_HOME: home };
  const a = spawn(process.execPath, [launcherPath], {
    cwd: repoRoot,
    env: sharedEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const b = spawn(process.execPath, [launcherPath], {
    cwd: repoRoot,
    env: sharedEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const collect = (child) => new Promise((resolve) => {
    let out = "";
    child.stdout.on("data", (chunk) => { out += String(chunk); });
    child.on("exit", (code) => resolve({ code, out }));
  });

  // Whoever ends up serving stays running; whoever loses must exit cleanly.
  // Give them up to 3s before we forcibly kill both.
  const timeout = setTimeout(() => { a.kill("SIGTERM"); b.kill("SIGTERM"); }, 3000);

  // One of them may run forever (the winner). Wait until at least one exits or 3s elapses.
  const finishedFirst = await Promise.race([
    collect(a).then((r) => ({ winner: "a-exited-first", r })),
    collect(b).then((r) => ({ winner: "b-exited-first", r })),
  ]);
  clearTimeout(timeout);
  // Kill whichever is still running.
  a.kill("SIGTERM");
  b.kill("SIGTERM");
  await new Promise((resolve) => a.on("exit", resolve));
  await new Promise((resolve) => b.on("exit", resolve));

  // The earlier-exiting process must NOT have written a "Minimap running on 4423"
  // line — it must have either been the winner that got killed by SIGTERM (no exit yet
  // when timeout fires; we forced kill), or the loser which printed "already running".
  // What we actively guard against: a "Minimap running at http://localhost:4423" line
  // anywhere, which would prove the fall-forward bug.
  assert.doesNotMatch(finishedFirst.r.out, /4423/, "must not fall forward to 4423");
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd c:/Dev/rore/minimap && npm test -- --test-name-pattern="reuses a running server|two launchers racing"
```

Expected: BOTH tests FAIL — second launcher spawns a real server (or fails) instead of exiting with "already running"; race test produces a 4423 server (fall-forward bug).

- [ ] **Step 4: Create [health-check.mjs](package/minimap/skills/minimap-spec-review/scripts/health-check.mjs)**

```javascript
import { readServerRegistry } from "../runtime/src/server-registry.js";

const HEALTH_TIMEOUT_MS = 1500;

export async function probeRunningServer(options = {}) {
  const entry = await readServerRegistry(options);
  if (!entry || typeof entry.port !== "number") return null;
  return await probePort(entry.port, entry);
}

export async function probePort(port, entry = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`http://localhost:${port}/health`, { signal: controller.signal });
    if (!response.ok) return null;
    const payload = await response.json();
    if (payload && payload.ok === true) return entry || { port };
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 5: Replace [start-server.mjs](package/minimap/skills/minimap-spec-review/scripts/start-server.mjs)**

The launcher must:
1. Probe the registry. If a healthy minimap is there, exit cleanly.
2. Otherwise, attempt to bind the requested port via the bundled server. If the bundled server gets EADDRINUSE on the *first* port (race with another launcher), exit and re-probe instead of letting it fall forward.

```javascript
#!/usr/bin/env node
import { probeRunningServer, probePort } from "./health-check.mjs";

const requestedPort = Number(process.env.PORT || 4312);

const existing = await probeRunningServer();
if (existing) {
  process.stdout.write(`Minimap already running at http://localhost:${existing.port} (pid ${existing.pid ?? "?"})\n`);
  process.exit(0);
}

// Tell the bundled server: do NOT fall forward on EADDRINUSE for the first port.
// If we lose the race against another launcher, we'll re-probe and exit cleanly.
process.env.MINIMAP_NO_PORT_FALLBACK = "1";

try {
  await import("../runtime/server.js");
} catch (error) {
  if (error && error.code === "EADDRINUSE") {
    // Another launcher beat us. Re-probe directly on the requested port.
    const winner = await probePort(requestedPort);
    if (winner) {
      process.stdout.write(`Minimap already running at http://localhost:${requestedPort}\n`);
      process.exit(0);
    }
    process.stderr.write(`Port ${requestedPort} is in use by a non-minimap process.\n`);
    process.exit(1);
  }
  throw error;
}
```

- [ ] **Step 6: Make the bundled server respect `MINIMAP_NO_PORT_FALLBACK`**

In [server.js](package/minimap/server.js), modify the `listenOnAvailablePort` call site to skip fallback when the env var is set. Change the bottom block:

```javascript
const noFallback = process.env.MINIMAP_NO_PORT_FALLBACK === "1";
const portStrategy = noFallback ? listenOnce : listenOnAvailablePort;

portStrategy(server, requestedPort)
  .then(async (boundPort) => {
    // listenOnce returns undefined on success; treat it as boundPort = requestedPort.
    const actualPort = typeof boundPort === "number" ? boundPort : requestedPort;
    const fallbackNote = actualPort === requestedPort ? "" : ` (requested ${requestedPort})`;
    await writeServerRegistry({
      pid: process.pid,
      port: actualPort,
      startedAt: new Date().toISOString(),
      version: serverVersion,
    });
    process.stdout.write(`Minimap running at http://localhost:${actualPort}${fallbackNote}\n`);
  })
  .catch(async (error) => {
    if (error && error.code === "EADDRINUSE" && noFallback) {
      // The launcher will re-probe.
      process.exitCode = 1;
      throw error;
    }
    try { await deleteServerRegistry(); } catch {}
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
```

(Also re-syncs the failed-startup registry cleanup mentioned in Finding 7.3.)

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd c:/Dev/rore/minimap && npm test -- --test-name-pattern="reuses a running server|two launchers racing"
```

Expected: BOTH PASS.

- [ ] **Step 8: Run full suite**

```bash
cd c:/Dev/rore/minimap && npm test
```

Expected: All PASS.

- [ ] **Step 9: Commit**

```bash
git add package/minimap/skills/minimap-spec-review/scripts/health-check.mjs \
        package/minimap/skills/minimap-spec-review/scripts/start-server.mjs \
        package/minimap/server.js \
        test/roadmap.test.js
git commit -m "feat(skill): launcher reuses running minimap and re-probes on race"
```

---

### Task 5: Sync server.js + dependencies into bundled spec-review runtime

**Files:**
- Modify: `package/minimap/skills/minimap-spec-review/runtime/server.js`

The bundled runtime ships its own `server.js`. After Task 2, top-level `server.js` writes/cleans the registry; the bundle must match.

- [ ] **Step 1: Sync the bundled server**

```bash
cp c:/Dev/rore/minimap/package/minimap/server.js \
   c:/Dev/rore/minimap/package/minimap/skills/minimap-spec-review/runtime/server.js
```

- [ ] **Step 2: Verify the diff is empty**

```bash
diff -q c:/Dev/rore/minimap/package/minimap/server.js \
        c:/Dev/rore/minimap/package/minimap/skills/minimap-spec-review/runtime/server.js
```

Expected: no output.

- [ ] **Step 3: Smoke-test the bundled launcher end-to-end**

```bash
cd c:/Dev/rore/minimap && \
  MINIMAP_HOME=$(mktemp -d) PORT=4415 \
  node package/minimap/skills/minimap-spec-review/scripts/start-server.mjs &
sleep 1
curl -s http://localhost:4415/health
# expect: {"ok":true}
# Then run the launcher again from another shell against the same MINIMAP_HOME — it should print "already running".
```

(Manual smoke test — not automated. The reuse case is already covered by Task 3's test.)

- [ ] **Step 4: Commit**

```bash
git add package/minimap/skills/minimap-spec-review/runtime/server.js
git commit -m "chore(runtime): sync server.js into bundled spec-review runtime"
```

---

### Task 6: Fix the port docs in spec-review SKILL references

**Files:**
- Modify: `package/minimap/skills/minimap-spec-review/references/server.md`

- [ ] **Step 1: Read the file to confirm wrong port**

```bash
grep -n "5812\|4312" c:/Dev/rore/minimap/package/minimap/skills/minimap-spec-review/references/server.md
```

Expected: `5812` appears on lines 39 and 55 — both wrong.

- [ ] **Step 2: Replace `5812` with `4312` in [references/server.md](package/minimap/skills/minimap-spec-review/references/server.md)**

Change line 39 `curl http://localhost:5812/health` → `curl http://localhost:4312/health`.

Change line 55 `http://localhost:5812/#view=spec&file=path/to/spec.md` → `http://localhost:4312/#view=spec&file=path/to/spec.md`.

Also append a short Discovery section after "Verify Server":

```markdown
## Discovery

The bundled `start-server.mjs` first checks `$MINIMAP_HOME/server.json` and probes `/health` on the listed port. If a minimap server is already running, the launcher exits without spawning a second one. The running server transparently serves spec sessions and any roadmap that requests it (see the `#repo=` URL convention).
```

- [ ] **Step 3: Verify**

```bash
grep -n "5812" c:/Dev/rore/minimap/package/minimap/skills/minimap-spec-review/references/server.md
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add package/minimap/skills/minimap-spec-review/references/server.md
git commit -m "docs(skill): fix port (5812 → 4312) and document discovery"
```

---

### Task 7: Package minimap-roadmap skill — copy runtime + scripts

**Files:**
- Create: `package/minimap/skills/minimap-roadmap/runtime/` (mirror tree)
- Create: `package/minimap/skills/minimap-roadmap/scripts/start-server.mjs`
- Create: `package/minimap/skills/minimap-roadmap/scripts/minimap.mjs`
- Create: `package/minimap/skills/minimap-roadmap/scripts/health-check.mjs`

- [ ] **Step 1: Copy the runtime tree**

```bash
cd c:/Dev/rore/minimap
cp -R package/minimap/skills/minimap-spec-review/runtime \
      package/minimap/skills/minimap-roadmap/runtime
mkdir -p package/minimap/skills/minimap-roadmap/scripts
cp package/minimap/skills/minimap-spec-review/scripts/start-server.mjs \
   package/minimap/skills/minimap-roadmap/scripts/start-server.mjs
cp package/minimap/skills/minimap-spec-review/scripts/minimap.mjs \
   package/minimap/skills/minimap-roadmap/scripts/minimap.mjs
cp package/minimap/skills/minimap-spec-review/scripts/health-check.mjs \
   package/minimap/skills/minimap-roadmap/scripts/health-check.mjs
```

- [ ] **Step 2: Verify the trees are identical**

```bash
diff -r package/minimap/skills/minimap-spec-review/runtime \
        package/minimap/skills/minimap-roadmap/runtime
diff -r package/minimap/skills/minimap-spec-review/scripts \
        package/minimap/skills/minimap-roadmap/scripts
```

Expected: no output (fully identical).

- [ ] **Step 3: Smoke-test the roadmap launcher reuses the spec-review server**

```bash
cd c:/Dev/rore/minimap
MINIMAP_HOME=$(mktemp -d) PORT=4416 \
  node package/minimap/skills/minimap-spec-review/scripts/start-server.mjs &
sleep 1
MINIMAP_HOME=$MINIMAP_HOME \
  node package/minimap/skills/minimap-roadmap/scripts/start-server.mjs
# expect: "Minimap already running at http://localhost:4416 ..."
kill %1
wait
```

(Manual smoke. Will be covered by an automated test in Task 9 once the SKILL.md is updated.)

- [ ] **Step 4: Commit**

```bash
git add package/minimap/skills/minimap-roadmap/runtime \
        package/minimap/skills/minimap-roadmap/scripts
git commit -m "feat(skill): bundle self-contained runtime for minimap-roadmap"
```

---

### Task 8: Update minimap-roadmap SKILL.md to reference its bundled runtime

**Files:**
- Modify: `package/minimap/skills/minimap-roadmap/SKILL.md`
- Create: `package/minimap/skills/minimap-roadmap/references/server.md`

**Important:** Half 1 ships the bundled runtime + launcher discovery, but the server is still cwd-rooted. Multi-repo URL hash routing only works after Half 2 (Tasks 11–14). The SKILL.md content below reflects that — it documents the bundled launcher and discovery, but does **not** advertise multi-repo. Task 16 (in Half 2) is where the multi-repo URL convention gets advertised.

- [ ] **Step 1: Replace [skills/minimap-roadmap/SKILL.md](package/minimap/skills/minimap-roadmap/SKILL.md)**

Full new content:

```markdown
---
name: minimap-roadmap
description: Use when reading, updating, or reorganizing roadmap state in a repo that hosts or uses the minimap roadmap file convention. Apply for roadmap planning and status changes; do not use for arbitrary spec review unless the user is using minimap-spec-review.
---

# Minimap Roadmap

## Intent

Use minimap roadmap files as the canonical source of roadmap and feature-planning truth for a repo.

The UI is only a lens over those files. Agents and humans must operate on the same file state.

## Quick Workflow

1. Find the roadmap root from `roadmap.config.json`, or use `roadmap/` when no config exists.
2. Start or verify the bundled server (run from inside the repo whose roadmap you want to view):
   `node <path-to-this-skill>/scripts/start-server.mjs`
3. Open the UI: `http://localhost:4312/`
4. Read the files that own the requested truth before editing.
5. Edit the smallest owning file set.
6. Preserve unknown metadata and sections.
7. Run the repo's normal validation if behavior or generated roadmap output could be affected.

The launcher detects an already-running minimap and reuses it instead of forking a second one. The current server serves whichever repo it was started from.

## Load More When Needed

- For server lifecycle and discovery, read [references/server.md](references/server.md).
- For ownership rules, item structure, board rules, and edit constraints, read [references/roadmap-contract.md](references/roadmap-contract.md).
- When using this skill from the packaged minimap folder, `../../CONTRACT.md` contains the package-level product boundary.

## Guardrails

- Do not create parallel roadmap trackers.
- Do not treat chat as the source of truth when roadmap files exist.
- Do not use this skill for global arbitrary-file review; use `minimap-spec-review` for that.
- Start the server from the repo whose roadmap you want to view.
```

- [ ] **Step 2: Create [skills/minimap-roadmap/references/server.md](package/minimap/skills/minimap-roadmap/references/server.md)**

```markdown
# Server Lifecycle

The skill is self-contained and bundles its own minimap runtime in `runtime/` plus launchers in `scripts/`.

## Start Server

```sh
node <path-to-this-skill>/scripts/start-server.mjs
```

The launcher reads `$MINIMAP_HOME/server.json`, probes `/health`, and exits early if a minimap server is already running on the listed port. Otherwise it starts one. Both `minimap-roadmap` and `minimap-spec-review` use the same registry, so a single running server serves both modes.

The currently-running server serves the roadmap of whichever repo it was started from. Start the server from inside the repo whose roadmap you want to view.

## Verify Server

```sh
curl http://localhost:4312/health
```

Expected:

```json
{"ok":true}
```

If port 4312 is busy, the server falls forward to the next free port. The actual bound port is recorded in `$MINIMAP_HOME/server.json`.

## UI URL

```text
http://localhost:4312/
```
```

(Task 16 in Half 2 will replace these docs with the multi-repo URL convention `#repo=...`. Until then this skill works correctly only for the repo the server was started from.)

- [ ] **Step 3: Commit**

```bash
git add package/minimap/skills/minimap-roadmap/SKILL.md \
        package/minimap/skills/minimap-roadmap/references/server.md
git commit -m "docs(skill): minimap-roadmap references its bundled runtime"
```

---

### Task 9: Test that the two skills' launchers share one server

**Files:**
- Modify: `test/roadmap.test.js` (append)

- [ ] **Step 1: Add the test**

```javascript
test("roadmap and spec-review launchers share a single running server via $MINIMAP_HOME", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const repoRoot = await makeTempRepo();

  const specLauncher = path.join(projectRoot, "package", "minimap", "skills", "minimap-spec-review", "scripts", "start-server.mjs");
  const roadmapLauncher = path.join(projectRoot, "package", "minimap", "skills", "minimap-roadmap", "scripts", "start-server.mjs");

  // First launcher starts the server.
  const first = spawn(process.execPath, [specLauncher], {
    cwd: repoRoot,
    env: { ...process.env, PORT: "4417", MINIMAP_HOME: home },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("First launcher did not start server.")), 5000);
    first.stdout.on("data", (chunk) => {
      if (String(chunk).includes("http://localhost:4417")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  try {
    // Second launcher (different skill) reuses it.
    const second = spawn(process.execPath, [roadmapLauncher], {
      cwd: repoRoot,
      env: { ...process.env, MINIMAP_HOME: home },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    second.stdout.on("data", (chunk) => { stdout += String(chunk); });
    const exitCode = await new Promise((resolve) => second.on("exit", resolve));
    assert.equal(exitCode, 0);
    assert.match(stdout, /already running/i);
    assert.match(stdout, /4417/);
  } finally {
    first.kill("SIGTERM");
    await new Promise((resolve) => first.on("exit", resolve));
  }
});
```

- [ ] **Step 2: Run the test**

```bash
cd c:/Dev/rore/minimap && npm test -- --test-name-pattern="share a single running server"
```

Expected: PASS.

- [ ] **Step 3: Run the full suite**

```bash
cd c:/Dev/rore/minimap && npm test
```

Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add test/roadmap.test.js
git commit -m "test(skill): two skills share one running server"
```

---

### Task 10: Update AGENTS.md to mention bundled-runtime convention

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Replace [AGENTS.md](AGENTS.md) lines 1-9 with**

```markdown
# AGENTS.md

This repo dogfoods the packaged minimap app. Minimap exposes two capabilities, each shipped as a self-contained skill with its own bundled runtime and `scripts/start-server.mjs` launcher:

- For roadmap planning and roadmap file updates in this repo, follow [`package/minimap/skills/minimap-roadmap/SKILL.md`](package/minimap/skills/minimap-roadmap/SKILL.md). Treat the roadmap files as canonical and keep behavior aligned with the minimap roadmap contract in [`package/minimap/CONTRACT.md`](package/minimap/CONTRACT.md).
- For spec/design review on a specific file, follow [`package/minimap/skills/minimap-spec-review/SKILL.md`](package/minimap/skills/minimap-spec-review/SKILL.md). The skill works from any repo.

A single running minimap server transparently serves both modes for any number of repos. The bundled launchers detect an already-running instance via `$MINIMAP_HOME/server.json` + `/health` and reuse it.

When changing server, CLI, API, or UI behavior, also update **both** packaged skills' bundled runtimes in [`package/minimap/skills/minimap-spec-review/`](package/minimap/skills/minimap-spec-review/) and [`package/minimap/skills/minimap-roadmap/`](package/minimap/skills/minimap-roadmap/). The three trees (top-level + two skills) must stay in sync; verify with `diff -r` before committing.
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: AGENTS.md mentions bundled-runtime + tri-tree sync rule"
```

---

## Half 2 — Repo-Agnostic Server + URL-Driven UI

### Task 11: Server resolves repo per-request (back-compat-only on cwd default)

**Files:**
- Modify: `package/minimap/server.js`
- Modify: `test/roadmap.test.js`

**WARNING:** Tasks 11–14 modify only the top-level `package/minimap/{server.js, ui/}` — the bundled runtimes under `skills/*/runtime/` are still on the OLD code until Task 15 re-syncs. Between Task 11 and Task 15, **do not invoke the skill launchers** (`scripts/start-server.mjs`) — they spawn the bundled `runtime/server.js` which still ignores `X-Minimap-Repo`. All tests in Tasks 11–14 use either `package/minimap/server.js` directly (unit tests) or playwright (`webServer` config also points at the top-level server). If you need to manually test the launcher, finish Task 15 first.

The roadmap endpoints have **six** call sites (counting GET and POST `/api/items/:id` separately): `/api/workspace`, `/api/setup/initialize`, `/api/board`, `/api/scope`, `/api/items/:id` GET, `/api/items/:id` POST. All six must be refactored to resolve the repo per-request via the `X-Minimap-Repo` header. No `?repo=` query fallback — header-only is simpler and the UI is the only caller; tests use `fetch` with explicit headers.

- [ ] **Step 1: Write the failing tests**

Add a helper near the top of [test/roadmap.test.js](test/roadmap.test.js) (before the existing server tests):

```javascript
async function startServerOnPort(port, options = {}) {
  const child = spawn(process.execPath, [path.join(projectRoot, "package", "minimap", "server.js")], {
    cwd: options.cwd || projectRoot,
    env: { ...process.env, PORT: String(port), ...(options.env || {}) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server did not start.")), 5000);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes(`http://localhost:${port}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr.on("data", (chunk) => reject(new Error(String(chunk))));
    child.on("exit", (code) => reject(new Error(`Server exited with ${code}.`)));
  });
  return child;
}

async function stopServer(child) {
  child.kill("SIGTERM");
  await new Promise((resolve) => child.on("exit", resolve));
}
```

Append:

```javascript
test("server serves roadmap for the repo named by X-Minimap-Repo header", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const repoA = await makeTempRepo();
  const repoB = await makeTempRepo();
  await fs.writeFile(path.join(repoB, "roadmap", "scope.md"), "Repo B focus.\n", "utf8");

  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-cwd-"));
  const child = await startServerOnPort(4418, { cwd, env: { MINIMAP_HOME: home } });

  try {
    const respA = await fetch("http://localhost:4418/api/workspace", {
      headers: { "X-Minimap-Repo": repoA },
    });
    const wsA = await respA.json();
    assert.equal(wsA.repoName, path.basename(repoA));
    assert.equal(wsA.scopeText.trim(), "Current focus.");

    const respB = await fetch("http://localhost:4418/api/workspace", {
      headers: { "X-Minimap-Repo": repoB },
    });
    const wsB = await respB.json();
    assert.equal(wsB.repoName, path.basename(repoB));
    assert.equal(wsB.scopeText.trim(), "Repo B focus.");
  } finally {
    await stopServer(child);
  }
});

test("server serves two repos concurrently without cross-contamination", async () => {
  // Catches any per-process module-scope state in loadWorkspace that would leak
  // between simultaneous requests.
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const repoA = await makeTempRepo();
  const repoB = await makeTempRepo();
  await fs.writeFile(path.join(repoB, "roadmap", "scope.md"), "Repo B concurrent.\n", "utf8");

  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-cwd-"));
  const child = await startServerOnPort(4427, { cwd, env: { MINIMAP_HOME: home } });

  try {
    // Fire 8 interleaved requests at once.
    const targets = [];
    for (let i = 0; i < 4; i += 1) {
      targets.push({ repo: repoA, expectedScope: "Current focus." });
      targets.push({ repo: repoB, expectedScope: "Repo B concurrent." });
    }
    const results = await Promise.all(targets.map((t) =>
      fetch("http://localhost:4427/api/workspace", { headers: { "X-Minimap-Repo": t.repo } })
        .then((r) => r.json())
        .then((ws) => ({ ws, expected: t.expectedScope, repo: t.repo })),
    ));
    for (const { ws, expected, repo } of results) {
      assert.equal(ws.repoName, path.basename(repo), `repoName must match ${repo}`);
      assert.equal(ws.scopeText.trim(), expected, `scope must match ${repo}`);
    }
  } finally {
    await stopServer(child);
  }
});

test("server falls back to cwd when no X-Minimap-Repo header is present", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const repoRoot = await makeTempRepo();
  const child = await startServerOnPort(4419, { cwd: repoRoot, env: { MINIMAP_HOME: home } });

  try {
    const resp = await fetch("http://localhost:4419/api/workspace");
    const ws = await resp.json();
    assert.equal(ws.repoName, path.basename(repoRoot));
  } finally {
    await stopServer(child);
  }
});

test("server rejects X-Minimap-Repo pointing at a non-existent path", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-home-"));
  const child = await startServerOnPort(4421, { env: { MINIMAP_HOME: home } });

  try {
    const resp = await fetch("http://localhost:4421/api/workspace", {
      headers: { "X-Minimap-Repo": "/definitely/not/a/real/path/zzz" },
    });
    assert.equal(resp.status, 400);
    const body = await resp.json();
    assert.equal(body.error.code, "bad_request");
  } finally {
    await stopServer(child);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd c:/Dev/rore/minimap && npm test -- --test-name-pattern="X-Minimap-Repo|concurrently without cross-contamination|cwd when no X-Minimap-Repo|non-existent path"
```

Expected: tests fail because all six roadmap endpoints currently use the module-scope `repoRoot`.

- [ ] **Step 3: Refactor [server.js](package/minimap/server.js)**

Remove these module-scope lines:

```javascript
const repoRoot = process.cwd();
const repoName = path.basename(path.resolve(repoRoot));
```

Replace with a fallback constant:

```javascript
const cwdFallback = process.cwd();
```

Add a helper at module scope (after `requireQueryParam`):

```javascript
async function resolveRoadmapRepo(request) {
  const headerRepo = request.headers["x-minimap-repo"];
  const candidate = (typeof headerRepo === "string" && headerRepo.trim()) || cwdFallback;
  const resolved = path.resolve(candidate);
  try {
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) {
      throw new AppError(`Repo path is not a directory: ${resolved}`, 400, "bad_request");
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error && error.code === "ENOENT") {
      throw new AppError(`Repo path does not exist: ${resolved}`, 400, "bad_request");
    }
    throw error;
  }
  return resolved;
}
```

Replace each roadmap endpoint's use of `repoRoot` with a per-request resolved path. The six sites are at [server.js:288, 293, 300, 307, 322, 328](package/minimap/server.js). Concrete edits:

```javascript
// /api/workspace
if (request.method === "GET" && pathname === "/api/workspace") {
  const repoRoot = await resolveRoadmapRepo(request);
  const workspace = await loadWorkspace(repoRoot);
  sendJson(response, 200, workspace);
  return true;
}

// /api/setup/initialize
if (request.method === "POST" && pathname === "/api/setup/initialize") {
  const repoRoot = await resolveRoadmapRepo(request);
  const workspace = await initializeWorkspace(repoRoot);
  sendJson(response, 200, workspace);
  return true;
}

// /api/board
if (request.method === "POST" && pathname === "/api/board") {
  const repoRoot = await resolveRoadmapRepo(request);
  const rawBody = await readRequestBody(request);
  const body = parseJsonBody(rawBody);
  const workspace = await saveBoardByGroups(repoRoot, body.groups);
  sendJson(response, 200, workspace);
  return true;
}

// /api/scope
if (request.method === "POST" && pathname === "/api/scope") {
  const repoRoot = await resolveRoadmapRepo(request);
  const rawBody = await readRequestBody(request);
  const body = parseJsonBody(rawBody);

  if (typeof body.scopeText !== "string") {
    throw new AppError("Scope update must provide scopeText.", 400, "bad_request");
  }

  const workspace = await saveScopeText(repoRoot, body.scopeText);
  sendJson(response, 200, workspace);
  return true;
}

// /api/items/:id (GET)
if (itemMatch && request.method === "GET") {
  const repoRoot = await resolveRoadmapRepo(request);
  const item = await readItemById(repoRoot, decodeURIComponent(itemMatch[1]));
  sendJson(response, 200, item);
  return true;
}

// /api/items/:id (POST)
if (itemMatch && request.method === "POST") {
  const repoRoot = await resolveRoadmapRepo(request);
  const id = decodeURIComponent(itemMatch[1]);
  const rawBody = await readRequestBody(request);
  const body = parseJsonBody(rawBody);

  if (body.id && body.id !== id) {
    throw new AppError("Item id in request body must match the URL.", 400, "bad_request");
  }

  const item = await saveItemById(repoRoot, id, body);
  sendJson(response, 200, item);
  return true;
}
```

Spec-session endpoints continue using `cwdFallback` because attach/move/comment/suggestion paths can be relative; that behavior is unchanged. Replace the existing `cwd: repoRoot` arguments in spec-session sites with `cwd: cwdFallback` (the spec-session caller is responsible for ensuring cwd matches the file's repo, or for using absolute paths).

Also drop the `__REPO_NAME__` substitution. Replace the `if (extension === ".html")` block in [server.js:383-387](package/minimap/server.js#L383) with:

```javascript
// Static HTML is served as-is. Repo name is fetched client-side from /api/workspace.
sendText(response, 200, file, contentType);
return;
```

Also remove the now-unused `escapeHtml` function and its caller-removal — the function is only used by the substitution site. Delete the function definition at [server.js:49-56](package/minimap/server.js#L49) if there are no other callers (verify with `grep`).

- [ ] **Step 4: Run the new tests**

```bash
cd c:/Dev/rore/minimap && npm test -- --test-name-pattern="X-Minimap-Repo|concurrently without cross-contamination|cwd when no X-Minimap-Repo|non-existent path"
```

Expected: PASS.

- [ ] **Step 5: Run the existing server-endpoints test (which still uses cwd)**

```bash
cd c:/Dev/rore/minimap && npm test -- --test-name-pattern="server endpoints return workspace"
```

Expected: PASS — the cwd-fallback path keeps that test green.

- [ ] **Step 6: Run full suite**

```bash
cd c:/Dev/rore/minimap && npm test
```

Expected: All PASS. The spec-session test (`server exposes global spec-session attach...`) and the port-fallback test continue to pass unchanged.

- [ ] **Step 7: Commit**

```bash
git add package/minimap/server.js test/roadmap.test.js
git commit -m "feat(server): resolve roadmap repo per-request via X-Minimap-Repo"
```

---

### Task 12: Index.html no longer relies on __REPO_NAME__

**Files:**
- Modify: `package/minimap/ui/index.html`

The current substitution pre-fills the title at HTML parse time. After removal, the title shows just `"Minimap — Roadmap"` until `/api/workspace` resolves. Task 13 mitigates this by deriving an initial repo-name from the `repo` URL hash (basename), which closes the visible gap to the duration of the first paint, not the whole network round-trip.

- [ ] **Step 1: Replace the title and h1 in [index.html](package/minimap/ui/index.html)**

Line 6:

```html
<title>Minimap</title>
```

Line 15:

```html
<h1><span id="repo-name"></span> <span id="mode-title">Roadmap</span></h1>
```

(Empty `repo-name` span; Task 13 fills it from the URL hash basename pre-fetch, then `/api/workspace` overwrites with the real name.)

- [ ] **Step 2: Confirm page still loads (Playwright tests will run after Task 13/14 fixes)**

```bash
cd c:/Dev/rore/minimap && node -e "
  const fs = require('node:fs');
  const html = fs.readFileSync('package/minimap/ui/index.html', 'utf8');
  if (html.includes('__REPO_NAME__')) { console.error('still has __REPO_NAME__'); process.exit(1); }
  console.log('ok');
"
```

Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add package/minimap/ui/index.html
git commit -m "refactor(ui): drop __REPO_NAME__ template var; JS sets repo name"
```

---

### Task 13: UI reads `repo` from URL hash and sends `X-Minimap-Repo` on roadmap calls

**Files:**
- Modify: `package/minimap/ui/app.js`

This task touches **five** sites in `app.js`. The architect's concern: any one of them missing causes a silent regression (item-click drops `repo=` from the hash → next fetch goes to cwd → wrong repo silently shown). Implement all five together.

**Sites and what each does:**

1. **`state` initialization** — add `state.repoPath = ""` so it's a known field.
2. **`readRouteState()` (app.js:1242-1255)** — extract `repo` from the hash and return it.
3. **`buildRouteHash()` (app.js:1257-1297)** — re-emit `repo=` in the hash, in BOTH the spec branch and the roadmap branch, so navigation events preserve it.
4. **`applyRouteStateFromLocation()` (app.js:4972) and the init block (app.js:6117-6149)** — write `route.repo` into `state.repoPath`.
5. **`fetchJson()` (app.js:3047)** — attach the `X-Minimap-Repo` header on roadmap endpoints.

Plus a small ergonomic step: pre-fill `<span id="repo-name">` from the `repo=` URL basename at boot, so the title doesn't read just `"Minimap — Roadmap"` until `/api/workspace` resolves.

- [ ] **Step 1: Confirm exact starting state of `fetchJson`**

```bash
sed -n '3047,3060p' c:/Dev/rore/minimap/package/minimap/ui/app.js
```

Expected: a 13-line function that just calls `fetch(url, options)` and parses JSON. The implementer needs to write the header-merging code from scratch — there is no existing header logic to "preserve."

- [ ] **Step 2: Add `state.repoPath`**

Find the `const state = {` initializer at the top of `app.js`. Add the new field alongside other top-level keys (e.g. near `appMode`):

```javascript
repoPath: "",
```

- [ ] **Step 3: Update `readRouteState` to return `repo`**

Replace the function at app.js:1242-1255:

```javascript
function readRouteState() {
  const rawHash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const params = new URLSearchParams(rawHash);
  return {
    view: params.get("view") || "roadmap",
    specFile: params.get("file") || "",
    itemId: params.get("item") || "",
    mode: normalizeEditorMode(params.get("mode") || "preview"),
    lens: params.get("lens") || DEFAULT_LENS_KEY,
    layout: normalizeBoardLayout(params.get("layout") || DEFAULT_BOARD_LAYOUT),
    query: normalizeSearchQuery(params.get("q") || ""),
    filters: parseRouteFilters(params),
    repo: params.get("repo") || "",
  };
}
```

- [ ] **Step 4: Update `buildRouteHash` to preserve `repo`**

In the function at app.js:1257, set `repo` into the params **first** (so it's preserved across both branches):

```javascript
function buildRouteHash(itemId = state.selectedItemId, mode = state.editorMode) {
  const params = new URLSearchParams();

  if (state.repoPath) {
    params.set("repo", state.repoPath);
  }

  if (state.appMode === "spec") {
    params.set("view", "spec");
    if (state.spec.selectedPath) {
      params.set("file", state.spec.selectedPath);
    }
    return `#${params.toString()}`;
  }

  // ... rest of function unchanged
}
```

The roadmap branch at the bottom builds `serialized` from `params.toString()` and returns `serialized ? "#${serialized}" : ""`. Since `params` now always includes `repo` when set, the empty-hash short-circuit at the end becomes unreachable when `repoPath` is truthy. Change the final return to always emit:

```javascript
  serializeRouteFilters(params, state.activeFilters);

  const serialized = params.toString();
  return serialized ? `#${serialized}` : "";
```

(No structural change — confirming the returned hash includes `repo=` because `params.set("repo", ...)` was called at the top.)

- [ ] **Step 5: Update `applyRouteStateFromLocation` to assign `state.repoPath`**

In the function at app.js:4972, after the first line `const route = readRouteState();`, add:

```javascript
async function applyRouteStateFromLocation() {
  const route = readRouteState();
  if (route.repo) {
    state.repoPath = route.repo;
  }
  if (route.view === "spec") {
    // ... existing spec branch unchanged
  }
  // ... rest unchanged
}
```

- [ ] **Step 6: Update the init block (app.js:6117-6149) to assign `state.repoPath` from `initialRoute.repo`**

Find the line `const initialRoute = readRouteState();` near app.js:6117 and add the assignment right after:

```javascript
const initialRoute = readRouteState();
state.repoPath = initialRoute.repo || "";
state.appMode = initialRoute.view === "spec" ? "spec" : "roadmap";
// ... existing init unchanged
```

Also, immediately after that assignment, pre-fill the repo-name span from the URL basename so the title doesn't show empty until `/api/workspace` returns:

```javascript
state.repoPath = initialRoute.repo || "";
if (state.repoPath && repoNameElement) {
  // Best-effort: extract the trailing path segment as a placeholder.
  // /api/workspace will overwrite with the canonical name when it loads.
  const segments = state.repoPath.replaceAll("\\", "/").split("/").filter(Boolean);
  const placeholderName = segments[segments.length - 1] || "";
  if (placeholderName) {
    repoNameElement.textContent = placeholderName;
    document.title = `Minimap — ${placeholderName}`;
  }
}
```

- [ ] **Step 7: Update `fetchJson` to send `X-Minimap-Repo`**

Replace the function at app.js:3047:

```javascript
async function fetchJson(url, options = {}) {
  const isRoadmapEndpoint =
    url.startsWith("/api/workspace")
    || url.startsWith("/api/board")
    || url.startsWith("/api/scope")
    || url.startsWith("/api/items/")
    || url.startsWith("/api/setup/");

  let finalOptions = options;
  if (isRoadmapEndpoint && state.repoPath) {
    const headers = new Headers(options.headers || {});
    headers.set("X-Minimap-Repo", state.repoPath);
    finalOptions = { ...options, headers };
  }

  const response = await fetch(url, finalOptions);
  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Request failed.");
    error.code = payload?.error?.code || "request_failed";
    error.details = payload?.error?.details || null;
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}
```

- [ ] **Step 8: Sanity-check by grepping for any roadmap fetch call site we may have missed**

```bash
grep -nE "fetchJson\(\"/api/(workspace|board|scope|items|setup)" c:/Dev/rore/minimap/package/minimap/ui/app.js
```

Expected: ten or so call sites — all going through the augmented `fetchJson`, so the header attaches automatically.

- [ ] **Step 9: Commit**

```bash
git add package/minimap/ui/app.js
git commit -m "feat(ui): URL hash drives repoPath; fetchJson sends X-Minimap-Repo; preserve repo across navigation"
```

---

### Task 14: Update Playwright config + tests to use `#repo=` URL

**Files:**
- Modify: `playwright.config.js`
- Modify: `playwright/roadmap-ui.spec.js`

- [ ] **Step 1: Add `MINIMAP_HOME` to playwright webServer env (isolation from real user state)**

Edit [playwright.config.js](playwright.config.js):

```javascript
import { defineConfig } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// Isolate the playwright server's registry from the developer's real $MINIMAP_HOME.
const playwrightMinimapHome = path.join(os.tmpdir(), `minimap-pw-${process.pid}`);
fs.mkdirSync(playwrightMinimapHome, { recursive: true });

export default defineConfig({
  testDir: "./playwright",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4315",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node package/minimap/server.js",
    port: 4315,
    reuseExistingServer: false,
    env: {
      PORT: "4315",
      MINIMAP_HOME: playwrightMinimapHome,
    },
  },
});
```

- [ ] **Step 2: Find the page-open sites in the spec**

```bash
grep -n "page.goto\|baseURL" c:/Dev/rore/minimap/playwright/roadmap-ui.spec.js | head -20
```

- [ ] **Step 3: Update each `page.goto` call**

Wherever the spec opens the UI, append the repo path to the hash. Most tests open `/`; change them to:

```javascript
await page.goto(`/#repo=${encodeURIComponent(process.cwd())}`);
```

If a test sets up a temporary sandbox repo (like `playwright-setup-roadmap`), use that repo's path instead:

```javascript
await page.goto(`/#repo=${encodeURIComponent(setupSandboxPath)}`);
```

(The implementer should sweep every `page.goto` call site systematically. Sandbox tests in the file pre-create their own roadmap dir; they need their sandbox path, not `process.cwd()`.)

- [ ] **Step 4: Add a regression test that `repo=` survives a navigation event**

Append a new test that proves `buildRouteHash` preserves `repo`:

```javascript
test("repo= URL hash param survives item-click navigation", async ({ page }) => {
  const repoPath = process.cwd();
  await page.goto(`/#repo=${encodeURIComponent(repoPath)}`);

  // Wait for the board to be visible (proxies for "workspace loaded").
  await expect(page.locator("#mode-title")).toContainText("Roadmap");

  // Click any board item that should be present.
  const firstItem = page.locator(".board-item").first();
  await firstItem.click();

  // After click, the hash should still include repo=.
  const hash = await page.evaluate(() => window.location.hash);
  expect(hash).toContain("repo=");
  expect(decodeURIComponent(hash)).toContain(repoPath);
});
```

- [ ] **Step 5: Run Playwright tests**

```bash
cd c:/Dev/rore/minimap && npx playwright test --reporter=list
```

Expected: all tests PASS, including the new navigation-preserves-repo test.

- [ ] **Step 6: Commit**

```bash
git add playwright/roadmap-ui.spec.js playwright.config.js
git commit -m "test(ui): playwright passes repo path via URL hash; isolated MINIMAP_HOME"
```

---

### Task 15: Re-sync top-level changes into both bundled runtimes

**Files:**
- Modify: `package/minimap/skills/minimap-spec-review/runtime/server.js`
- Modify: `package/minimap/skills/minimap-spec-review/runtime/ui/app.js`
- Modify: `package/minimap/skills/minimap-spec-review/runtime/ui/index.html`
- Modify: `package/minimap/skills/minimap-roadmap/runtime/...` (full mirror)

- [ ] **Step 1: Re-copy server.js, ui/app.js, ui/index.html into spec-review runtime**

```bash
cd c:/Dev/rore/minimap
cp package/minimap/server.js \
   package/minimap/skills/minimap-spec-review/runtime/server.js
cp package/minimap/ui/app.js \
   package/minimap/skills/minimap-spec-review/runtime/ui/app.js
cp package/minimap/ui/index.html \
   package/minimap/skills/minimap-spec-review/runtime/ui/index.html
```

- [ ] **Step 2: Re-copy the full runtime tree into roadmap skill**

```bash
rm -rf package/minimap/skills/minimap-roadmap/runtime
cp -R package/minimap/skills/minimap-spec-review/runtime \
      package/minimap/skills/minimap-roadmap/runtime
```

- [ ] **Step 3: Verify the three trees are in sync**

```bash
diff -r package/minimap/server.js \
        package/minimap/skills/minimap-spec-review/runtime/server.js
diff -r package/minimap/src \
        package/minimap/skills/minimap-spec-review/runtime/src
diff -r package/minimap/ui \
        package/minimap/skills/minimap-spec-review/runtime/ui
diff -r package/minimap/skills/minimap-spec-review/runtime \
        package/minimap/skills/minimap-roadmap/runtime
```

Expected: all four `diff -r` calls produce no output.

- [ ] **Step 4: Commit**

```bash
git add package/minimap/skills/minimap-spec-review/runtime \
        package/minimap/skills/minimap-roadmap/runtime
git commit -m "chore(runtime): sync server + UI changes into both bundled runtimes"
```

---

### Task 16: README + CONTRACT mention multi-repo URL convention

**Files:**
- Modify: `package/minimap/README.md`
- Modify: `package/minimap/CONTRACT.md`

- [ ] **Step 1: Append a "Multiple repos" subsection to [README.md](package/minimap/README.md)**

Find the section that describes starting the server and add (terse):

```markdown
### Multiple repos

A single running minimap server can serve roadmap for any number of repos. Pass the absolute repo path in the URL hash:

```text
http://localhost:4312/#repo=/abs/path/to/repo&view=board
```

Bundled `start-server.mjs` launchers detect a running server via `$MINIMAP_HOME/server.json` and reuse it.
```

- [ ] **Step 2: Append a corresponding line to [CONTRACT.md](package/minimap/CONTRACT.md)** if appropriate (only if CONTRACT.md already discusses server identity; otherwise leave it). Run:

```bash
grep -n "server\|repoRoot\|cwd\|port" c:/Dev/rore/minimap/package/minimap/CONTRACT.md | head -10
```

If there's a "Server" section, add: *"The server is repo-agnostic; the active repo for roadmap requests is named per-call (header or URL `repo=`), defaulting to cwd for back-compat."* If there is no such section, skip this step.

- [ ] **Step 3: Commit**

```bash
git add package/minimap/README.md package/minimap/CONTRACT.md
git commit -m "docs: README + CONTRACT note multi-repo URL convention"
```

---

### Task 17: Final tri-tree sync verification + full test pass

- [ ] **Step 1: Run all syncs again as a sanity check**

```bash
cd c:/Dev/rore/minimap
diff -r package/minimap/src package/minimap/skills/minimap-spec-review/runtime/src
diff -r package/minimap/src package/minimap/skills/minimap-roadmap/runtime/src
diff -r package/minimap/ui package/minimap/skills/minimap-spec-review/runtime/ui
diff -r package/minimap/ui package/minimap/skills/minimap-roadmap/runtime/ui
diff -q package/minimap/server.js package/minimap/skills/minimap-spec-review/runtime/server.js
diff -q package/minimap/server.js package/minimap/skills/minimap-roadmap/runtime/server.js
diff -q package/minimap/cli.js package/minimap/skills/minimap-spec-review/runtime/cli.js
diff -q package/minimap/cli.js package/minimap/skills/minimap-roadmap/runtime/cli.js
```

Expected: zero output.

- [ ] **Step 2: Run full unit test suite**

```bash
cd c:/Dev/rore/minimap && npm test
```

Expected: ALL PASS.

- [ ] **Step 3: Run full Playwright suite**

```bash
cd c:/Dev/rore/minimap && npx playwright test
```

Expected: ALL PASS.

- [ ] **Step 4: Manual UI verification (per user instruction "actually check your work in the ui")**

```bash
# Terminal 1
cd c:/Dev/rore/minimap
MINIMAP_HOME=$(mktemp -d) PORT=4312 \
  node package/minimap/skills/minimap-spec-review/scripts/start-server.mjs
```

In a browser:
1. Open `http://localhost:4312/#repo=C:%5CDev%5Crore%5Cminimap&view=board` (URL-encoded Windows path — DO NOT use bash-style `/c/Dev/...`; on Windows Node, `path.resolve("/c/Dev/rore/minimap")` returns `C:\c\Dev\rore\minimap` which doesn't exist). Expect: roadmap board for the minimap repo loads, title shows "minimap".
2. Open `http://localhost:4312/#repo=<another-windows-repo-with-roadmap>&view=board` (URL-encoded Windows path). Expect: switches to that repo's board.
3. Open `http://localhost:4312/#view=spec&file=<some-file>`. Expect: spec session works, no `X-Minimap-Repo` header sent.
4. With the spec session loaded, click on a section to navigate. Expect: the URL hash retains any `repo=` you may have included.
5. Run a second `start-server.mjs` from the roadmap skill in another terminal. Expect: it prints "already running" and exits 0.
6. Kill the server (Ctrl-C). Expect: `cat $MINIMAP_HOME/server.json` returns ENOENT.

Record any issues; the next step iterates on them.

- [ ] **Step 5: Final commit (only if any docs/test polish was added)**

```bash
git status
# Only commit if there is residue from manual checks. Use:
git commit -am "polish: final tri-tree sync + manual UI verification"
```

---

## Self-Review

**Revisions applied after architect review (2026-06-02):**

- Reordered: Task 4 (sync registry into runtime) now comes before the launcher (formerly Task 4, now Task 4 with bundled-runtime prerequisite Task 3) — fixes Finding 8.1 (broken import order).
- Task 4 now handles concurrent-launcher race via `MINIMAP_NO_PORT_FALLBACK` + re-probe, with a regression test — fixes Finding 2.1.
- Task 11 dropped the `?repo=` query fallback (Finding 2.5), corrected "five sites" → "six sites" with concrete line numbers (Finding 1.5), and added a concurrent-fetches test (Finding 3.1).
- Task 13 expanded from 3 → 9 steps, covering all five UI sites (`state`, `readRouteState`, `buildRouteHash`, `applyRouteStateFromLocation`, init block, `fetchJson`) — fixes the silent-regression bugs in Findings 1.1, 1.2, 1.3.
- Task 13 also pre-fills `repo-name` from the URL hash basename to mitigate the title flicker — fixes Finding 5.1.
- Task 14 now includes a regression test that `repo=` survives navigation (Finding 3.4) and isolates `MINIMAP_HOME` in the playwright config (Finding 7.2).
- Task 11 has an explicit "do not use skill launchers between Tasks 11–15" warning — addresses Finding 7.1.
- Task 17 manual verification corrected to use Windows-style paths (`C:\Dev\...`), not bash `/c/Dev/...` — fixes Finding 2.4.
- Task 8 SKILL.md no longer promises multi-repo capability before Half 2 lands — fixes Finding 4.1.
- Task 2 uses async `fs.readFile` instead of sync `readFileSync` (style consistency) — fixes Finding 1.6. Also adds SIGINT cleanup test variant and cleans up registry on the bind-failure error path — addresses Finding 7.3.

**1. Spec coverage:**

| Requirement | Implemented in |
|---|---|
| Both skills self-contained, bundling runtime | Task 7 (roadmap), already done for spec-review (verified Task 5) |
| Single server serves multiple repos | Tasks 11, 13, 14 |
| Skills know about a running server | Tasks 1–4 (registry + race-safe launcher) |
| URL drives repo selection (no in-app switcher) | Tasks 12, 13, 14 |
| Tests pass; UI verified manually | Task 17 |
| Architect + code reviews | Architect review completed; code reviews scheduled at half boundaries |

**2. Placeholder scan:** Plan reviewed — every code step contains the actual code. No "implement later" / "appropriate error handling" / "similar to Task N" markers. The only conditional content is in Task 16 step 2, where the edit depends on what CONTRACT.md already contains; the step contains a verification command and a clear skip condition.

**3. Type/name consistency:**
- `readServerRegistry` / `writeServerRegistry` / `deleteServerRegistry` / `registryPath` consistent throughout.
- `probeRunningServer` and `probePort` defined in Task 4 step 4, used in `start-server.mjs` step 5.
- `resolveRoadmapRepo(request)` (single arg, no `requestUrl` because `?repo=` was removed) consistent in Task 11 step 3.
- `state.repoPath`, `X-Minimap-Repo` (header), `repo` (URL hash key) — spelled identically across server, UI, tests, docs.
- `$MINIMAP_HOME/server.json` consistent — never `$MINIMAP_HOME/minimap-server.json` or other variants.
- `MINIMAP_NO_PORT_FALLBACK` env var name consistent in Task 4 (server.js change + launcher).

---

## Reviews

The user asked for an architect review on the plan and code reviews per task. Two checkpoints:

**Architect review (after writing this plan, before Task 1):**
Dispatch `feature-dev:code-architect` with the plan + the existing files it touches and ask: "Identify any structural mistakes, missing edge cases, or assumptions that don't hold against the codebase. Focus on the half-2 refactor (Task 11) — is the per-request repo resolution clean? Is anything missing from the UI hash flow?"

**Code review (after each half):**
After Task 10 commits land, dispatch `feature-dev:code-reviewer` against `git diff main...HEAD -- package/minimap/src/server-registry.js package/minimap/server.js package/minimap/skills/`. Same again after Task 16.

Iterate based on review output. The plan is the contract; deviations require an explicit reason and re-test.

---

## Execution Handoff

**Plan complete and saved to [`docs/superpowers/plans/2026-06-02-skill-packaging-and-shared-server.md`](docs/superpowers/plans/2026-06-02-skill-packaging-and-shared-server.md). Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for this plan because half 2's UI work needs intermediate Playwright runs and the tri-tree sync benefits from a clean reviewer.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
