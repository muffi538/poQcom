"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { WorkbookType } from "@/lib/import/field-mappings";
import { syncPoForMarketplace, syncSales, syncDispatch, syncAll, SyncResult } from "@/lib/sync/orchestrator";
import { requirePagePermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/audit/log";

const PAGE_KEY = "data-sync";

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
  await requirePagePermission(PAGE_KEY);
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

const saveConnectionSchema = z.object({
  workbookType: z.enum(["po", "sales", "dispatch", "ean"]),
  marketplaceId: z.string().uuid().nullable(),
  sheetUrl: z.string().url().refine((u) => u.startsWith("https://docs.google.com/spreadsheets/"), {
    message: "Must be a Google Sheets URL.",
  }),
  gid: z
    .string()
    .nullable()
    .refine((g) => g === null || g === "" || /^\d+$/.test(g), "gid must be numeric."),
  minPoRaisedYear: z.number().int().min(2000).max(2100).nullable(),
});

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
  const user = await requirePagePermission(PAGE_KEY);
  const parsed = saveConnectionSchema.safeParse(params);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  const { workbookType, marketplaceId, sheetUrl, gid, minPoRaisedYear } = parsed.data;

  // marketplace_key is a generated column (coalesce(marketplace_id, a
  // fixed sentinel)) — one real unique constraint on (workbook_type,
  // marketplace_key) covers both per-marketplace and shared connections,
  // since a partial unique index can't be used as an ON CONFLICT arbiter
  // through supabase-js.
  const { error } = await supabase.from("sheet_connections").upsert(
    {
      workbook_type: workbookType,
      marketplace_id: marketplaceId,
      sheet_url: sheetUrl,
      gid: gid || null,
      min_po_raised_year: minPoRaisedYear,
      is_enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workbook_type,marketplace_key" }
  );
  if (error) throw new Error(`Failed to save sheet connection: ${error.message}`);
  await logActivity({
    action: "sheet_connection.saved",
    actorId: user.id,
    entityType: "sheet_connection",
    metadata: { workbookType, marketplaceId, sheetUrl },
  });
  revalidatePath("/data-sync");
}

export async function toggleSheetConnection(id: string, isEnabled: boolean): Promise<void> {
  const user = await requirePagePermission(PAGE_KEY);
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) throw new Error("Invalid connection id.");

  const { error } = await supabase.from("sheet_connections").update({ is_enabled: isEnabled }).eq("id", id);
  if (error) throw new Error(`Failed to update sheet connection: ${error.message}`);
  await logActivity({
    action: "sheet_connection.toggled",
    actorId: user.id,
    entityType: "sheet_connection",
    entityId: id,
    metadata: { isEnabled },
  });
  revalidatePath("/data-sync");
}

