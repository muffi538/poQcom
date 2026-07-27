import { supabase } from "@/lib/supabase";
import { EngineConfig, DEFAULT_ENGINE_CONFIG } from "./engine-config";

// Persisted in the `settings` key-value table (see
// supabase/migrations/0001_operations_dashboard_schema.sql, which added
// this table specifically to replace the EngineConfig JSON file) —
// same pattern as src/lib/sync/scheduler.ts's getSetting/setSetting.
// Previously this read/wrote .data/engine-config.json via `fs`, which
// never actually persisted on a serverless deploy (no durable local
// filesystem between invocations), so threshold edits silently reset.
const ENGINE_CONFIG_KEY = "engine_config";

export type { EngineConfig };

export async function getEngineConfig(): Promise<EngineConfig> {
  const { data, error } = await supabase.from("settings").select("value").eq("key", ENGINE_CONFIG_KEY).maybeSingle();
  if (error) throw new Error(`Failed to load engine config from Supabase: ${error.message}`);
  if (!data?.value) return DEFAULT_ENGINE_CONFIG;
  return { ...DEFAULT_ENGINE_CONFIG, ...(data.value as Partial<EngineConfig>) };
}

export async function saveEngineConfig(config: EngineConfig): Promise<void> {
  const { error } = await supabase.from("settings").upsert(
    {
      key: ENGINE_CONFIG_KEY,
      value: config,
      description: "Priority engine config: metro cities, metro city score bonus, level thresholds.",
    },
    { onConflict: "key" }
  );
  if (error) throw new Error(`Failed to save engine config to Supabase: ${error.message}`);
}
