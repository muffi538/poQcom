import { supabase } from "@/lib/supabase";
import { loadFieldMappings, extractRowsByHeader, rowToImportLineItem } from "./field-mappings";
import { aggregateImportLines } from "./parsing";

export interface ImportPoResult {
  posImported: number;
  posInserted: number;
  posUpdated: number;
  itemsImported: number;
  skippedRows: number;
}

// The PO ingestion pipeline's core: raw rows in (from Google Sheets or an
// uploaded workbook — this function doesn't know or care which), a
// database source-of-truth answer for purchase_orders/purchase_order_items
// out. Idempotent: safe to run against the same sheet/upload twice.
export async function importPoWorkbookRows(params: {
  marketplaceId: string;
  marketplaceName: string;
  rawRows: string[][];
  poUploadId: string;
  priceMap: Map<string, number>;
  minPoRaisedYear?: number;
}): Promise<ImportPoResult> {
  const { marketplaceId, marketplaceName, rawRows, poUploadId, priceMap, minPoRaisedYear } = params;

  const mappings = await loadFieldMappings(marketplaceId, "po");
  const rowsByHeader = extractRowsByHeader(rawRows, mappings, marketplaceName);
  const lines = rowsByHeader.map((row) => rowToImportLineItem(row, mappings, marketplaceName));
  let aggregated = aggregateImportLines(lines, marketplaceName, priceMap);

  // Year floor (per-marketplace, filtered on PO Raised Date, never
  // Expiry Date) — a row with no parseable PO Raised Date can't be
  // judged against the floor, so it's logged and skipped rather than
  // guessed into either bucket.
  let skippedRows = 0;
  if (minPoRaisedYear !== undefined) {
    aggregated = aggregated.filter((po) => {
      if (!po.poRaisedDate) {
        console.warn(`[${marketplaceName}] Skipping PO ${po.poNo}: no parseable PO Raised Date.`);
        skippedRows++;
        return false;
      }
      const year = Number(po.poRaisedDate.slice(0, 4));
      if (!Number.isFinite(year) || year < minPoRaisedYear) {
        skippedRows++;
        return false;
      }
      return true;
    });
  }

  if (aggregated.length === 0) {
    return { posImported: 0, posInserted: 0, posUpdated: 0, itemsImported: 0, skippedRows };
  }

  console.log(
    `[${marketplaceName}] Parsed ${aggregated.length} POs from ${lines.length} product rows — ` +
      `Pending: ${aggregated.filter((p) => p.status.trim().toLowerCase() === "pending").length}, ` +
      `Delivered: ${aggregated.filter((p) => p.status.trim().toLowerCase() === "delivered").length}, ` +
      `Cancelled: ${aggregated.filter((p) => ["cancel", "cancelled"].includes(p.status.trim().toLowerCase())).length}.`
  );

  // Known-existing po_numbers BEFORE the upsert, so posInserted/posUpdated
  // can be reported separately — the upsert call itself can't tell insert
  // from update apart.
  const { data: existingBefore, error: existingError } = await supabase
    .from("purchase_orders")
    .select("po_number")
    .eq("marketplace_id", marketplaceId)
    .in(
      "po_number",
      aggregated.map((po) => po.poNo)
    );
  if (existingError) throw new Error(`Failed to check existing purchase_orders: ${existingError.message}`);
  const existingPoNumbers = new Set((existingBefore ?? []).map((row) => row.po_number as string));
  const posInserted = aggregated.filter((po) => !existingPoNumbers.has(po.poNo)).length;
  const posUpdated = aggregated.length - posInserted;

  // Upsert PO headers — idempotent via the (marketplace_id, po_number)
  // unique constraint: re-importing the same sheet/upload updates rows
  // in place, never inserts duplicates.
  const poRows = aggregated.map((po) => ({
    po_number: po.poNo,
    marketplace_id: marketplaceId,
    po_upload_id: poUploadId,
    status: po.status,
    city: po.city,
    warehouse: po.warehouse,
    po_raised_date: po.poRaisedDate,
    expiry_date: po.expiryDate,
    appointment_date: po.appointmentDate,
    dispatch_date: po.dispatchDate,
    ordered_qty: po.orderedQty,
    dispatched_qty: po.dispatchedQty,
    po_value: po.poValue,
  }));

  const { data: upsertedPos, error: upsertError } = await supabase
    .from("purchase_orders")
    .upsert(poRows, { onConflict: "marketplace_id,po_number" })
    .select("id, po_number");
  if (upsertError) throw new Error(`Failed to upsert purchase_orders: ${upsertError.message}`);

  const poIdByNumber = new Map((upsertedPos ?? []).map((row) => [row.po_number as string, row.id as string]));

  // Line items have no natural per-row unique key (a PO can list the
  // same SKU on more than one raw line), so idempotency here is "replace
  // this PO's items wholesale" — delete every existing item for the POs
  // in this batch, then insert the freshly aggregated set. Same end
  // state no matter how many times the same sheet is re-imported.
  const affectedPoIds = Array.from(poIdByNumber.values());
  if (affectedPoIds.length > 0) {
    const { error: deleteItemsError } = await supabase
      .from("purchase_order_items")
      .delete()
      .in("purchase_order_id", affectedPoIds);
    if (deleteItemsError) throw new Error(`Failed to clear purchase_order_items before re-import: ${deleteItemsError.message}`);
  }

  const itemRows = aggregated.flatMap((po) => {
    const purchaseOrderId = poIdByNumber.get(po.poNo);
    if (!purchaseOrderId) return [];
    return po.items.map((item) => ({
      purchase_order_id: purchaseOrderId,
      sku: item.sku,
      sku_description: item.skuDescription,
      ordered_qty: item.orderedQty,
      dispatched_qty: item.dispatchedQty,
    }));
  });

  if (itemRows.length > 0) {
    const { error: insertItemsError } = await supabase.from("purchase_order_items").insert(itemRows);
    if (insertItemsError) throw new Error(`Failed to insert purchase_order_items: ${insertItemsError.message}`);
  }

  return { posImported: aggregated.length, posInserted, posUpdated, itemsImported: itemRows.length, skippedRows };
}
