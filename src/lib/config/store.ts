import { promises as fs } from "fs";
import path from "path";
import { EngineConfig, DEFAULT_ENGINE_CONFIG } from "./engine-config";

// Same placeholder-JSON-file approach as rules storage (see
// src/lib/rules/storage.ts) — swap for a real database once one is
// chosen. Values are the user-confirmed starting defaults; every number
// is editable in Settings, not hardcoded into the engine.
const DATA_DIR = path.join(process.cwd(), ".data");
const CONFIG_FILE = path.join(DATA_DIR, "engine-config.json");

export type { EngineConfig };

export async function getEngineConfig(): Promise<EngineConfig> {
  try {
    const text = await fs.readFile(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_ENGINE_CONFIG, ...JSON.parse(text) };
  } catch {
    return DEFAULT_ENGINE_CONFIG;
  }
}

export async function saveEngineConfig(config: EngineConfig): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}