export async function runPoSync(marketplaceId: string, marketplaceName: string): Promise<SyncResult> {
  const user = await requirePagePermission(PAGE_KEY);
  const parsed = z.object({ marketplaceId: z.string().uuid(), marketplaceName: z.string().min(1) }).safeParse({
    marketplaceId,
    marketplaceName,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");

  const result = await syncPoForMarketplace(parsed.data.marketplaceId, parsed.data.marketplaceName);
  await logActivity({
    action: "sync.triggered",
    actorId: user.id,
    entityType: "sync_job",
    metadata: { type: "po", marketplaceName },
  });
  revalidatePath("/data-sync");
  return result;
}

export async function runSalesSync(): Promise<SyncResult> {
  const user = await requirePagePermission(PAGE_KEY);
  const result = await syncSales();
  await logActivity({ action: "sync.triggered", actorId: user.id, entityType: "sync_job", metadata: { type: "sales" } });
  revalidatePath("/data-sync");
  return result;
}

export async function runDispatchSync(): Promise<SyncResult> {
  const user = await requirePagePermission(PAGE_KEY);
  const result = await syncDispatch();
  await logActivity({ action: "sync.triggered", actorId: user.id, entityType: "sync_job", metadata: { type: "dispatch" } });
  revalidatePath("/data-sync");
  return result;
}

export async function runSyncAll(): Promise<SyncResult[]> {
  const user = await requirePagePermission(PAGE_KEY);
  const results = await syncAll();
  await logActivity({ action: "sync.triggered", actorId: user.id, entityType: "sync_job", metadata: { type: "all" } });
  revalidatePath("/data-sync");
  return results;
}

export interface SyncJobRow {
  id: string;
  jobType: string;
  marketplaceName: string | null;
  status: string;
  rowsInserted: number;
  rowsUpdated: number;
  rowsFailed: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}

export async function getSyncHistory(limit = 30): Promise<SyncJobRow[]> {
  await requirePagePermission(PAGE_KEY);
  const { data, error } = await supabase
    .from("sync_jobs")
    .select(
      "id, job_type, status, rows_inserted, rows_updated, rows_failed, error_message, started_at, completed_at, marketplaces(name)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load sync history: ${error.message}`);
  return (data ?? []).map((row) => {
    const startedAt = row.started_at as string | null;
    const completedAt = row.completed_at as string | null;
    return {
      id: row.id as string,
      jobType: row.job_type as string,
      marketplaceName: (row.marketplaces as unknown as { name: string } | null)?.name ?? null,
      status: row.status as string,
      rowsInserted: row.rows_inserted as number,
      rowsUpdated: row.rows_updated as number,
      rowsFailed: row.rows_failed as number,
      errorMessage: row.error_message as string | null,
      startedAt,
      completedAt,
      durationMs: startedAt && completedAt ? new Date(completedAt).getTime() - new Date(startedAt).getTime() : null,
    };
  });
}

const AUTO_SYNC_ENABLED_KEY = "auto_sync_enabled";
const AUTO_SYNC_INTERVAL_KEY = "auto_sync_interval_minutes";
const AUTO_SYNC_LAST_RUN_KEY = "auto_sync_last_run_at";

export interface AutoSyncSettings {
  enabled: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export async function getAutoSyncSettings(): Promise<AutoSyncSettings> {
  await requirePagePermission(PAGE_KEY);
  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", [AUTO_SYNC_ENABLED_KEY, AUTO_SYNC_INTERVAL_KEY, AUTO_SYNC_LAST_RUN_KEY]);
  if (error) throw new Error(`Failed to load auto-sync settings: ${error.message}`);
  const byKey = new Map((data ?? []).map((row) => [row.key, row.value]));
  const enabled = (byKey.get(AUTO_SYNC_ENABLED_KEY) as boolean | undefined) ?? false;
  const intervalMinutes = (byKey.get(AUTO_SYNC_INTERVAL_KEY) as number | undefined) ?? 15;
  const lastRunAt = (byKey.get(AUTO_SYNC_LAST_RUN_KEY) as string | null | undefined) ?? null;
  const nextRunAt = enabled && lastRunAt ? new Date(new Date(lastRunAt).getTime() + intervalMinutes * 60_000).toISOString() : null;
  return { enabled, intervalMinutes, lastRunAt, nextRunAt };
}

const autoSyncSettingsSchema = z.object({
  enabled: z.boolean(),
  intervalMinutes: z.number().int().min(1).max(1440),
});

export async function saveAutoSyncSettings(settings: { enabled: boolean; intervalMinutes: number }): Promise<void> {
  const user = await requirePagePermission(PAGE_KEY);
  const parsed = autoSyncSettingsSchema.safeParse(settings);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");

  const { error } = await supabase.from("settings").upsert(
    [
      { key: AUTO_SYNC_ENABLED_KEY, value: parsed.data.enabled, description: "Whether scheduled auto-sync is on." },
      { key: AUTO_SYNC_INTERVAL_KEY, value: parsed.data.intervalMinutes, description: "Minutes between auto-sync runs." },
    ],
    { onConflict: "key" }
  );
  if (error) throw new Error(`Failed to save auto-sync settings: ${error.message}`);
  await logActivity({ action: "settings.auto_sync_changed", actorId: user.id, entityType: "settings", metadata: parsed.data });
  revalidatePath("/data-sync");
}
