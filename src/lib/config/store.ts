import { promises as fs } from "fs";
import path from "path";

// Same placeholder-JSON-file approach as rules storage (see
// src/lib/rules/storage.ts) — swap for a real database once one is
// chosen. Values below are the user-confirmed starting defaults; every
// number here is editable in Settings, not hardcoded into the engine.
const DATA_DIR = path.join(process.cwd(), ".data");
const CONFIG_FILE = path.join(DATA_DIR, "engine-config.json");

export interface EngineConfig {
  metroCities: string[];
  metroCityScoreBonus: number;
  levelThresholds: {
    critical: number;
    high: number;
    medium: number;
  };
}

const DEFAULT_CONFIG: EngineConfig = {
  metroCities: [
    "Mumbai",
    "Delhi",
    "NCR",
    "Gurgaon",
    "Gurugram",
    "Faridabad",
    "Noida",
    "Ghaziabad",
    "Bangalore",
    "Bengaluru",
    "Chennai",
    "Hyderabad",
    "Kolkata",
    "Pune",
  ],
  metroCityScoreBonus: 10,
  levelThresholds: {
    critical: 80,
    high: 60,
    medium: 30,
  },
};

export async function getEngineConfig(): Promise<EngineConfig> {
  try {
    const text = await fs.readFile(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(text) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveEngineConfig(config: EngineConfig): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function levelForScore(
  score: number,
  thresholds: EngineConfig["levelThresholds"]
): "Critical" | "High" | "Medium" | "Low" {
  if (score >= thresholds.critical) return "Critical";
  if (score >= thresholds.high) return "High";
  if (score >= thresholds.medium) return "Medium";
  return "Low";
}
