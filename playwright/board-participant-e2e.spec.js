import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";

const projectRoot = process.cwd();
const startScript = path.join(projectRoot, "package", "minimap", "skills", "minimap-roadmap", "scripts", "start-server.mjs");
const stopScript = path.join(projectRoot, "package", "minimap", "skills", "minimap-roadmap", "scripts", "stop-server.mjs");

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", (error) => error ? reject(error) : resolve()));
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function runScript(script, env, readyPort = null) {
  const child = spawn(process.execPath, [script], { cwd: projectRoot, env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  return new Promise((resolve, reject) => {
    const timer = readyPort === null ? null : setTimeout(() => reject(new Error(`Minimap did not start. ${output}`)), 8000);
    const onData = (chunk) => {
      output += String(chunk);
      if (readyPort !== null && output.includes(`http://localhost:${readyPort}`)) {
        clearTimeout(timer);
        resolve(child);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
      if (readyPort !== null && child.exitCode !== null) {
        clearTimeout(timer);
        reject(new Error(`Minimap failed to start. ${output}`));
      }
    });
    if (readyPort === null) {
      child.on("error", reject);
      child.on("close", (code) => code === 0 ? resolve(output) : reject(new Error(`Lifecycle script failed (${code}). ${output}`)));
    } else {
      child.on("error", (error) => { clearTimeout(timer); reject(error); });
      child.on("close", (code) => {
        if (child.exitCode !== null && !output.includes(`http://localhost:${readyPort}`)) {
          clearTimeout(timer);
          reject(new Error(`Minimap exited during startup (${code}). ${output}`));
        }
      });
    }
  });
}

async function makeRepo() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-board-participant-e2e-"));
  await fs.mkdir(path.join(root, "roadmap", "features"), { recursive: true });
  await fs.mkdir(path.join(root, "roadmap", "ideas"), { recursive: true });
  await fs.writeFile(path.join(root, "roadmap", "scope.md"), "Board presence integration fixture.\n", "utf8");
  await fs.writeFile(path.join(root, "roadmap", "board.md"), "# Now\n- active-item\n- zero-item\n- completed-item\n", "utf8");
  const items = [
    ["active-item", "in-progress"],
    ["zero-item", "queued"],
    ["completed-item", "done"],
  ];
  await Promise.all(items.map(([id, status]) => fs.writeFile(
    path.join(root, "roadmap", "features", `${id}.md`),
    `---\nid: ${id}\ntitle: ${id}\nstatus: ${status}\npriority: medium\ncommitment: committed\n---\n\n## Summary\n${id} fixture.\n`,
    "utf8",
  )));
  execFileSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["remote", "add", "origin", "https://github.com/example/board-e2e.git"], { cwd: root, stdio: "ignore" });
  return root;
}

