import fs from "node:fs/promises";
import path from "node:path";
import { resolveMinimapHome } from "./sessions.js";

const REGISTRY_FILE = "server.json";
const PREFERENCE_FILE = "pallium-preference.json";

export function registryPath(minimapHome) {
  return path.join(minimapHome, REGISTRY_FILE);
}

export function palliumPreferencePath(minimapHome) {
  return path.join(minimapHome, PREFERENCE_FILE);
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

export async function readPalliumPreference(options = {}) {
  const home = resolveHome(options);
  try {
    const value = JSON.parse(await fs.readFile(palliumPreferencePath(home), "utf8"));
    return typeof value?.palliumEndpoint === "string" && value.palliumEndpoint ? value.palliumEndpoint : null;
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

export async function writePalliumPreference(palliumEndpoint, options = {}) {
  if (typeof palliumEndpoint !== "string" || !palliumEndpoint) {
    throw new TypeError("palliumEndpoint must be a non-empty string.");
  }
  const home = resolveHome(options);
  await fs.mkdir(home, { recursive: true });
  await fs.writeFile(palliumPreferencePath(home), `${JSON.stringify({ palliumEndpoint }, null, 2)}\n`, "utf8");
}

export async function clearPalliumPreference(options = {}) {
  const home = resolveHome(options);
  try {
    await fs.unlink(palliumPreferencePath(home));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
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
