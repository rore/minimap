import fs from "node:fs/promises";

const readFile = fs.readFile.bind(fs);
let paused = false;
fs.readFile = async function (file, ...args) {
  if (!paused && String(file) === process.env.MINIMAP_TEST_PAUSE_FILE) {
    try {
      await fs.access(process.env.MINIMAP_TEST_ARM);
      paused = true;
      await fs.writeFile(process.env.MINIMAP_TEST_REACHED, "ready");
      for (let attempt = 0; attempt < 600; attempt++) {
        try { await fs.access(process.env.MINIMAP_TEST_RELEASE); break; }
        catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
      }
    } catch { /* The test has not armed the read yet. */ }
  }
  return readFile(file, ...args);
};
