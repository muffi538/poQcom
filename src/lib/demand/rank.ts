import { SalesRow } from "@/lib/sheets/sales";
import { SUPPORTED_MARKETPLACES, SupportedMarketplace } from "@/lib/sheets/marketplaces";

export interface DemandSkuStats {
  rank: number; // 1 = highest GMV for this marketplace
  gmv: number;
  units: number;
}

// Marketplace -> Master SKU -> that SKU's demand rank/stats within that
// marketplace's own sales data only (confirmed: never compare Zepto POs
// against Blinkit sales — a separate map per marketplace, no cross-
// marketplace ranking at all).
export type DemandIndex = Map<SupportedMarketplace, Map<string, DemandSkuStats>>;

function normalizePlatform(platform: string): SupportedMarketplace | null {
  const match = SUPPORTED_MARKETPLACES.find(
    (m) => m.toLowerCase() === platform.trim().toLowerCase()
  );
  return match ?? null;
}

// Rank -> score-per-SKU tiered bands (confirmed). Summed across every SKU
// on a PO (confirmed: "the more top-performing SKUs, the higher the
// score", not a single best-SKU-wins rule).
export function scoreForRank(rank: number): number {
  if (rank <= 5) return 25;
  if (rank <= 15) return 15;
  if (rank <= 30) return 10;
  if (rank <= 50) return 5;
  return 0;
}

// Builds the per-marketplace demand rank index from the raw sales rows.
// Duplicate (platform, Master SKU) rows in the sheet (confirmed present —
// 56/144 combos on the sample data) are summed before ranking, so a SKU
// split across multiple rows isn't under-counted against single-row SKUs.
export function buildDemandIndex(rows: SalesRow[]): DemandIndex {
  const aggregated = new Map<SupportedMarketplace, Map<string, { gmv: number; units: number }>>();

  for (const row of rows) {
    const marketplace = normalizePlatform(row.platform);
    if (!marketplace) continue; // Amazon Now / BB Now / etc. — out of scope

    const bySku = aggregated.get(marketplace) ?? new Map<string, { gmv: number; units: number }>();
    const existing = bySku.get(row.masterSku) ?? { gmv: 0, units: 0 };
    bySku.set(row.masterSku, { gmv: existing.gmv + row.gmv, units: existing.units + row.units });
    aggregated.set(marketplace, bySku);
  }

  const index: DemandIndex = new Map();
  for (const marketplace of SUPPORTED_MARKETPLACES) {
    const bySku = aggregated.get(marketplace);
    if (!bySku) {
      index.set(marketplace, new Map());
      continue;
    }

    const ranked = [...bySku.entries()].sort((a, b) => b[1].gmv - a[1].gmv);
    const skuMap = new Map<string, DemandSkuStats>();
    ranked.forEach(([sku, stats], i) => {
      skuMap.set(sku, { rank: i + 1, gmv: stats.gmv, units: stats.units });
    });
    index.set(marketplace, skuMap);
  }

  return index;
}
