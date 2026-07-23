import { supabase } from "@/lib/supabase";
import { readRawRowsFromSheetUrl } from "@/lib/sheets/client";
import { loadSkuCostPriceMap } from "@/lib/sheets/price-master";
import { loadSheetConnection } from "./connections";
import { importPoWorkbookRows } from "@/lib/import/po-importer";
import { importSalesWorkbookRows, clearAllSalesRecords } from "@/lib/import/sales-importer";
import { importDispatchWorkbookRows } from "@/lib/import/dispatch-importer";

// Sync architecture (confirmed): Google Sheets -> Importer -> Supabase ->
// Priority Engine -> Dashboard. Everything below handles the first three
// steps; priority recalculation is Stage 8 and not wired in yet — each
// sync function's result says whether one should run next, but nothing
// here calls it (there's nothing to call yet).
export interface SyncResult {
  workbookType: "po" | "sales" | "dispatch";
  marketplaceName: string;
  status: "success" | "failed" | "skipped";
  rowsInserted: number;
  rowsUpdated: number;
  rowsFailed: number;
  errorMessage?: string;
}

interface Marketplace {
  id: string;
  name: string;
}

async function listMarketplaces(): Promise<Marketplace[]> {
  const { data, error } = await supabase.from("marketplaces").select("id, name").eq("is_active", true);
  if (error) throw new Error(`Failed to load marketplaces: ${error.message}`);
  return data ?? [];
}

