import { readSheetRange } from "./client";
import { PurchaseOrder } from "@/types/purchase-order";

// Which env var holds the range for a given marketplace tab. Left blank
// until the sheet's real tab layout is confirmed (single tab with a
// Marketplace column vs. one tab per marketplace — see open questions).
const RANGE_ENV_BY_MARKETPLACE: Record<string, string> = {
  Zepto: "GOOGLE_SHEET_RANGE_ZEPTO",
  Blinkit: "GOOGLE_SHEET_RANGE_BLINKIT",
  Instamart: "GOOGLE_SHEET_RANGE_INSTAMART",
  BigBasket: "GOOGLE_SHEET_RANGE_BIGBASKET",
};

// Maps a raw sheet row (header -> string value) to the normalized
// PurchaseOrder shape. Column names below are placeholders — swap them for
// the real headers once the sheet's structure is confirmed.
function normalizeRow(row: Record<string, string>, marketplace: string): PurchaseOrder {
  return {
    id: row["PO Number"] ?? row["PO ID"] ?? "",
    marketplace,
    city: row["City"] ?? "",
    warehouse: row["Warehouse"] ?? "",
    supplier: row["Supplier"] ?? "",
    poRaisedDate: row["PO Raised Date"] ?? "",
    expiryDate: row["Expiry Date"] ?? "",
    appointmentDate: row["Appointment Date"] || null,
    dispatchDate: row["Dispatch Date"] || null,
    poValue: Number(row["PO Value"] ?? 0),
    pendingQty: Number(row["Pending Qty"] ?? 0),
    orderedQty: Number(row["Ordered Qty"] ?? 0),
    inventoryAvailable: Number(row["Inventory Available"] ?? 0),
    status: (row["Status"] as PurchaseOrder["status"]) ?? "Open",
    raw: row,
  };
}

export async function fetchPurchaseOrders(marketplace: string): Promise<PurchaseOrder[]> {
  const rangeEnvKey = RANGE_ENV_BY_MARKETPLACE[marketplace];
  const range = (rangeEnvKey && process.env[rangeEnvKey]) || process.env.GOOGLE_SHEET_RANGE_ALL;
  if (!range) {
    throw new Error(
      `No sheet range configured for "${marketplace}". Set GOOGLE_SHEET_RANGE_ALL or the marketplace-specific range in .env.`
    );
  }
  const rows = await readSheetRange(range);
  const normalized = rows.map((r) => normalizeRow(r, marketplace));
  return process.env[rangeEnvKey] ? normalized : normalized.filter((po) => po.marketplace === marketplace);
}

export async function fetchAllPurchaseOrders(marketplaces: string[]): Promise<PurchaseOrder[]> {
  const results = await Promise.all(marketplaces.map(fetchPurchaseOrders));
  return results.flat();
}
