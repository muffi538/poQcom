import { SalesRow } from "@/lib/sheets/sales";
import { SUPPORTED_MARKETPLACES, SupportedMarketplace } from "@/lib/sheets/marketplaces";

export interface DemandSkuStats {
  rank: number; // 1 = highest GMV for this marketplace
  gmv: number;
  units: number;
  product: string; // first-seen product name for this SKU in the sheet (variants can differ slightly across duplicate rows)
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

// Bar for the visible "High Demand" badge/filter (UI-only distinction —
// scoring above is unaffected). With a marketplace catalog as small as
// Zepto's (~57 SKUs), "rank <= 50" covers nearly every SKU that has any
// sales data at all, so gating the badge on that would flag ~100% of POs
// and say nothing. Rank <= 15 (the two highest-value tiers, +25/+15)
// keeps the badge meaning "a genuine top seller," not "appears anywhere
// in the sheet."
export const HIGH_DEMAND_RANK_THRESHOLD = 15;

// Builds the per-marketplace demand rank index from the raw sales rows.
// Duplicate (platform, Master SKU) rows in the sheet (confirmed present —
// 56/144 combos on the sample data) are summed before ranking, so a SKU
// split across multiple rows isn't under-counted against single-row SKUs.
export function buildDemandIndex(rows: SalesRow[]): DemandIndex {
  const aggregated = new Map<SupportedMarketplace, Map<string, { gmv: number; units: number; product: string }>>();

  for (const row of rows) {
    const marketplace = normalizePlatform(row.platform);
    if (!marketplace) continue; // Amazon Now / BB Now / etc. — out of scope

    const bySku =
      aggregated.get(marketplace) ?? new Map<string, { gmv: number; units: number; product: string }>();
    const existing = bySku.get(row.masterSku);
    bySku.set(row.masterSku, {
      gmv: (existing?.gmv ?? 0) + row.gmv,
      units: (existing?.units ?? 0) + row.units,
      product: existing?.product || row.product,
    });
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
      skuMap.set(sku, { rank: i + 1, gmv: stats.gmv, units: stats.units, product: stats.product });
    });
    index.set(marketplace, skuMap);
  }

  return index;
}
