// Pure, browser-safe half of the engine config — split out of store.ts
// (which imports "fs"/"path" to persist it) so the priority engine
// (computePoPriority/buildPoRows/buildExecutiveSummary/computeTimeline)
// can run in a Client Component without dragging a Node-only module into
// the browser bundle. store.ts re-uses these, it doesn't duplicate them.
export interface EngineConfig {
  metroCities: string[];
  metroCityScoreBonus: number;
  levelThresholds: {
    critical: number;
    high: number;
    medium: number;
  };
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
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

export function levelForScore(
  score: number,
  thresholds: EngineConfig["levelThresholds"]
): "Critical" | "High" | "Medium" | "Low" {
  if (score >= thresholds.critical) return "Critical";
  if (score >= thresholds.high) return "High";
  if (score >= thresholds.medium) return "Medium";
  return "Low";
}
