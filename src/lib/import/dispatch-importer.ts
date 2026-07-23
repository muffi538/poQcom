import { supabase } from "@/lib/supabase";
import { loadFieldMappings, extractRowsByHeader } from "./field-mappings";
import { toNumber, normalizeStatus } from "./parsing";
import { parseSheetDate } from "@/lib/po/dates";

export interface ImportDispatchResult {
  posUpdated: number;
  posNotFound: number;
}

// The Dispatch workbook only ever UPDATES existing purchase_orders rows
// (matched by marketplace_id + po_number) — it never creates POs, since a
// PO must already exist from the PO workbook before it can be dispatched.
// Per-SKU purchase_order_items dispatch updates are deliberately out of
// scope here: there's no safe unique key on (purchase_order_id, sku) to
// upsert against without a confirmed real Dispatch sheet shape, so this
// stays PO-header-level only until that's known.
export async function importDispatchWorkbookRows(params: {
  marketplaceId: string;
  marketplaceName: string;
  rawRows: string[][];
}): Promise<ImportDispatchResult> {
  const { marketplaceId, marketplaceName, rawRows } = params;

  const mappings = await loadFieldMappings(marketplaceId, "dispatch");
  const rowsByHeader = extractRowsByHeader(rawRows, mappings, marketplaceName);

  const byField = new Map(mappings.map((m) => [m.ourField, m.sheetColumnName]));
  const get = (row: Record<string, string>, field: string): string => {
    const col = byField.get(field);
    return col ? row[col] ?? "" : "";
  };

  const lines = rowsByHeader.map((row) => ({
    poNo: get(row, "po_number"),
    status: get(row, "status"),
    dispatchDate: parseSheetDate(get(row, "dispatch_date")),
    dispatchedQty: toNumber(get(row, "dispatched_qty")),
  }));

  const byPoNo = new Map<string, typeof lines>();
  let lastPoNo = "";
  for (const line of lines) {
    const poNo = line.poNo.trim() || lastPoNo;
    if (!poNo) continue;
    lastPoNo = poNo;
    const group = byPoNo.get(poNo) ?? [];
    group.push(line);
    byPoNo.set(poNo, group);
  }

  const poNumbers = Array.from(byPoNo.keys());
  if (poNumbers.length === 0) return { posUpdated: 0, posNotFound: 0 };

  const { data: existingPos, error: fetchError } = await supabase
    .from("purchase_orders")
    .select("id, po_number, ordered_qty")
    .eq("marketplace_id", marketplaceId)
    .in("po_number", poNumbers);
  if (fetchError) throw new Error(`Failed to look up purchase_orders for dispatch update: ${fetchError.message}`);

  const existingByPoNo = new Map((existingPos ?? []).map((row) => [row.po_number as string, row]));

  let posUpdated = 0;
  let posNotFound = 0;

  for (const [poNo, group] of byPoNo) {
    const existing = existingByPoNo.get(poNo);
    if (!existing) {
      console.warn(`[${marketplaceName}] Dispatch update skipped: PO ${poNo} not found in purchase_orders.`);
      posNotFound++;
      continue;
    }

    const dispatchDate = group.map((l) => l.dispatchDate).find((v) => v) ?? null;
    const rawStatus = group.map((l) => l.status).find((v) => v.trim()) ?? "";
    let dispatchedQty = 0;
    for (const line of group) dispatchedQty += line.dispatchedQty;

    const update: Record<string, unknown> = {};
    if (dispatchDate) update.dispatch_date = dispatchDate;
    if (dispatchedQty > 0) update.dispatched_qty = Math.min(dispatchedQty, existing.ordered_qty);
    if (rawStatus.trim()) update.status = normalizeStatus(rawStatus, poNo, marketplaceName);

    if (Object.keys(update).length === 0) continue;

    const { error: updateError } = await supabase.from("purchase_orders").update(update).eq("id", existing.id);
    if (updateError) throw new Error(`Failed to update purchase_orders for PO ${poNo}: ${updateError.message}`);
    posUpdated++;
  }

  console.log(`[${marketplaceName}] Dispatch update: ${posUpdated} POs updated, ${posNotFound} PO number(s) not found.`);
  return { posUpdated, posNotFound };
}
