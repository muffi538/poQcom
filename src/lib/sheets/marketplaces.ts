import { readSheetTab, extractSheetId } from "./client";
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
  poLevelColumns: string[]; // columns that are only filled on a PO's first line
  // Only import POs raised in or after this year (filtered on PO Raised
  // Date, never Expiry Date). Unset = no floor, import everything — this
  // is a per-marketplace config value, not a hardcoded marketplace-name
  // check, so any marketplace's sheet can opt into it.
  minPoRaisedYear?: number;
}

export const TAB_CONFIG: Record<SupportedMarketplace, TabConfig> = {
  Zepto: {
    gidEnvKey: "GOOGLE_SHEET_GID_ZEPTO",
    headerRowIndex: 1,
    poNoColumn: "PO No.",
    poLevelColumns: ["Status", "Appointment Date", "PO Date", "Expiry date", "Del Location", "PO No.", "Dispatch Date"],
  },
  Blinkit: {
    gidEnvKey: "GOOGLE_SHEET_GID_BLINKIT",
    headerRowIndex: 2,
    poNoColumn: "PO No",
    poLevelColumns: ["Status", "Appt Date", "PO Date", "Expiry Date", "FC name", "PO No", "Dispatch Date"],
  },
  Instamart: {
    gidEnvKey: "GOOGLE_SHEET_GID_INSTAMART",
    headerRowIndex: 2,
    poNoColumn: "PO No",
    poLevelColumns: ["Status", "Appt Date", "PO Date", "Expiry Date", "FC name", "PO No", "Dispatch Date"],
  },
  // Column layout intentionally not filled in — no real sheet has been
  // inspected yet (confirmed practice for every tab in this project:
  // Zepto/Blinkit/Instamart/EAN/sales sheet were all connected only after
  // seeing real column headers, never guessed). Once the sheet is shared,
  // fill in poNoColumn/poLevelColumns/headerRowIndex the same way.
  "Flipkart Minutes": {
    gidEnvKey: "GOOGLE_SHEET_GID_FLIPKART_MINUTES",
    sheetUrlEnvKey: "FLIPKART_MINUTES_SHEET_URL",
    headerRowIndex: 0,
    poNoColumn: null,
    poLevelColumns: [],
    minPoRaisedYear: 2026,
  },
};

function num(value: string | undefined): number {
  const n = Number((value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Each PO's shared fields (Status, dates, location, PO No) are only
// entered on that PO's first line in the sheet — additional SKU line
// items below it leave those columns blank (a standard "merged cell"
// spreadsheet pattern). Forward-filling reattaches each blank line to the
// PO above it before grouping; without this, continuation lines look like
// broken, date-less POs of their own.
function forwardFillPoLevelColumns(
  rows: Record<string, string>[],
  columns: string[]
): Record<string, string>[] {
  const last: Record<string, string> = {};
  return rows.map((row) => {
    const filled = { ...row };
    for (const col of columns) {
      if (filled[col]?.trim()) {
        last[col] = filled[col];
      } else {
        filled[col] = last[col] ?? "";
      }
    }
    return filled;
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
    default:
      // fetchPurchaseOrders already refuses to reach here for a
      // marketplace whose TabConfig.poNoColumn is null — this is a
      // defensive backstop, not the primary guard.
      throw new Error(`toLineItem: no column mapping implemented for marketplace "${marketplace}".`);
  }
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
      city: first.city,
      warehouse: first.warehouse,
      sku: group.length > 1 ? `${first.sku} +${group.length - 1} more` : first.sku,
      skuDescription:
        group.length > 1 ? `${first.skuDescription} +${group.length - 1} more` : first.skuDescription,
      skus: [...new Set(group.map((line) => line.sku).filter(Boolean))],
      lineItems: [...lineItemsBySku.values()],
      poRaisedDate: first.poRaisedDate ?? "",
      expiryDate: first.expiryDate ?? "",
      appointmentDate: first.appointmentDate,
      dispatchDate: first.dispatchDate,
      orderedQty,
      dispatchedQty,
      pendingQty: Math.max(0, orderedQty - dispatchedQty),
      poValue,
      status: first.status,
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
      `${marketplace}'s sheet column layout hasn't been confirmed yet — set poNoColumn/poLevelColumns in TAB_CONFIG (src/lib/sheets/marketplaces.ts) against the real sheet before importing.`
    );
  }
  const gid = process.env[config.gidEnvKey];
  if (!gid) {
    throw new Error(
      `No sheet tab configured for ${marketplace}. Set ${config.gidEnvKey} in .env — see Settings.`
    );
  }
  const sheetIdOverride = config.sheetUrlEnvKey ? process.env[config.sheetUrlEnvKey] : undefined;
  if (config.sheetUrlEnvKey && !sheetIdOverride) {
    throw new Error(
      `No sheet configured for ${marketplace}. Set ${config.sheetUrlEnvKey} in .env — see Settings.`
    );
  }

  const resolvedPriceMap = priceMap ?? (await loadSkuCostPriceMap());
  const rawRows = await readSheetTab(
    gid,
    config.headerRowIndex,
    sheetIdOverride ? extractSheetId(sheetIdOverride) : undefined
  );
  const filledRows = forwardFillPoLevelColumns(rawRows, config.poLevelColumns);
  const lines = filledRows.map((row) => toLineItem(row, marketplace));
  // Returns every PO regardless of status — Executive Summary decides
  // which statuses count as "active" per metric (see buildExecutiveSummary).
  const purchaseOrders = aggregateLineItems(lines, marketplace, resolvedPriceMap);

  if (config.minPoRaisedYear === undefined) return purchaseOrders;

  // Year floor (confirmed, filtered on PO Raised Date, never Expiry
  // Date): a row with no parseable PO Raised Date can't be judged against
  // the floor, so it's logged and skipped rather than guessed into either
  // bucket — one bad row shouldn't stop the rest of the import.
  const floor = config.minPoRaisedYear;
  return purchaseOrders.filter((po) => {
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
