import { readSheetTab, readSheetTabRaw, extractSheetId } from "./client";
import { loadSkuCostPriceMap } from "./price-master";
import { PurchaseOrder, PoLineItem } from "@/types/purchase-order";
import { parseSheetDate } from "@/lib/po/dates";
import {
  cityFromZeptoLocation,
  cityFromBlinkitFcName,
  cityFromInstamartFcName,
} from "@/lib/po/city";

// Flipkart Minutes added alongside Zepto/Blinkit/Instamart (confirmed:
// behaves identically — same status routing, same priority engine, same
// dashboard). BigBasket remains out of scope: its sheet tab is
// structurally different (PO-per-block with SKU line items, not one row
// per PO) and needs its own parser before it can be added back.
export const SUPPORTED_MARKETPLACES = ["Zepto", "Blinkit", "Instamart", "Flipkart Minutes"] as const;
export type SupportedMarketplace = (typeof SUPPORTED_MARKETPLACES)[number];

export interface TabConfig {
  gidEnvKey: string;
  // Set only when this marketplace's data lives in a different workbook
  // than the shared GOOGLE_SHEET_URL (confirmed future-proofing — not
  // every marketplace has to share one sheet). Falls back to the shared
  // sheet when unset.
  sheetUrlEnvKey?: string;
  headerRowIndex: number;
  // null = this tab's column layout hasn't been confirmed against a real
  // sheet yet — fetchPurchaseOrders refuses to guess and throws a clear
  // error instead of silently mis-parsing (see the toLineItem dispatch
  // below, which used to fall through to Instamart's city parser for any
  // unrecognized marketplace — exactly the kind of silent wrong-data bug
  // this guards against).
  poNoColumn: string | null;
  // Only import POs raised in or after this year (filtered on PO Raised
  // Date, never Expiry Date). Unset = no floor, import everything — this
  // is a per-marketplace config value, not a hardcoded marketplace-name
  // check, so any marketplace's sheet can opt into it.
  minPoRaisedYear?: number;
  // When set, headerRowIndex is ignored and the header row is instead
  // found by scanning for whichever row contains all of requiredColumns —
  // so a sheet's cosmetic title rows (e.g. a merged "Flipkart Minutes"
  // banner row) don't need a hardcoded row-offset number. Throws a clear
  // "missing column X" error rather than guessing if a required column
  // genuinely isn't in the detected header row.
  autoDetectHeader?: boolean;
  requiredColumns?: string[];
}

export const TAB_CONFIG: Record<SupportedMarketplace, TabConfig> = {
  Zepto: {
    gidEnvKey: "GOOGLE_SHEET_GID_ZEPTO",
    headerRowIndex: 1,
    poNoColumn: "PO No.",
  },
  Blinkit: {
    gidEnvKey: "GOOGLE_SHEET_GID_BLINKIT",
    headerRowIndex: 2,
    poNoColumn: "PO No",
  },
  Instamart: {
    gidEnvKey: "GOOGLE_SHEET_GID_INSTAMART",
    headerRowIndex: 2,
    poNoColumn: "PO No",
  },
  // Column mapping confirmed against the real sheet (2026-07): a merged
  // "Flipkart Minutes" title row sits above the real header, at an
  // unspecified/variable offset, so headerRowIndex isn't used here —
  // autoDetectHeader scans for it instead (see detectHeaderRow below).
  "Flipkart Minutes": {
    gidEnvKey: "GOOGLE_SHEET_GID_FLIPKART_MINUTES",
    sheetUrlEnvKey: "FLIPKART_MINUTES_SHEET_URL",
    headerRowIndex: 0,
    poNoColumn: "PO number",
    minPoRaisedYear: 2026,
    autoDetectHeader: true,
    requiredColumns: [
      "Status",
      "PO number",
      "PO IssueDate",
      "Expiry Date",
      "City",
      "Location",
      "Total PO Qty",
      "FSN",
    ],
  },
};

