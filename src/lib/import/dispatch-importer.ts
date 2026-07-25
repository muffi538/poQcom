import { supabase } from "@/lib/supabase";
import { loadFieldMappings, extractRowsByHeader } from "./field-mappings";
import { toNumber } from "./parsing";
import { parseSheetDate, parseSheetDateDayFirst, daysBetween } from "@/lib/po/dates";

export type UnmatchedReason =
  | "missing_dispatch_record" // PO missing from Dispatch Workbook entirely
  | "marketplace_mismatch" // present, but tagged under a different Marketplace
  | "duplicate_po" // appears more than once in the sheet under this marketplace
  | "case_mismatch" // present, differs from our po_number only by letter case
  | "trailing_spaces" // present, differs only by leading/trailing whitespace
  | "hidden_characters" // present, differs only by zero-width/BOM/NBSP characters
  | "formatting_mismatch"; // present and tagged correctly, but still didn't match — needs manual review

export interface UnmatchedDeliveredPo {
  poNumber: string;
  marketplace: string;
  reason: UnmatchedReason;
  detail: string;
}

export interface ImportDispatchResult {
  posUpdated: number;
  posNotFound: number;
  unmatchedDeliveredPos: UnmatchedDeliveredPo[];
}

const HIDDEN_CHAR_PATTERN = /[\u200B-\u200D\uFEFF\u00A0]/;

// Strips characters that read as blank/identical to a human but break a
// strict string match: zero-width space/joiner/non-joiner (U+200B-200D),
// BOM (U+FEFF), and non-breaking space (U+00A0) — all of which Google
// Sheets exports have been seen to leave behind on pasted PO numbers.
// Matching is also case-insensitive (see buildKey) — PO/Shipment IDs
// carry no case-sensitive meaning, so a stray case difference between
// the Shipment Tracker and the Dispatch workbook must not cause a real
// dispatch record to go unmatched.
function stripHidden(value: string): string {
  return value.replace(HIDDEN_CHAR_PATTERN, "").trim();
}

function buildKey(value: string): string {
  return stripHidden(value).toUpperCase();
}

function parseChecklistBool(value: string): boolean | null {
  const v = value.trim().toUpperCase();
  if (v === "TRUE") return true;
  if (v === "FALSE") return false;
  return null; // blank/unrecognized — never fabricated
}

