"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { WorkbookType } from "@/lib/import/field-mappings";
import { syncPoForMarketplace, syncSales, syncDispatch, syncAll, SyncResult } from "@/lib/sync/orchestrator";

export interface SheetConnectionRow {
  id: string;
  workbookType: WorkbookType;
  marketplaceId: string | null;
  marketplaceName: string | null;
  sheetUrl: string;
  gid: string | null;
  isEnabled: boolean;
  minPoRaisedYear: number | null;
}

export async function getSheetConnections(): Promise<SheetConnectionRow[]> {
  const { data, error } = await supabase
    .from("sheet_connections")
    .select("id, workbook_type, marketplace_id, sheet_url, gid, is_enabled, min_po_raised_year, marketplaces(name)");
  if (error) throw new Error(`Failed to load sheet connections: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    workbookType: row.workbook_type as WorkbookType,
    marketplaceId: row.marketplace_id as string | null,
    marketplaceName: (row.marketplaces as unknown as { name: string } | null)?.name ?? null,
    sheetUrl: row.sheet_url as string,
    gid: row.gid as string | null,
    isEnabled: row.is_enabled as boolean,
    minPoRaisedYear: row.min_po_raised_year as number | null,
  }));
}

// Upserts a connection for (workbookType, marketplaceId) — marketplaceId
// null means "shared tab across every marketplace" (Sales/Dispatch/EAN's
// real shape today). Saved straight to Supabase, replacing what used to
// require a Vercel env var change + redeploy.
export async function saveSheetConnection(params: {
  workbookType: WorkbookType;
  marketplaceId: string | null;
  sheetUrl: string;
  gid: string | null;
  minPoRaisedYear: number | null;
}): Promise<void> {
  // marketplace_key is a generated column (coalesce(marketplace_id, a
  // fixed sentinel)) — one real unique constraint on (workbook_type,
  // marketplace_key) covers both per-marketplace and shared connections,
  // since a partial unique index can't be used as an ON CONFLICT arbiter
  // through supabase-js.
  const { error } = await supabase.from("sheet_connections").upsert(
    {
      workbook_type: params.workbookType,
      marketplace_id: params.marketplaceId,
      sheet_url: params.sheetUrl,
      gid: params.gid || null,
      min_po_raised_year: params.minPoRaisedYear,
      is_enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workbook_type,marketplace_key" }
  );
  if (error) throw new Error(`Failed to save sheet connection: ${error.message}`);
  revalidatePath("/data-sync");
}

export async function toggleSheetConnection(id: string, isEnabled: boolean): Promise<void> {
  const { error } = await supabase.from("sheet_connections").update({ is_enabled: isEnabled }).eq("id", id);
  if (error) throw new Error(`Failed to update sheet connection: ${error.message}`);
  revalidatePath("/data-sync");
}

export async function runPoSync(marketplaceId: string, marketplaceName: string): Promise<SyncResult> {
  const result = await syncPoForMarketplace(marketplaceId, marketplaceName);
  revalidatePath("/data-sync");
  return result;
}

export async function runSalesSync(): Promise<SyncResult> {
  const result = await syncSales();
  revalidatePath("/data-sync");
  return result;
}

export async function runDispatchSync(): Promise<SyncResult> {
  const result = await syncDispatch();
  revalidatePath("/data-sync");
  return result;
}

export async function runSyncAll(): Promise<SyncResult[]> {
  const results = await syncAll();
  revalidatePath("/data-sync");
  return results;
}

export interface SyncJobRow {
  id: string;
  jobType: string;
  marketplaceName: string | null;
  status: string;
  rowsProcessed: number;
  rowsFailed: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export async function getSyncHistory(limit = 30): Promise<SyncJobRow[]> {
  const { data, error } = await supabase
    .from("sync_jobs")
    .select("id, job_type, status, rows_processed, rows_failed, error_message, started_at, completed_at, marketplaces(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load sync history: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    jobType: row.job_type as string,
    marketplaceName: (row.marketplaces as unknown as { name: string } | null)?.name ?? null,
    status: row.status as string,
    rowsProcessed: row.rows_processed as number,
    rowsFailed: row.rows_failed as number,
    errorMessage: row.error_message as string | null,
    startedAt: row.started_at as string | null,
    completedAt: row.completed_at as string | null,
  }));
}

const AUTO_SYNC_ENABLED_KEY = "auto_sync_enabled";
const AUTO_SYNC_INTERVAL_KEY = "auto_sync_interval_minutes";

export interface AutoSyncSettings {
  enabled: boolean;
  intervalMinutes: number;
}

export async function getAutoSyncSettings(): Promise<AutoSyncSettings> {
  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", [AUTO_SYNC_ENABLED_KEY, AUTO_SYNC_INTERVAL_KEY]);
  if (error) throw new Error(`Failed to load auto-sync settings: ${error.message}`);
  const byKey = new Map((data ?? []).map((row) => [row.key, row.value]));
  return {
    enabled: (byKey.get(AUTO_SYNC_ENABLED_KEY) as boolean | undefined) ?? false,
    intervalMinutes: (byKey.get(AUTO_SYNC_INTERVAL_KEY) as number | undefined) ?? 15,
  };
}

export async function saveAutoSyncSettings(settings: AutoSyncSettings): Promise<void> {
  const { error } = await supabase.from("settings").upsert(
    [
      { key: AUTO_SYNC_ENABLED_KEY, value: settings.enabled, description: "Whether scheduled auto-sync is on." },
      { key: AUTO_SYNC_INTERVAL_KEY, value: settings.intervalMinutes, description: "Minutes between auto-sync runs." },
    ],
    { onConflict: "key" }
  );
  if (error) throw new Error(`Failed to save auto-sync settings: ${error.message}`);
  revalidatePath("/data-sync");
}
