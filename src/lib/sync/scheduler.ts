import { supabase } from "@/lib/supabase";
import { syncPoForMarketplace, syncSales, syncDispatch, SyncResult } from "./orchestrator";

const AUTO_SYNC_ENABLED_KEY = "auto_sync_enabled";
const AUTO_SYNC_INTERVAL_KEY = "auto_sync_interval_minutes";
const AUTO_SYNC_LAST_RUN_KEY = "auto_sync_last_run_at";

export interface ScheduledSyncOutcome {
  ran: boolean;
  reason?: "disabled" | "not_due";
  results?: SyncResult[];
}

async function getSetting<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(`Failed to read setting ${key}: ${error.message}`);
  return (data?.value as T | undefined) ?? null;
}

async function setSetting(key: string, value: unknown): Promise<void> {
  const { error } = await supabase.from("settings").upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(`Failed to write setting ${key}: ${error.message}`);
}

// One sync call retried once on failure — the scheduler runs
// unattended, unlike the Data Sync page's manual buttons (a human
// watching those can just click again), so it's the one place a retry
// actually matters.
async function withRetry(fn: () => Promise<SyncResult>): Promise<SyncResult> {
  const first = await fn();
  if (first.status !== "failed") return first;
  console.warn(`Retrying failed sync (${first.workbookType}/${first.marketplaceName}): ${first.errorMessage}`);
  return fn();
}

// Entry point for the cron route (and anything else that wants to nudge
// the scheduler, e.g. a manual "run scheduler now" button). Reads
// enabled/interval/last-run from Supabase — never env vars — and decides
// whether it's actually time to sync, so the cron trigger itself can run
// on a fixed, coarse cadence (e.g. every 5 minutes) while still honoring
// whatever interval the Data Sync page has configured (5/10/15/30/60 min).
export async function runScheduledSync(): Promise<ScheduledSyncOutcome> {
  const enabled = (await getSetting<boolean>(AUTO_SYNC_ENABLED_KEY)) ?? false;
  if (!enabled) return { ran: false, reason: "disabled" };

  const intervalMinutes = (await getSetting<number>(AUTO_SYNC_INTERVAL_KEY)) ?? 15;
  const lastRunAt = await getSetting<string | null>(AUTO_SYNC_LAST_RUN_KEY);
  if (lastRunAt) {
    const elapsedMs = Date.now() - new Date(lastRunAt).getTime();
    if (elapsedMs < intervalMinutes * 60_000) return { ran: false, reason: "not_due" };
  }

  // syncAll() already calls loadSheetConnection per workbook, which
  // filters is_enabled=true — a disabled connection is skipped
  // automatically, never synced by the scheduler.
  const results = await syncAllWithRetry();

  await setSetting(AUTO_SYNC_LAST_RUN_KEY, new Date().toISOString());
  return { ran: true, results };
}

// syncAll() runs POs (one per marketplace) + Sales + Dispatch in
// sequence already; this wraps each of those individual calls in
// withRetry by re-implementing the same sequencing here rather than
// changing syncAll's own signature (kept simple for manual/interactive
// use from the Data Sync page, where a human watching can just click
// again — retries are unattended-scheduler-only).
async function syncAllWithRetry(): Promise<SyncResult[]> {
  const { data: marketplaces, error } = await supabase.from("marketplaces").select("id, name").eq("is_active", true);
  if (error) throw new Error(`Failed to load marketplaces: ${error.message}`);

  const results: SyncResult[] = [];
  for (const m of marketplaces ?? []) {
    results.push(await withRetry(() => syncPoForMarketplace(m.id, m.name)));
  }
  results.push(await withRetry(() => syncSales()));
  results.push(await withRetry(() => syncDispatch()));
  return results;
}
