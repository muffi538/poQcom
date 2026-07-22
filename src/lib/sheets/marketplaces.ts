import { readSheetTab } from "./client";
import { loadSkuCostPriceMap } from "./price-master";
import { PurchaseOrder, PoLineItem } from "@/types/purchase-order";
import { parseSheetDate } from "@/lib/po/dates";
import {
  cityFromZeptoLocation,
  cityFromBlinkitFcName,
  cityFromInstamartFcName,
} from "@/lib/po/city";

// v1 scope: Zepto, Blinkit, Instamart only (confirmed) — BigBasket is
// structurally different (PO-per-block with SKU line items, not one row
// per PO) and is deferred until that layout is handled separately.
export const SUPPORTED_MARKETPLACES = ["Zepto", "Blinkit", "Instamart"] as const;
export type SupportedMarketplace = (typeof SUPPORTED_MARKETPLACES)[number];

interface TabConfig {
  gidEnvKey: string;
  headerRowIndex: number;
  poNoColumn: string;
  poLevelColumns: string[]; // columns that are only filled on a PO's first line
}

const TAB_CONFIG: Record<SupportedMarketplace, TabConfig> = {
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

function toLineItem(
  row: Record<string, string>,
  marketplace: SupportedMarketplace
): LineItem {
  if (marketplace === "Zepto") {
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

  const warehouse = row["FC name"] ?? "";
  return {
    poNo: row["PO No"] ?? "",
    warehouse,
    city:
      marketplace === "Blinkit" ? cityFromBlinkitFcName(warehouse) : cityFromInstamartFcName(warehouse),
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
  const gid = process.env[config.gidEnvKey];
  if (!gid) {
    throw new Error(
      `No sheet tab configured for ${marketplace}. Set ${config.gidEnvKey} in .env — see Settings.`
    );
  }

  const resolvedPriceMap = priceMap ?? (await loadSkuCostPriceMap());
  const rawRows = await readSheetTab(gid, config.headerRowIndex);
  const filledRows = forwardFillPoLevelColumns(rawRows, config.poLevelColumns);
  const lines = filledRows.map((row) => toLineItem(row, marketplace));
  // Returns every PO regardless of status — Executive Summary decides
  // which statuses count as "active" per metric (see buildExecutiveSummary).
  return aggregateLineItems(lines, marketplace, resolvedPriceMap);
}

export async function fetchAllPurchaseOrders(): Promise<PurchaseOrder[]> {
  const priceMap = await loadSkuCostPriceMap();
  const results = await Promise.all(
    SUPPORTED_MARKETPLACES.map((m) => fetchPurchaseOrders(m, priceMap))
  );
  return results.flat();
}
