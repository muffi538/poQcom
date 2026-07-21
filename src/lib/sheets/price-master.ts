import { readSheetTabRaw } from "./client";

// The "EAN" tab holds several unrelated column blocks side by side, and
// reuses the header "SKU" three times in different blocks — so this reads
// raw rows and picks fixed column indices rather than keying by header
// name. The pricing block is "SKU Name, SKU, UPC, MRP, Cost Price" at
// columns 3-7. PO Value is computed from Cost Price — confirmed as the
// price the marketplace pays, not MRP.
const SKU_COLUMN_INDEX = 4;
const COST_PRICE_COLUMN_INDEX = 7;

export async function loadSkuCostPriceMap(): Promise<Map<string, number>> {
  const gid = process.env.GOOGLE_SHEET_GID_EAN;
  if (!gid) return new Map();

  const rows = await readSheetTabRaw(gid);
  const map = new Map<string, number>();
  for (const row of rows.slice(1)) {
    const sku = row[SKU_COLUMN_INDEX];
    const costPrice = Number(row[COST_PRICE_COLUMN_INDEX]);
    if (sku && Number.isFinite(costPrice)) {
      map.set(sku, costPrice);
    }
  }
  return map;
}
