import { supabase } from "@/lib/supabase";
import { loadFieldMappings, extractRowsByHeader } from "./field-mappings";
import { toNumber } from "./parsing";
import { parseSheetDateDayFirst, daysBetween } from "@/lib/po/dates";

export interface UnmatchedDeliveredPo {
  poNumber: string;
  reason: "missing_dispatch_record" | "marketplace_mismatch" | "formatting_mismatch" | "duplicate_po";
  detail: string;
}

export interface ImportDispatchResult {
  posUpdated: number;
  posNotFound: number;
  unmatchedDeliveredPos: UnmatchedDeliveredPo[];
}

// Strips characters that read as blank/identical to a human but break a
// strict string match: zero-width space/joiner/non-joiner (U+200B-200D),
// BOM (U+FEFF), and non-breaking space (U+00A0) — all of which Google
// Sheets exports have been seen to leave behind on pasted PO numbers.
// Confirmed need: this is exactly the kind of "formatting mismatch" this
// importer must rule out before ever concluding a PO's dispatch record
// is genuinely missing.
function normalizeMatchKey(value: string): string {
  return value.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "").trim();
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
// Per the status-first architecture (PO_Operations_Architecture_1.md,
// Golden Rules #1/#4): the Shipment Tracker (PO workbook) is the ONLY
// source of truth for Status — this importer must never write it, even
// though every row in a "Dispatched Consignment Checklist" has, in
// reality, already left the warehouse. Status changes (Dispatched, In
// Transit, Delivered, ...) only ever arrive via the next PO workbook
// sync. This importer is enrichment-only against whatever status the PO
// already has.
//
// Confirmed with the user (2026-07-23) against the real workbook, which
// has no Status/PO Date/City/SKU columns, and whose Dispatched Date
// column is d/m/yyyy (this sheet's own locale) — unlike every PO/Sales
// sheet, which is m/d/yyyy, so it needs parseSheetDateDayFirst, not
// parseSheetDate:
//   - operational_dispatch_days = this sheet's Dispatch Date minus the
//     PO's own po_raised_date already in Supabase (from the PO workbook),
//     since the sheet has no PO Date column of its own.
//   - fill_rate is computed from this sheet's own Dispatched Qty / Appt
//     Qty (mapped as "ordered_qty" here — used only for this calculation,
//     never written to purchase_orders.ordered_qty, which stays owned by
//     the PO workbook) rather than trusting the sheet's own "Fill Rate
//     (%)" display column. dispatch_appt_qty persists that same Appt
//     Quantity as its own field so the Delivered drawer can show it
//     without pretending it's the PO's own ordered_qty.
//   - driver_name/dispatched_from enrich the same way as dispatcher_name
//     when the marketplace's mapping includes those columns; null when
//     it doesn't (graceful, never fabricated).
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

  // Index of every po_number in the WHOLE sheet (every marketplace, not
  // just this call's), keyed by normalized po number → the set of raw
  // Marketplace tags it appears under. Built once per call so the
  // post-pass below can tell "genuinely absent from the Dispatch
  // workbook" apart from "present, but tagged under a different
  // marketplace" without a second sheet fetch.
  const hasMarketplaceMapping = byField.has("marketplace");
  const sheetPoMarketplaceTags = new Map<string, Set<string>>();
  const sheetPoOccurrences = new Map<string, number>();
  for (const row of rowsByHeader) {
    const rawPoNo = get(row, "po_number");
    const poNo = normalizeMatchKey(rawPoNo);
    if (!poNo) continue;
    sheetPoOccurrences.set(poNo, (sheetPoOccurrences.get(poNo) ?? 0) + 1);
    if (hasMarketplaceMapping) {
      const tag = get(row, "marketplace").trim();
      const tags = sheetPoMarketplaceTags.get(poNo) ?? new Set<string>();
      tags.add(tag || "(blank)");
      sheetPoMarketplaceTags.set(poNo, tags);
    }
  }

  // The workbook mixes every marketplace in one tab — only rows whose
  // Marketplace column matches this call's marketplace are relevant.
  // Everything else (FBA/Etrade/FBF/Retail Ez/Amazon Now/blank, none of
  // which are marketplaces this dashboard tracks) is silently ignored,
  // same as sales-importer's Platform filter.
  const relevantRows = hasMarketplaceMapping
    ? rowsByHeader.filter((row) => get(row, "marketplace").trim().toLowerCase() === marketplaceName.trim().toLowerCase())
    : rowsByHeader;

  const lines = relevantRows.map((row) => ({
    poNo: normalizeMatchKey(get(row, "po_number")),
    dispatchDate: parseSheetDateDayFirst(get(row, "dispatch_date")),
    dispatchedQty: toNumber(get(row, "dispatched_qty")),
    apptQty: toNumber(get(row, "ordered_qty")),
    dispatcherName: get(row, "dispatcher_name") || null,
    driverName: get(row, "driver") || null,
    dispatchedFrom: get(row, "dispatched_from") || null,
  }));

  const byPoNo = new Map<string, typeof lines>();
  let lastPoNo = "";
  for (const line of lines) {
    const poNo = line.poNo || lastPoNo;
    if (!poNo) continue;
    lastPoNo = poNo;
    const group = byPoNo.get(poNo) ?? [];
    group.push(line);
    byPoNo.set(poNo, group);
  }

  const poNumbers = Array.from(byPoNo.keys());
  const unmatchedDeliveredPos: UnmatchedDeliveredPo[] = [];

  // Fetch every currently-Delivered PO for this marketplace regardless of
  // whether the sheet mentions it — this is what lets the diagnostic
  // pass below reason about POs the sheet never touches at all, not just
  // ones this run happened to see.
  const { data: deliveredPos, error: deliveredError } = await supabase
    .from("purchase_orders")
    .select("po_number, dispatcher_name")
    .eq("marketplace_id", marketplaceId)
    .ilike("status", "delivered");
  if (deliveredError) throw new Error(`Failed to load Delivered POs for dispatch diagnostics: ${deliveredError.message}`);

  if (poNumbers.length === 0) {
    for (const po of deliveredPos ?? []) {
      if (po.dispatcher_name) continue; // already enriched by a previous run
      unmatchedDeliveredPos.push(diagnoseUnmatched(po.po_number as string, sheetPoMarketplaceTags, sheetPoOccurrences, marketplaceName, false));
    }
    logDiagnostics(marketplaceName, unmatchedDeliveredPos);
    return { posUpdated: 0, posNotFound: 0, unmatchedDeliveredPos };
  }

  const { data: existingPos, error: fetchError } = await supabase
    .from("purchase_orders")
    .select("id, po_number, po_raised_date")
    .eq("marketplace_id", marketplaceId)
    .in("po_number", poNumbers);
  if (fetchError) throw new Error(`Failed to look up purchase_orders for dispatch update: ${fetchError.message}`);

  const existingByPoNo = new Map((existingPos ?? []).map((row) => [normalizeMatchKey(row.po_number as string), row]));

  let posUpdated = 0;
  let posNotFound = 0;
  const touchedPoNumbers = new Set<string>();

  for (const [poNo, group] of byPoNo) {
    const existing = existingByPoNo.get(poNo);
    if (!existing) {
      console.warn(`[${marketplaceName}] Dispatch update skipped: PO ${poNo} not found in purchase_orders.`);
      posNotFound++;
      continue;
    }
    touchedPoNumbers.add(poNo);

    const dispatchDate = group.map((l) => l.dispatchDate).find((v) => v) ?? null;
    const dispatcherName = group.map((l) => l.dispatcherName).find((v) => v) ?? null;
    const driverName = group.map((l) => l.driverName).find((v) => v) ?? null;
    const dispatchedFrom = group.map((l) => l.dispatchedFrom).find((v) => v) ?? null;
    let dispatchedQty = 0;
    let apptQty = 0;
    for (const line of group) {
      dispatchedQty += line.dispatchedQty;
      apptQty += line.apptQty;
    }

    const fillRate = apptQty > 0 ? (dispatchedQty / apptQty) * 100 : null;
    const operationalDispatchDays =
      dispatchDate && existing.po_raised_date ? daysBetween(existing.po_raised_date, dispatchDate) : null;

    // Enrichment-only — never touches `status` (Golden Rule #1/#4:
    // Shipment Tracker alone owns Status).
    const update: Record<string, unknown> = {};
    if (dispatchDate) update.dispatch_date = dispatchDate;
    update.dispatched_qty = dispatchedQty;
    if (fillRate !== null) update.fill_rate = Math.round(fillRate * 100) / 100;
    if (apptQty > 0) update.dispatch_appt_qty = apptQty;
    if (dispatcherName) update.dispatcher_name = dispatcherName;
    if (driverName) update.driver_name = driverName;
    if (dispatchedFrom) update.dispatched_from = dispatchedFrom;
    if (operationalDispatchDays !== null) update.operational_dispatch_days = operationalDispatchDays;
    if (Object.keys(update).length === 0) continue;

    const { error: updateError } = await supabase.from("purchase_orders").update(update).eq("id", existing.id);
    if (updateError) throw new Error(`Failed to update purchase_orders for PO ${poNo}: ${updateError.message}`);
    posUpdated++;
  }

  // Diagnostic pass (per user request): for every Delivered PO this run
  // did not enrich — either because the sheet never mentions it, or the
  // sheet does but the fields were already filled by an earlier run —
  // classify exactly why, rather than leaving it as an unexplained blank.
  for (const po of deliveredPos ?? []) {
    const poNo = normalizeMatchKey(po.po_number as string);
    if (touchedPoNumbers.has(poNo)) continue; // enriched just now
    if (po.dispatcher_name) continue; // already enriched by a previous run
    unmatchedDeliveredPos.push(diagnoseUnmatched(po.po_number as string, sheetPoMarketplaceTags, sheetPoOccurrences, marketplaceName, hasMarketplaceMapping));
  }
  logDiagnostics(marketplaceName, unmatchedDeliveredPos);

  console.log(`[${marketplaceName}] Dispatch update: ${posUpdated} POs updated, ${posNotFound} PO number(s) not found.`);
  return { posUpdated, posNotFound, unmatchedDeliveredPos };
}