async function startSyncJob(params: { marketplaceId: string | null; jobType: string }): Promise<string> {
  const { data, error } = await supabase
    .from("sync_jobs")
    .insert({
      marketplace_id: params.marketplaceId,
      source: "google_sheet",
      job_type: params.jobType,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create sync_jobs row: ${error.message}`);
  return data.id as string;
}

async function finishSyncJob(
  id: string,
  patch: { status: "success" | "failed"; rowsInserted: number; rowsUpdated: number; rowsFailed: number; errorMessage?: string }
): Promise<void> {
  const { error } = await supabase
    .from("sync_jobs")
    .update({
      status: patch.status,
      rows_processed: patch.rowsInserted + patch.rowsUpdated,
      rows_inserted: patch.rowsInserted,
      rows_updated: patch.rowsUpdated,
      rows_failed: patch.rowsFailed,
      error_message: patch.errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`Failed to update sync_jobs row ${id}: ${error.message}`);
}

// One PO sheet per marketplace (today's real shape) — its own
// sheet_connections row, its own sync_jobs + po_uploads row.
export async function syncPoForMarketplace(marketplaceId: string, marketplaceName: string): Promise<SyncResult> {
  const jobId = await startSyncJob({ marketplaceId, jobType: "po_sync" });
  try {
    const connection = await loadSheetConnection("po", marketplaceId);
    if (!connection) {
      await finishSyncJob(jobId, {
        status: "failed",
        rowsInserted: 0,
        rowsUpdated: 0,
        rowsFailed: 0,
        errorMessage: "No PO sheet connection configured for this marketplace yet — add one on the Data Sync page.",
      });
      return {
        workbookType: "po",
        marketplaceName,
        status: "skipped",
        rowsInserted: 0,
        rowsUpdated: 0,
        rowsFailed: 0,
        errorMessage: "Not configured",
      };
    }

    const rawRows = await readRawRowsFromSheetUrl(connection.sheetUrl, connection.gid);
    const priceMap = await loadSkuCostPriceMap();

    const { data: poUpload, error: uploadError } = await supabase
      .from("po_uploads")
      .insert({ marketplace_id: marketplaceId, sync_job_id: jobId, row_count: rawRows.length - 1 })
      .select("id")
      .single();
    if (uploadError) throw new Error(`Failed to create po_uploads row: ${uploadError.message}`);

    const result = await importPoWorkbookRows({
      marketplaceId,
      marketplaceName,
      rawRows,
      poUploadId: poUpload.id as string,
      priceMap,
      minPoRaisedYear: connection.minPoRaisedYear ?? undefined,
    });

    await finishSyncJob(jobId, {
      status: "success",
      rowsInserted: result.posInserted,
      rowsUpdated: result.posUpdated,
      rowsFailed: result.skippedRows,
    });
    return {
      workbookType: "po",
      marketplaceName,
      status: "success",
      rowsInserted: result.posInserted,
      rowsUpdated: result.posUpdated,
      rowsFailed: result.skippedRows,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await finishSyncJob(jobId, { status: "failed", rowsInserted: 0, rowsUpdated: 0, rowsFailed: 0, errorMessage }).catch(() => {});
    return { workbookType: "po", marketplaceName, status: "failed", rowsInserted: 0, rowsUpdated: 0, rowsFailed: 0, errorMessage };
  }
}

// Sales is one shared tab across every marketplace (a Platform column,
// not a tab per marketplace) — one sheet_connections row, one sync_jobs +
// sales_uploads row for the whole sync, one fetch, then
// importSalesWorkbookRows filters internally per marketplace. Idempotency
// is a whole-batch replace (clearAllSalesRecords), so every successful
// sync reports as "inserted", never "updated" — there's nothing to
// distinguish an update from here.
export async function syncSales(): Promise<SyncResult> {
  const jobId = await startSyncJob({ marketplaceId: null, jobType: "sales_sync" });
  try {
    const connection = await loadSheetConnection("sales");
    if (!connection) {
      await finishSyncJob(jobId, {
        status: "failed",
        rowsInserted: 0,
        rowsUpdated: 0,
        rowsFailed: 0,
        errorMessage: "No Sales sheet connection configured yet — add one on the Data Sync page.",
      });
      return {
        workbookType: "sales",
        marketplaceName: "all",
        status: "skipped",
        rowsInserted: 0,
        rowsUpdated: 0,
        rowsFailed: 0,
        errorMessage: "Not configured",
      };
    }

    const rawRows = await readRawRowsFromSheetUrl(connection.sheetUrl, connection.gid);

    const { data: salesUpload, error: uploadError } = await supabase
      .from("sales_uploads")
      .insert({ sync_job_id: jobId, row_count: rawRows.length - 1 })
      .select("id")
      .single();
    if (uploadError) throw new Error(`Failed to create sales_uploads row: ${uploadError.message}`);

    // Whole-batch replace (confirmed idempotency strategy for sales_records)
    // — must run once, before the per-marketplace loop, never inside it.
    await clearAllSalesRecords();

    const marketplaces = await listMarketplaces();
    let totalImported = 0;
    for (const marketplace of marketplaces) {
      const result = await importSalesWorkbookRows({
        marketplaceId: marketplace.id,
        marketplaceName: marketplace.name,
        rawRows,
        salesUploadId: salesUpload.id as string,
      });
      totalImported += result.recordsImported;
    }

    await finishSyncJob(jobId, { status: "success", rowsInserted: totalImported, rowsUpdated: 0, rowsFailed: 0 });
    return { workbookType: "sales", marketplaceName: "all", status: "success", rowsInserted: totalImported, rowsUpdated: 0, rowsFailed: 0 };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await finishSyncJob(jobId, { status: "failed", rowsInserted: 0, rowsUpdated: 0, rowsFailed: 0, errorMessage }).catch(() => {});
    return { workbookType: "sales", marketplaceName: "all", status: "failed", rowsInserted: 0, rowsUpdated: 0, rowsFailed: 0, errorMessage };
  }
}

// Dispatch is also one shared tab (Marketplace column) — same shape as
// Sales, but it only UPDATES existing purchase_orders (never inserts), so
// there's no dispatch_uploads table — sync_jobs alone carries its
// history, and every successful row is an "update", never an "insert".
export async function syncDispatch(): Promise<SyncResult> {
  const jobId = await startSyncJob({ marketplaceId: null, jobType: "dispatch_sync" });
  try {
    const connection = await loadSheetConnection("dispatch");
    if (!connection) {
      await finishSyncJob(jobId, {
        status: "failed",
        rowsInserted: 0,
        rowsUpdated: 0,
        rowsFailed: 0,
        errorMessage: "No Dispatch sheet connection configured yet — add one on the Data Sync page.",
      });
      return {
        workbookType: "dispatch",
        marketplaceName: "all",
        status: "skipped",
        rowsInserted: 0,
        rowsUpdated: 0,
        rowsFailed: 0,
        errorMessage: "Not configured",
      };
    }

    const rawRows = await readRawRowsFromSheetUrl(connection.sheetUrl, connection.gid);

    const marketplaces = await listMarketplaces();
    let totalUpdated = 0;
    let totalNotFound = 0;
    for (const marketplace of marketplaces) {
      const result = await importDispatchWorkbookRows({
        marketplaceId: marketplace.id,
        marketplaceName: marketplace.name,
        rawRows,
      });
      totalUpdated += result.posUpdated;
      totalNotFound += result.posNotFound;
    }

    await finishSyncJob(jobId, { status: "success", rowsInserted: 0, rowsUpdated: totalUpdated, rowsFailed: totalNotFound });
    return { workbookType: "dispatch", marketplaceName: "all", status: "success", rowsInserted: 0, rowsUpdated: totalUpdated, rowsFailed: totalNotFound };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await finishSyncJob(jobId, { status: "failed", rowsInserted: 0, rowsUpdated: 0, rowsFailed: 0, errorMessage }).catch(() => {});
    return { workbookType: "dispatch", marketplaceName: "all", status: "failed", rowsInserted: 0, rowsUpdated: 0, rowsFailed: 0, errorMessage };
  }
}

// One marketplace's failed sync must never stop the rest — same
// degrade-independently precedent as fetchAllPurchaseOrders.
export async function syncAll(): Promise<SyncResult[]> {
  const marketplaces = await listMarketplaces();
  const results: SyncResult[] = [];

  const poResults = await Promise.allSettled(marketplaces.map((m) => syncPoForMarketplace(m.id, m.name)));
  for (const r of poResults) {
    if (r.status === "fulfilled") results.push(r.value);
  }

  results.push(await syncSales());
  results.push(await syncDispatch());

  return results;
}