test("board presence flows through Minimap and Pallium and renders safely in List and Columns", async ({ page }) => {
  const repoRoot = await makeRepo();
  const minimapHome = await fs.mkdtemp(path.join(os.tmpdir(), "minimap-board-participant-home-"));
  const requests = [];
  const writes = [];
  let appChild;
  let appEnv;
  const pallium = http.createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/relay/work-refs/participant-counts") {
      response.writeHead(404).end();
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    requests.push({ method: request.method, url: request.url, body });
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
      contract: "relay-work-ref-counts/v1",
      counts: body.references.map((reference) => ({
        ...reference,
        participant_count: reference.local_ref === "item:v1:active-item" ? 2
          : reference.local_ref === "item:v1:completed-item" ? 1 : 0,
      })),
    }));
  });

  await new Promise((resolve) => pallium.listen(0, "127.0.0.1", resolve));
  const palliumPort = pallium.address().port;
  const appPort = await freePort();
  appEnv = {
    ...process.env,
    PORT: String(appPort),
    MINIMAP_HOME: minimapHome,
    MINIMAP_PALLIUM_ENDPOINT: `http://127.0.0.1:${palliumPort}`,
    MINIMAP_PALLIUM_DASHBOARD_ENDPOINT: "",
  };

  try {
    await runScript(startScript, appEnv, appPort);
    page.on("request", (request) => {
      if (request.url().includes("/api/") && request.method() !== "GET") writes.push(`${request.method()} ${request.url()}`);
    });
    const countsResponse = page.waitForResponse((response) => response.url().includes("/api/board/participant-counts"));
    await page.goto(`http://127.0.0.1:${appPort}/#repo=${encodeURIComponent(repoRoot)}`);
    const response = await countsResponse;
    expect(response.status()).toBe(200);
    const localResult = await response.json();
    expect(localResult.status).toBe("ok");
    expect(localResult.counts).toEqual([
      { itemId: "active-item", participantCount: 2 },
      { itemId: "zero-item", participantCount: 0 },
    ]);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: "POST", url: "/relay/work-refs/participant-counts" });
    expect(requests[0].body).toEqual({ references: [
      { scope_ref: "roadmap:v1:git:github.com/example/board-e2e#roadmap", local_ref: "item:v1:active-item" },
      { scope_ref: "roadmap:v1:git:github.com/example/board-e2e#roadmap", local_ref: "item:v1:zero-item" },
    ] });

    const listActive = page.locator('.board-item[data-item-id="active-item"]');
    await expect(listActive.locator(".board-item-participants:visible")).toHaveText("2 attached");
    await expect(page.locator('.board-item[data-item-id="zero-item"] .board-item-participants:visible')).toHaveCount(0);
    await expect(page.locator('.board-item[data-item-id="completed-item"] .board-item-participants:visible')).toHaveCount(0);

    await page.locator("#board-layout-columns").click();
    const columnActive = page.locator('.board-column-card-main[data-item-dblopen="active-item"]');
    await expect(columnActive.locator(".board-item-participants:visible")).toHaveText("2 attached");
    await expect(page.locator('.board-column-card-main[data-item-dblopen="zero-item"] .board-item-participants:visible')).toHaveCount(0);
    await expect(page.locator('.board-column-card-main[data-item-dblopen="completed-item"] .board-item-participants:visible')).toHaveCount(0);
    expect(writes).toEqual([]);
    expect(requests).toHaveLength(1, "switching layout must not create per-card or duplicate batch requests");

    await page.locator("#board-layout-list").click();
    const doneDetailResponse = page.waitForResponse((response) => response.url().includes("/api/items/completed-item/participants"));
    await page.locator('.board-item[data-item-id="completed-item"]').click();
    const doneDetail = await doneDetailResponse;
    expect(doneDetail.status()).toBe(200);
    expect((await doneDetail.json()).reference.local_ref).toBe("item:v1:completed-item");
    await page.locator("#tab-structured").click();
    if ((await page.locator(".metadata-details").getAttribute("open")) === null) await page.locator("#metadata-toggle").click();
    await page.locator("#field-status").selectOption("in-progress");
    await page.locator("#save-button").click();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1].body.references.map((reference) => reference.local_ref)).toEqual([
      "item:v1:active-item", "item:v1:zero-item", "item:v1:completed-item",
    ]);
    await expect(page.locator('.board-item[data-item-id="completed-item"] .board-item-participants:visible')).toHaveText("1 attached");

    await page.locator('.board-item[data-item-id="active-item"]').click();
    await page.locator("#tab-structured").click();
    if ((await page.locator(".metadata-details").getAttribute("open")) === null) await page.locator("#metadata-toggle").click();
    await page.locator("#field-status").selectOption("done");
    await page.locator("#save-button").click();
    await expect.poll(() => requests.length).toBe(3);
    expect(requests[2].body.references.map((reference) => reference.local_ref)).toEqual([
      "item:v1:zero-item", "item:v1:completed-item",
    ]);
    await expect(page.locator('.board-item[data-item-id="active-item"] .board-item-participants:visible')).toHaveCount(0);
    await expect(page.locator('.board-item[data-item-id="completed-item"] .board-item-participants:visible')).toHaveText("1 attached");
  } finally {
    if (appEnv) await runScript(stopScript, appEnv).catch((error) => { throw error; });
    await new Promise((resolve) => pallium.close(resolve));
    await fs.rm(repoRoot, { recursive: true, force: true });
    await fs.rm(minimapHome, { recursive: true, force: true });
  }
});