// Confirmed against the live sheet (2026-07-24): its Dispatched Date
// column is NOT uniformly d/m/yyyy. Classifying every raw value showed
// 112 rows unambiguously d/m (day component >12), 54 rows unambiguously
// m/d (month-first — day component >12, meaning parseSheetDateDayFirst
// would silently return null for these), and 84 rows genuinely ambiguous
// (both components ≤12, e.g. "7/2/2026"). This is a real inconsistency
// in the source workbook (different people/locales entering dates), not
// a parsing mistake — proven by PO 48287510037612, whose "7/2/2026" read
// as d/m (Feb 7) produced a NEGATIVE fulfilment_days (-142d) against its
// own po_raised_date of 29 Jun 2026, which is impossible (a PO cannot be
// dispatched before it was raised); read as m/d (Jul 2) it's a sensible
// +3 days, consistent with every other real match in this data.
//
// Whichever interpretation is structurally valid wins outright (only one
// parser returns non-null when a component is >12). When both parse
// successfully (genuinely ambiguous), the PO's own po_raised_date — from
// the PO workbook, a different and reliably m/d/yyyy source — is used as
// an anchor to pick whichever interpretation is chronologically sensible
// (dispatch can't precede the PO being raised, and in every confirmed
// real match fulfilment lands within days/weeks, never negative or wildly
// large). This never invents a date; it only chooses between the two
// real readings of the exact same cell.
function resolveDispatchDate(rawValue: string, poRaisedDate: string | null): string | null {
  const dayFirst = parseSheetDateDayFirst(rawValue);
  const monthFirst = parseSheetDate(rawValue);

  if (dayFirst && !monthFirst) return dayFirst;
  if (monthFirst && !dayFirst) return monthFirst;
  if (!dayFirst && !monthFirst) return null;
  if (dayFirst === monthFirst) return dayFirst;

  if (!poRaisedDate || !dayFirst || !monthFirst) return dayFirst; // no anchor to disambiguate — keep the confirmed default

  const dayFirstGap = daysBetween(poRaisedDate, dayFirst);
  const monthFirstGap = daysBetween(poRaisedDate, monthFirst);
  const isSensible = (gap: number) => gap >= 0 && gap <= 180;

  if (isSensible(dayFirstGap) && !isSensible(monthFirstGap)) return dayFirst;
  if (isSensible(monthFirstGap) && !isSensible(dayFirstGap)) return monthFirst;
  if (isSensible(dayFirstGap) && isSensible(monthFirstGap)) {
    return dayFirstGap <= monthFirstGap ? dayFirst : monthFirst; // prefer the shorter, more typical fulfilment window
  }
  return dayFirst; // neither is chronologically sensible — fall back to the confirmed default rather than guessing
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
// Architectural rule (2026-07-24, replacing the old "copy a few fields,
// patch the UI to compute the rest" approach): EVERY field the Dispatch
// workbook carries for a matched consignment is written here, once, at
// sync time — dispatch_date, dispatcher_name, dispatched_from,
// appointment_qty, dispatched_qty, fill_rate, shipment_id, invoice,
// mrp_label, and fulfilment_days (computed here, never in the UI). The
// UI's only job is to read these columns.
//
// Confirmed against the real workbook, which has no Status/PO Date/City/
// SKU columns, and whose Dispatched Date column is d/m/yyyy (this
// sheet's own locale) — unlike every PO/Sales sheet, which is m/d/yyyy,
// so it needs parseSheetDateDayFirst, not parseSheetDate:
//   - fulfilment_days = this sheet's Dispatch Date minus the PO's own
//     po_raised_date already in Supabase (from the PO workbook), since
//     the sheet has no PO Date column of its own.
//   - fill_rate is computed from this sheet's own Dispatched Qty / Appt
//     Qty (mapped as "ordered_qty" here — used only for this calculation,
//     never written to purchase_orders.ordered_qty, which stays owned by
//     the PO workbook) rather than trusting the sheet's own "Fill Rate
//     (%)" display column. appointment_qty persists that same Appt
//     Quantity as its own field so the Delivered drawer/table can show
//     it without pretending it's the PO's own ordered_qty.
//   - shipment_id stores the sheet's "PO/Shipment ID" cell verbatim
//     (pre-normalization) for audit, even though it's also the join key.
//     consignment_id has no source column in the real workbook today and
//     is intentionally never written (stays null — not derived from
//     shipment_id/po_number, per "never invent values").
//   - invoice/mrp_label mirror the sheet's own Document Checklist
//     TRUE/FALSE columns; null when the cell is blank/unrecognized.
//   - driver_name enriches the same way as dispatcher_name when the
//     marketplace's mapping includes a "driver" column; null otherwise
//     (no marketplace maps one today — graceful, not fabricated).
export async function importDispatchWorkbookRows(params: {
  marketplaceId: string;
  marketplaceName: string;
  rawRows: string[][];
  // The sheet's own Marketplace column tag, when it doesn't literally
  // equal marketplaceName (confirmed real case: the Dispatch workbook
  // tags Amazon Now's rows "Amazon Now (Etrade)"). Null/undefined means
  // "match marketplaceName directly", unchanged from before this param
  // existed.
  dispatchTag?: string | null;
}): Promise<ImportDispatchResult> {
  const { marketplaceId, marketplaceName, rawRows } = params;
  const matchTag = params.dispatchTag ?? marketplaceName;

  const mappings = await loadFieldMappings(marketplaceId, "dispatch");
  // Confirmed against the real "MP Dispatched Consignment Checklist"
  // (2026-07-24): its header spans TWO rows — row 1 has group labels
  // ("Document Checklist", "Courier Detail") that, in the CSV export,
  // land in the SAME column as the group's first sub-column (e.g.
  // "Document Checklist" sits in the same cell "Invoice" occupies one
  // row down — a merged spreadsheet cell only ever exports its text into
  // its top-left column). detectHeaderRow (via extractRowsByHeader) only
  // ever reads one row, so without this merge those sub-columns are
  // silently unreachable by name — every "invoice"/"mrp_label" mapping
  // would resolve to nothing, or worse, silently collide with the group
  // label. Row 2 (the real per-column names) wins whenever it has text;
  // row 1 only fills the columns row 2 leaves blank (Dispatched Date,
  // PO/Shipment ID, Marketplace, ... — every column that has no sub-
  // header at all). This doesn't touch extractRowsByHeader itself, which
  // the PO/Sales/EAN importers also use and don't have this quirk.
  const headerRow1 = rawRows[0] ?? [];
  const headerRow2 = rawRows[1] ?? [];
  const mergedHeader = headerRow1.map((cell, i) => (headerRow2[i]?.trim() ? headerRow2[i] : cell ?? ""));
  const mergedRawRows = rawRows.length > 1 ? [mergedHeader, ...rawRows.slice(2)] : rawRows;
  const rowsByHeader = extractRowsByHeader(mergedRawRows, mappings, marketplaceName);

  const byField = new Map(mappings.map((m) => [m.ourField, m.sheetColumnName]));
  const get = (row: Record<string, string>, field: string): string => {
    const col = byField.get(field);
    return col ? row[col] ?? "" : "";
  };

  // Index of every po_number in the WHOLE sheet (every marketplace, not
  // just this call's), keyed by the match key → the set of raw
  // Marketplace tags it appears under, plus the raw (un-normalized) sheet
  // cell values seen for it. Built once per call so the post-pass below
  // can tell "genuinely absent from the Dispatch workbook" apart from
  // "present, but tagged under a different marketplace" and give a
  // precise formatting diagnosis, without a second sheet fetch.
  const hasMarketplaceMapping = byField.has("marketplace");
  const sheetPoMarketplaceTags = new Map<string, Set<string>>();
  const sheetPoOccurrences = new Map<string, number>();
  const sheetRawValuesByKey = new Map<string, Set<string>>();
  for (const row of rowsByHeader) {
    const rawPoNo = get(row, "po_number");
    const key = buildKey(rawPoNo);
    if (!key) continue;
    sheetPoOccurrences.set(key, (sheetPoOccurrences.get(key) ?? 0) + 1);
    const rawValues = sheetRawValuesByKey.get(key) ?? new Set<string>();
    rawValues.add(rawPoNo);
    sheetRawValuesByKey.set(key, rawValues);
    if (hasMarketplaceMapping) {
      const tag = get(row, "marketplace").trim();
      const tags = sheetPoMarketplaceTags.get(key) ?? new Set<string>();
      tags.add(tag || "(blank)");
      sheetPoMarketplaceTags.set(key, tags);
    }
  }

  // The workbook mixes every marketplace in one tab — only rows whose
  // Marketplace column matches this call's marketplace are relevant.
  // Everything else (FBA/Etrade/FBF/Retail Ez/Amazon Now/blank, none of
  // which are marketplaces this dashboard tracks) is silently ignored,
  // same as sales-importer's Platform filter.
  const relevantRows = hasMarketplaceMapping
    ? rowsByHeader.filter((row) => get(row, "marketplace").trim().toLowerCase() === matchTag.trim().toLowerCase())
    : rowsByHeader;

  const lines = relevantRows.map((row) => ({
    poKey: buildKey(get(row, "po_number")),
    shipmentId: get(row, "po_number").trim() || null,
    dispatchDateRaw: get(row, "dispatch_date"),
    dispatchedQty: toNumber(get(row, "dispatched_qty")),
    apptQty: toNumber(get(row, "ordered_qty")),
    dispatcherName: get(row, "dispatcher_name") || null,
    driverName: get(row, "driver") || null,
    dispatchedFrom: get(row, "dispatched_from") || null,
    invoice: byField.has("invoice") ? parseChecklistBool(get(row, "invoice")) : null,
    mrpLabel: byField.has("mrp_label") ? parseChecklistBool(get(row, "mrp_label")) : null,
  }));

  const byPoKey = new Map<string, typeof lines>();
  let lastPoKey = "";
  for (const line of lines) {
    const key = line.poKey || lastPoKey;
    if (!key) continue;
    lastPoKey = key;
    const group = byPoKey.get(key) ?? [];
    group.push(line);
    byPoKey.set(key, group);
  }

  const unmatchedDeliveredPos: UnmatchedDeliveredPo[] = [];

  // Fetch every currently-Delivered PO for this marketplace regardless of
  // whether the sheet mentions it — this is what lets the diagnostic
  // pass below reason about POs the sheet never touches at all, not just
  // ones this run happened to see. Also fetch every PO at all (not just
  // Delivered) for the actual match/update pass — a plain marketplace-
  // scoped fetch, rather than `.in("po_number", ...)`, so a stray case/
  // whitespace difference in the DB's own po_number can never cause a
  // real match to be silently skipped by the filter itself.
  const [{ data: deliveredPos, error: deliveredError }, { data: allPos, error: allPosError }] = await Promise.all([
    supabase.from("purchase_orders").select("po_number, dispatcher_name").eq("marketplace_id", marketplaceId).ilike("status", "delivered"),
    supabase.from("purchase_orders").select("id, po_number, po_raised_date").eq("marketplace_id", marketplaceId),
  ]);
  if (deliveredError) throw new Error(`Failed to load Delivered POs for dispatch diagnostics: ${deliveredError.message}`);
  if (allPosError) throw new Error(`Failed to look up purchase_orders for dispatch update: ${allPosError.message}`);

  const existingByPoKey = new Map((allPos ?? []).map((row) => [buildKey(row.po_number as string), row]));

  let posUpdated = 0;
  let posNotFound = 0;
  const touchedPoKeys = new Set<string>();

  for (const [poKey, group] of byPoKey) {
    const existing = existingByPoKey.get(poKey);
    if (!existing) {
      console.warn(`[${marketplaceName}] Dispatch update skipped: PO ${group[0]?.shipmentId ?? poKey} not found in purchase_orders.`);
      posNotFound++;
      continue;
    }
    touchedPoKeys.add(poKey);

    const dispatchDate =
      group.map((l) => resolveDispatchDate(l.dispatchDateRaw, existing.po_raised_date)).find((v) => v) ?? null;
    const dispatcherName = group.map((l) => l.dispatcherName).find((v) => v) ?? null;
    const driverName = group.map((l) => l.driverName).find((v) => v) ?? null;
    const dispatchedFrom = group.map((l) => l.dispatchedFrom).find((v) => v) ?? null;
    const shipmentId = group.map((l) => l.shipmentId).find((v) => v) ?? null;
    const invoice = group.map((l) => l.invoice).find((v) => v !== null) ?? null;
    const mrpLabel = group.map((l) => l.mrpLabel).find((v) => v !== null) ?? null;
    let dispatchedQty = 0;
    let apptQty = 0;
    for (const line of group) {
      dispatchedQty += line.dispatchedQty;
      apptQty += line.apptQty;
    }

    const fillRate = apptQty > 0 ? (dispatchedQty / apptQty) * 100 : null;
    const fulfilmentDays = dispatchDate && existing.po_raised_date ? daysBetween(existing.po_raised_date, dispatchDate) : null;

    // Enrichment-only — never touches `status` (Golden Rule #1/#4:
    // Shipment Tracker alone owns Status). Every field the sheet gives us
    // for this consignment is written here, once — the UI never
    // recomputes any of it.
    const update: Record<string, unknown> = {};
    if (dispatchDate) update.dispatch_date = dispatchDate;
    update.dispatched_qty = dispatchedQty;
    if (fillRate !== null) update.fill_rate = Math.round(fillRate * 100) / 100;
    if (apptQty > 0) update.appointment_qty = apptQty;
    if (dispatcherName) update.dispatcher_name = dispatcherName;
    if (driverName) update.driver_name = driverName;
    if (dispatchedFrom) update.dispatched_from = dispatchedFrom;
    if (shipmentId) update.shipment_id = shipmentId;
    if (invoice !== null) update.invoice = invoice;
    if (mrpLabel !== null) update.mrp_label = mrpLabel;
    if (fulfilmentDays !== null) update.fulfilment_days = fulfilmentDays;
    if (Object.keys(update).length === 0) continue;

    const { error: updateError } = await supabase.from("purchase_orders").update(update).eq("id", existing.id);
    if (updateError) throw new Error(`Failed to update purchase_orders for PO ${shipmentId ?? poKey}: ${updateError.message}`);
    posUpdated++;
  }

  // Diagnostic pass (per user request): for every Delivered PO this run
  // did not enrich — either because the sheet never mentions it, or the
  // sheet does but the fields were already filled by an earlier run —
  // classify exactly why, rather than leaving it as an unexplained blank.
  for (const po of deliveredPos ?? []) {
    const poKey = buildKey(po.po_number as string);
    if (touchedPoKeys.has(poKey)) continue; // enriched just now
    if (po.dispatcher_name) continue; // already enriched by a previous run
    unmatchedDeliveredPos.push(
      diagnoseUnmatched(po.po_number as string, marketplaceName, matchTag, sheetPoMarketplaceTags, sheetPoOccurrences, sheetRawValuesByKey, hasMarketplaceMapping)
    );
  }
  logDiagnostics(marketplaceName, unmatchedDeliveredPos);

  console.log(`[${marketplaceName}] Dispatch update: ${posUpdated} POs updated, ${posNotFound} PO number(s) not found.`);
  return { posUpdated, posNotFound, unmatchedDeliveredPos };
}

function diagnoseUnmatched(
  rawPoNumber: string,
  marketplaceName: string,
  matchTag: string,
  sheetPoMarketplaceTags: Map<string, Set<string>>,
  sheetPoOccurrences: Map<string, number>,
  sheetRawValuesByKey: Map<string, Set<string>>,
  hasMarketplaceMapping: boolean
): UnmatchedDeliveredPo {
  const key = buildKey(rawPoNumber);
  const occurrences = sheetPoOccurrences.get(key) ?? 0;
  const tags = sheetPoMarketplaceTags.get(key);
  const rawSheetValues = sheetRawValuesByKey.get(key);

  if (occurrences === 0) {
    return {
      poNumber: rawPoNumber,
      marketplace: marketplaceName,
      reason: "missing_dispatch_record",
      detail: "PO missing from Dispatch Workbook — not present anywhere in the sheet.",
    };
  }
  if (hasMarketplaceMapping && tags && !tags.has(matchTag)) {
    const expected = matchTag === marketplaceName ? `"${marketplaceName}"` : `"${matchTag}" (this marketplace's Dispatch tag)`;
    return {
      poNumber: rawPoNumber,
      marketplace: marketplaceName,
      reason: "marketplace_mismatch",
      detail: `Present in the sheet, but tagged as Marketplace = ${[...tags].join(", ")}, not ${expected}.`,
    };
  }
  if (occurrences > 1) {
    return {
      poNumber: rawPoNumber,
      marketplace: marketplaceName,
      reason: "duplicate_po",
      detail: `Duplicate PO — appears ${occurrences} times in the Dispatch workbook under this marketplace.`,
    };
  }

  // Present, correctly tagged, appears exactly once, and yet still
  // wasn't matched by buildKey (which already strips hidden characters,
  // trims, and upper-cases) — this branch should be unreachable in
  // practice, since buildKey is applied identically on both the sheet
  // and DB sides before comparison. If it's ever hit, compare the raw
  // strings directly to name the most likely residual cause rather than
  // a bare "investigate manually".
  const sheetRaw = rawSheetValues ? [...rawSheetValues][0] : "";
  if (sheetRaw) {
    if (sheetRaw !== sheetRaw.trim() || rawPoNumber !== rawPoNumber.trim()) {
      return {
        poNumber: rawPoNumber,
        marketplace: marketplaceName,
        reason: "trailing_spaces",
        detail: `Present in the sheet as "${sheetRaw}" — differs from "${rawPoNumber}" by leading/trailing whitespace.`,
      };
    }
    if (HIDDEN_CHAR_PATTERN.test(sheetRaw) || HIDDEN_CHAR_PATTERN.test(rawPoNumber)) {
      return {
        poNumber: rawPoNumber,
        marketplace: marketplaceName,
        reason: "hidden_characters",
        detail: `Present in the sheet as "${sheetRaw}" — contains hidden/invisible characters not visible in either value.`,
      };
    }
    if (sheetRaw.toUpperCase() === rawPoNumber.toUpperCase() && sheetRaw !== rawPoNumber) {
      return {
        poNumber: rawPoNumber,
        marketplace: marketplaceName,
        reason: "case_mismatch",
        detail: `Present in the sheet as "${sheetRaw}" — differs from "${rawPoNumber}" only by letter case.`,
      };
    }
  }
  return {
    poNumber: rawPoNumber,
    marketplace: marketplaceName,
    reason: "formatting_mismatch",
    detail: "Present in the sheet under this marketplace and appears once, but still didn't match — needs manual review.",
  };
}

function logDiagnostics(marketplaceName: string, unmatched: UnmatchedDeliveredPo[]): void {
  if (unmatched.length === 0) return;
  console.warn(`[${marketplaceName}] ${unmatched.length} Delivered PO(s) not enriched by this Dispatch sync:`);
  for (const u of unmatched) {
    console.warn(`  - PO ${u.poNumber} | Marketplace ${u.marketplace} | Reason: ${u.reason} — ${u.detail}`);
  }
}
