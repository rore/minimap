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