function num(value: string | undefined): number {
  const n = Number((value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Scans the first few rows for whichever one contains every required
// column name exactly — so a sheet's merged/cosmetic title row above the
// real header doesn't need a hardcoded row-offset number (confirmed
// requirement: "do not hardcode row numbers", "detect columns using the
// header names"). Throws naming exactly which required column is
// missing, rather than silently parsing the wrong row as if it were the
// header.
function detectHeaderRow(
  rows: string[][],
  requiredColumns: string[],
  marketplace: string,
  scanLimit = 20
): { headerRowIndex: number; header: string[] } {
  const limit = Math.min(scanLimit, rows.length);
  let bestIndex = -1;
  let bestMatchCount = -1;
  for (let i = 0; i < limit; i++) {
    const matchCount = requiredColumns.filter((col) => rows[i].includes(col)).length;
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestIndex = i;
    }
  }
  if (bestIndex === -1) {
    throw new Error(`${marketplace}: sheet appears to be empty — no header row found.`);
  }

  const header = rows[bestIndex];
  const missing = requiredColumns.filter((col) => !header.includes(col));
  if (missing.length > 0) {
    throw new Error(
      `${marketplace}: required column(s) not found in the sheet: ${missing.join(", ")}. ` +
        `Closest header row (row ${bestIndex + 1}) contains: ${header.filter(Boolean).join(", ")}.`
    );
  }
  return { headerRowIndex: bestIndex, header };
}

// Each PO's SKU line items are only entered with a PO Number on the
// sheet's own terms — some sheets blank it out on continuation rows
// (Zepto/Blinkit/Instamart), so this fills it forward before grouping;
// without this, continuation lines would have no PO Number to group by
// and get silently dropped (aggregateLineItems skips poNo-less lines).
//
// This ONLY forward-fills the grouping key, deliberately not the other
// PO-level fields (Status, dates, City, Location, ...) anymore — a
// previous version forward-filled those too, assuming the row carrying
// their real values was always the group's FIRST row. That's true for
// Zepto/Blinkit/Instamart, but not guaranteed in general: a merged cell
// can visually/structurally anchor its value to ANY row in the block
// (seen on Flipkart Minutes — Status was only genuinely populated on one
// row in the middle of a multi-line PO, so forward-fill alone could
// never backfill the earlier rows, which come before it in the file).
// aggregateLineItems now resolves each PO-level field by scanning the
// WHOLE group for the first non-blank value instead, which is correct
// regardless of which row happens to carry the real data.
function forwardFillPoNumber(rows: Record<string, string>[], poNoColumn: string): Record<string, string>[] {
  let last = "";
  return rows.map((row) => {
    const raw = row[poNoColumn]?.trim();
    if (raw) last = raw;
    return { ...row, [poNoColumn]: raw || last };
  });
}

interface LineItem {
  poNo: string;
  city: string;
  warehouse: string;
  sku: string;
  skuDescription: string;
  poRaisedDate: string | null;
  expiryDate: string | null;
  appointmentDate: string | null;
  dispatchDate: string | null;
  orderedQty: number;
  dispatchedQty: number;
  status: string;
  // Flipkart Minutes only ("Frido Dispatch WH" — which of Frido's own
  // warehouses fulfills this PO, distinct from `warehouse`/City which are
  // the marketplace's destination FC). Not modeled on the shared
  // PurchaseOrder type since no other marketplace has this concept;
  // carried through in `raw.lineItems` for now.
  dispatchWarehouse?: string;
}

// Exhaustive per-marketplace dispatch (confirmed fix: this used to be an
// if/else-fallthrough where any marketplace that wasn't "Zepto" landed in
// a shared Blinkit/Instamart-shaped branch — harmless while there were
// only 3, but a 4th marketplace with its own column layout would have
// silently been parsed as if it were Instamart, producing wrong cities/
// PO numbers/dates with no error at all). Every case must be handled
// explicitly here; the default throws instead of guessing.
function toLineItem(
  row: Record<string, string>,
  marketplace: SupportedMarketplace
): LineItem {
  switch (marketplace) {
    case "Zepto": {
      const warehouse = row["Del Location"] ?? "";
      return {
        poNo: row["PO No."] ?? "",
        warehouse,
        city: cityFromZeptoLocation(warehouse),
        sku: row["SKU"] ?? "",
        skuDescription: row["SKU Desc"] ?? "",
        poRaisedDate: parseSheetDate(row["PO Date"]),
        expiryDate: parseSheetDate(row["Expiry date"]),
        appointmentDate: parseSheetDate(row["Appointment Date"]),
        dispatchDate: parseSheetDate(row["Dispatch Date"]),
        orderedQty: num(row["Qty"]),
        dispatchedQty: 0, // Zepto's tab doesn't track dispatched qty separately
        status: row["Status"] ?? "",
      };
    }
    case "Blinkit":
    case "Instamart": {
      const warehouse = row["FC name"] ?? "";
      return {
        poNo: row["PO No"] ?? "",
        warehouse,
        city: marketplace === "Blinkit" ? cityFromBlinkitFcName(warehouse) : cityFromInstamartFcName(warehouse),
        sku: row["SKU"] ?? "",
        skuDescription: row["Name"] ?? "",
        poRaisedDate: parseSheetDate(row["PO Date"]),
        expiryDate: parseSheetDate(row["Expiry Date"]),
        appointmentDate: parseSheetDate(row["Appt Date"]),
        dispatchDate: parseSheetDate(row["Dispatch Date"]),
        orderedQty: num(row["PO Qty"]),
        dispatchedQty: num(row["Dispatched Qty"]),
        status: row["Status"] ?? "",
      };
    }
    case "Flipkart Minutes": {
      // Sheet provides City directly (unlike the other three, which
      // derive it from a location/FC code) — no city-parser needed.
      const warehouse = row["Location"] ?? "";
      return {
        poNo: row["PO number"] ?? "",
        warehouse,
        city: row["City"] ?? "",
        sku: row["FSN"] ?? "",
        skuDescription: "", // no separate product-name/description column in this sheet
        poRaisedDate: parseSheetDate(row["PO IssueDate"]),
        expiryDate: parseSheetDate(row["Expiry Date"]),
        appointmentDate: parseSheetDate(row["Scheduled Date"]),
        dispatchDate: null, // no Dispatch Date column in this sheet
        orderedQty: num(row["Total PO Qty"]),
        dispatchedQty: 0, // no Dispatched Qty column in this sheet
        status: row["Status"] ?? "",
        dispatchWarehouse: row["Frido Dispatch WH"] || undefined,
      };
    }
    default:
      // fetchPurchaseOrders already refuses to reach here for a
      // marketplace whose TabConfig.poNoColumn is null — this is a
      // defensive backstop, not the primary guard.
      throw new Error(`toLineItem: no column mapping implemented for marketplace "${marketplace}".`);
  }
}

// Picks the first non-blank value for a PO-level field across an entire
// line-item group, rather than trusting group[0] ("first"). A merged
// cell's real value can be exported anchored to ANY row within its block
// — not necessarily the first (confirmed on Flipkart Minutes: Status was
// only genuinely populated on one row in the middle of a multi-line PO) —
// so this must be position-independent to be correct for every sheet.
function firstNonBlank<T extends string | null>(group: LineItem[], select: (line: LineItem) => T): T {
  for (const line of group) {
    const value = select(line);
    if (value !== null && value !== "") return value;
  }
  return select(group[0]);
}

// Groups SKU line items back up into one row per PO Number (confirmed
// approach, matching the BigBasket PO-level-aggregation decision), summing
// quantities/value across lines and keeping the shared PO-level fields.
function aggregateLineItems(
  lines: LineItem[],
  marketplace: SupportedMarketplace,
  priceMap: Map<string, number>
): PurchaseOrder[] {
  const byPoNo = new Map<string, LineItem[]>();
  for (const line of lines) {
    if (!line.poNo) continue; // no PO No at all (blank leading rows) — nothing to attach to
    const group = byPoNo.get(line.poNo) ?? [];
    group.push(line);
    byPoNo.set(line.poNo, group);
  }

  const purchaseOrders: PurchaseOrder[] = [];
  for (const [poNo, group] of byPoNo) {
    const first = group[0];
    const city = firstNonBlank(group, (l) => l.city);
    const warehouse = firstNonBlank(group, (l) => l.warehouse);
    const status = firstNonBlank(group, (l) => l.status);
    const poRaisedDate = firstNonBlank(group, (l) => l.poRaisedDate);
    const expiryDate = firstNonBlank(group, (l) => l.expiryDate);
    const appointmentDate = firstNonBlank(group, (l) => l.appointmentDate);
    const dispatchDate = firstNonBlank(group, (l) => l.dispatchDate);
    let orderedQty = 0;
    let dispatchedQty = 0;
    let poValue: number | null = 0;
    let hasKnownPrice = false;

    for (const line of group) {
      orderedQty += line.orderedQty;
      dispatchedQty += line.dispatchedQty;
      const costPrice = priceMap.get(line.sku);
      if (costPrice !== undefined) {
        poValue = (poValue ?? 0) + line.orderedQty * costPrice;
        hasKnownPrice = true;
      }
    }
    if (!hasKnownPrice) poValue = null;

    // Per-SKU line items (distinct from the group above — a PO can list
    // the same SKU on more than one row) needed for Demand Intelligence's
    // per-SKU pending qty, not just this PO's total.
    const lineItemsBySku = new Map<string, PoLineItem>();
    for (const line of group) {
      if (!line.sku) continue;
      const existing = lineItemsBySku.get(line.sku);
      if (existing) {
        existing.orderedQty += line.orderedQty;
        existing.dispatchedQty += line.dispatchedQty;
        existing.pendingQty = Math.max(0, existing.orderedQty - existing.dispatchedQty);
      } else {
        lineItemsBySku.set(line.sku, {
          sku: line.sku,
          skuDescription: line.skuDescription,
          orderedQty: line.orderedQty,
          dispatchedQty: line.dispatchedQty,
          pendingQty: Math.max(0, line.orderedQty - line.dispatchedQty),
        });
      }
    }

    purchaseOrders.push({
      id: poNo,
      marketplace,
      city,
      warehouse,
      sku: group.length > 1 ? `${first.sku} +${group.length - 1} more` : first.sku,
      skuDescription:
        group.length > 1 ? `${first.skuDescription} +${group.length - 1} more` : first.skuDescription,
      skus: [...new Set(group.map((line) => line.sku).filter(Boolean))],
      lineItems: [...lineItemsBySku.values()],
      poRaisedDate: poRaisedDate ?? "",
      expiryDate: expiryDate ?? "",
      appointmentDate,
      dispatchDate,
      orderedQty,
      dispatchedQty,
      pendingQty: Math.max(0, orderedQty - dispatchedQty),
      poValue,
      status,
      raw: { lineItems: group },
    });
  }

  return purchaseOrders;
}

export async function fetchPurchaseOrders(
  marketplace: SupportedMarketplace,
  priceMap?: Map<string, number>
): Promise<PurchaseOrder[]> {
  const config = TAB_CONFIG[marketplace];
  if (config.poNoColumn === null) {
    throw new Error(
      `${marketplace}'s sheet column layout hasn't been confirmed yet — set poNoColumn (and, if needed, autoDetectHeader/requiredColumns) in TAB_CONFIG (src/lib/sheets/marketplaces.ts) against the real sheet before importing.`
    );
  }
  const gid = process.env[config.gidEnvKey];
  if (!gid) {
    throw new Error(
      `No sheet tab configured for ${marketplace}. Set ${config.gidEnvKey} in .env — see Settings.`
    );
  }
  // sheetUrlEnvKey is an optional override, not a requirement — when it's
  // declared on a marketplace's config but the env var itself isn't set,
  // that marketplace simply lives in the shared GOOGLE_SHEET_URL workbook
  // (readSheetTab already falls back to it when no override is passed).
  const sheetIdOverride = config.sheetUrlEnvKey ? process.env[config.sheetUrlEnvKey] : undefined;

  const resolvedPriceMap = priceMap ?? (await loadSkuCostPriceMap());
  const sheetId = sheetIdOverride ? extractSheetId(sheetIdOverride) : undefined;

  let rawRows: Record<string, string>[];
  if (config.autoDetectHeader) {
    const allRows = await readSheetTabRaw(gid, sheetId);
    const { headerRowIndex, header } = detectHeaderRow(
      allRows,
      config.requiredColumns ?? [],
      marketplace
    );
    rawRows = allRows
      .slice(headerRowIndex + 1)
      .map((row) => Object.fromEntries(header.map((col, i) => [col, row[i] ?? ""])));
  } else {
    rawRows = await readSheetTab(gid, config.headerRowIndex, sheetId);
  }

  const filledRows = forwardFillPoNumber(rawRows, config.poNoColumn);
  const lines = filledRows.map((row) => toLineItem(row, marketplace));
  // Returns every PO regardless of status — Executive Summary decides
  // which statuses count as "active" per metric (see buildExecutiveSummary).
  let purchaseOrders = aggregateLineItems(lines, marketplace, resolvedPriceMap);

  if (config.minPoRaisedYear !== undefined) {
    // Year floor (confirmed, filtered on PO Raised Date, never Expiry
    // Date): a row with no parseable PO Raised Date can't be judged
    // against the floor, so it's logged and skipped rather than guessed
    // into either bucket — one bad row shouldn't stop the rest of the
    // import.
    const floor = config.minPoRaisedYear;
    purchaseOrders = purchaseOrders.filter((po) => {
      if (!po.poRaisedDate) {
        console.warn(`[${marketplace}] Skipping PO ${po.id}: no parseable PO Raised Date.`);
        return false;
      }
      const year = Number(po.poRaisedDate.slice(0, 4));
      if (!Number.isFinite(year)) {
        console.warn(`[${marketplace}] Skipping PO ${po.id}: unparseable PO Raised Date "${po.poRaisedDate}".`);
        return false;
      }
      return year >= floor;
    });
  }

  // Import-time sanity log (generic — runs for every marketplace, not
  // just the newly-connected one, so it's a standing diagnostic rather
  // than a one-off check): total POs/product rows parsed, plus counts for
  // the three statuses most likely to reveal a broken import (nothing
  // Pending = priority engine has nothing to rank; nothing Delivered/
  // Cancelled on an established sheet may mean Status isn't matching).
  const statusCount = (needle: string) =>
    purchaseOrders.filter((po) => po.status.trim().toLowerCase() === needle).length;
  console.log(
    `[${marketplace}] Parsed ${purchaseOrders.length} POs from ${lines.length} product rows — ` +
      `Pending: ${statusCount("pending")}, Delivered: ${statusCount("delivered")}, Cancelled: ${
        statusCount("cancel") + statusCount("cancelled")
      }.`
  );

  return purchaseOrders;
}

// One unconfigured or not-yet-connected marketplace (e.g. Flipkart
// Minutes before its sheet is wired up) shouldn't take the whole Overview
// page down for the marketplaces that DO work — each marketplace fetches
// independently and a failure degrades to "no data from this one" rather
// than failing the aggregate.
export async function fetchAllPurchaseOrders(): Promise<PurchaseOrder[]> {
  const priceMap = await loadSkuCostPriceMap();
  const results = await Promise.allSettled(
    SUPPORTED_MARKETPLACES.map((m) => fetchPurchaseOrders(m, priceMap))
  );
  const purchaseOrders: PurchaseOrder[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      purchaseOrders.push(...result.value);
    } else {
      console.warn(`[${SUPPORTED_MARKETPLACES[i]}] Excluded from Overview:`, result.reason);
    }
  });
  return purchaseOrders;
}
