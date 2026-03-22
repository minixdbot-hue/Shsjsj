import fs from "fs-extra";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Internal registries ---
const commandMap = new Map();
const textPlugins = [];
const allPlugins = [];

let _pluginsSnapshot = null;
let _loadingPromise = null;

export function Module(meta) {
  return (exec) => {
    const plugin = Object.freeze({
      ...meta,
      exec,
    });
    allPlugins.push(plugin);
    if (plugin.command) commandMap.set(plugin.command, plugin);
    if (plugin.on === "text") textPlugins.push(plugin);
  };
}

export async function loadPlugins(dir = path.join(__dirname, "..", "plugins")) {
  // already loaded?
  if (allPlugins.length > 0) {
    _pluginsSnapshot = getSnapshot();
    return _pluginsSnapshot;
  }

  let files = [];
  try {
    files = await fs.readdir(dir);
  } catch (err) {
    console.error(
      "plugins: failed to read directory",
      dir,
      err?.message || err
    );
    _pluginsSnapshot = getSnapshot();
    return _pluginsSnapshot;
  }

  for (const file of files) {
    if (!file.endsWith(".js")) continue;
    try {
      const filePath = path.join(dir, file);
      await import(pathToFileURL(filePath));
      console.log(`✅ plugin loaded: ${file}`);
    } catch (err) {
      console.error(`❌ plugin error (${file}):`, err?.message || err);
    }
  }

  console.log(`📦 Commands: ${commandMap.size}`);
  console.log(`📦 Text plugins: ${textPlugins.length}`);

  _pluginsSnapshot = getSnapshot();
  return _pluginsSnapshot;
}

function getSnapshot() {
  return {
    commands: new Map(commandMap),
    text: [...textPlugins],
    all: [...allPlugins],
  };
}

/**
 * ensurePlugins() - synchronous snapshot getter used in hot path.
 * If plugins are not loaded this will start a background load (once)
 * and immediately return an (possibly empty) snapshot.
 */
export function ensurePlugins() {
  if (_pluginsSnapshot) return _pluginsSnapshot;

  // start background loading once
  if (!_loadingPromise) {
    _loadingPromise = loadPlugins().catch((err) => {
      console.error("Background plugin load failed:", err?.message || err);
      _loadingPromise = null;
    });
  }

  // return an empty snapshot immediately (hot path safe)
  return {
    commands: new Map(),
    text: [],
    all: [],
  };
}

/**
 * forceLoadPlugins(dir) - returns a Promise that resolves when plugins are loaded.
 * Use at startup to block once and ensure plugins are available before accepting messages.
 */
export function forceLoadPlugins(dir) {
  if (_pluginsSnapshot) return Promise.resolve(_pluginsSnapshot);
  if (!_loadingPromise) _loadingPromise = loadPlugins(dir);
  return _loadingPromise;
}

/**
 * Backwards compatibility: `commands` live array (some older plugins import this).
 * Use getCommands() if you want a safe snapshot copy.
 */
export const commands = allPlugins;

/**
 * Safer snapshot getter for plugin consumers
 */
export function getCommands() {
  return [...allPlugins];
}
