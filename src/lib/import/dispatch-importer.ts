import { supabase } from "@/lib/supabase";
import { loadFieldMappings, extractRowsByHeader } from "./field-mappings";
import { toNumber } from "./parsing";
import { parseSheetDate, daysBetween } from "@/lib/po/dates";

export interface ImportDispatchResult {
  posUpdated: number;
  posNotFound: number;
}

// The Dispatch workbook ("MP Dispatched Consignment Checklist") is a
// single shared tab across every marketplace (a Marketplace column, not
// one tab per marketplace like PO/Sales) — filtered the same way
// sales-importer filters by Platform. It only ever UPDATES existing
// purchase_orders rows (matched by marketplace_id + po_number); it never
// creates POs, since a PO must already exist from the PO workbook before
// it can be dispatched. Per-SKU purchase_order_items updates are out of
// scope: the real sheet has no SKU column at all.
//
// Confirmed with the user (2026-07-23) against the real workbook, which
// has no Status/PO Date/City/SKU columns:
//   - status is set to the literal "Dispatched" for every matched row —
//     this is a "Dispatched Consignment Checklist", every listed row has
//     already left the warehouse. Not derived from dates or guessed.
//   - operational_dispatch_days = this sheet's Dispatch Date minus the
//     PO's own po_raised_date already in Supabase (from the PO workbook),
//     since the sheet has no PO Date column of its own.
//   - fill_rate is computed from this sheet's own Dispatched Qty / Appt
//     Qty (mapped as "ordered_qty" here — used only for this calculation,
//     never written to purchase_orders.ordered_qty, which stays owned by
//     the PO workbook) rather than trusting the sheet's own "Fill Rate
//     (%)" display column.
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

  // The workbook mixes every marketplace in one tab — only rows whose
  // Marketplace column matches this call's marketplace are relevant.
  // Everything else (FBA/Etrade/FBF/Retail Ez/Amazon Now/blank, none of
  // which are marketplaces this dashboard tracks) is silently ignored,
  // same as sales-importer's Platform filter.
  const hasMarketplaceMapping = byField.has("marketplace");
  const relevantRows = hasMarketplaceMapping
    ? rowsByHeader.filter((row) => get(row, "marketplace").trim().toLowerCase() === marketplaceName.trim().toLowerCase())
    : rowsByHeader;

  const lines = relevantRows.map((row) => ({
    poNo: get(row, "po_number"),
    dispatchDate: parseSheetDate(get(row, "dispatch_date")),
    dispatchedQty: toNumber(get(row, "dispatched_qty")),
    apptQty: toNumber(get(row, "ordered_qty")),
    dispatcherName: get(row, "dispatcher_name") || null,
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
    .select("id, po_number, po_raised_date")
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
    const dispatcherName = group.map((l) => l.dispatcherName).find((v) => v) ?? null;
    let dispatchedQty = 0;
    let apptQty = 0;
    for (const line of group) {
      dispatchedQty += line.dispatchedQty;
      apptQty += line.apptQty;
    }

    const fillRate = apptQty > 0 ? (dispatchedQty / apptQty) * 100 : null;
    const operationalDispatchDays =
      dispatchDate && existing.po_raised_date ? daysBetween(existing.po_raised_date, dispatchDate) : null;

    const update: Record<string, unknown> = { status: "Dispatched" };
    if (dispatchDate) update.dispatch_date = dispatchDate;
    update.dispatched_qty = dispatchedQty;
    if (fillRate !== null) update.fill_rate = Math.round(fillRate * 100) / 100;
    if (dispatcherName) update.dispatcher_name = dispatcherName;
    if (operationalDispatchDays !== null) update.operational_dispatch_days = operationalDispatchDays;

    const { error: updateError } = await supabase.from("purchase_orders").update(update).eq("id", existing.id);
    if (updateError) throw new Error(`Failed to update purchase_orders for PO ${poNo}: ${updateError.message}`);
    posUpdated++;
  }

  console.log(`[${marketplaceName}] Dispatch update: ${posUpdated} POs updated, ${posNotFound} PO number(s) not found.`);
  return { posUpdated, posNotFound };
}