function diagnoseUnmatched(
  rawPoNumber: string,
  sheetPoMarketplaceTags: Map<string, Set<string>>,
  sheetPoOccurrences: Map<string, number>,
  marketplaceName: string,
  hasMarketplaceMapping: boolean
): UnmatchedDeliveredPo {
  const poNo = normalizeMatchKey(rawPoNumber);
  const occurrences = sheetPoOccurrences.get(poNo) ?? 0;
  const tags = sheetPoMarketplaceTags.get(poNo);

  if (occurrences === 0) {
    return { poNumber: rawPoNumber, reason: "missing_dispatch_record", detail: "Not present anywhere in the Dispatch workbook." };
  }
  if (hasMarketplaceMapping && tags && !tags.has(marketplaceName)) {
    return {
      poNumber: rawPoNumber,
      reason: "marketplace_mismatch",
      detail: `Present in the sheet, but tagged as Marketplace = ${[...tags].join(", ")}, not "${marketplaceName}".`,
    };
  }
  if (occurrences > 1) {
    return {
      poNumber: rawPoNumber,
      reason: "duplicate_po",
      detail: `Appears ${occurrences} times in the Dispatch workbook under this marketplace — check for conflicting rows.`,
    };
  }
  // Present, correctly tagged, appears exactly once, yet still didn't
  // update — the only remaining explanation is a residual formatting
  // difference normalizeMatchKey doesn't strip (e.g. a different
  // invisible character, or the PO number embedded with extra text).
  return {
    poNumber: rawPoNumber,
    reason: "formatting_mismatch",
    detail: "Present in the sheet under this marketplace and appears once, but still didn't match — check for stray characters in the PO number.",
  };
}

function logDiagnostics(marketplaceName: string, unmatched: UnmatchedDeliveredPo[]): void {
  if (unmatched.length === 0) return;
  console.warn(`[${marketplaceName}] ${unmatched.length} Delivered PO(s) not enriched by this Dispatch sync:`);
  for (const u of unmatched) {
    console.warn(`  - ${u.poNumber}: [${u.reason}] ${u.detail}`);
  }
}
