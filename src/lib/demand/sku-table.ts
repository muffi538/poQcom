import { PurchaseOrder } from "@/types/purchase-order";
import { DemandIndex, scoreForRank } from "./rank";
import { SupportedMarketplace } from "@/lib/sheets/marketplaces";

export type DemandTier = "Very High" | "High" | "Medium" | "Low";

// Same rank bands as scoreForRank (confirmed tiers), labeled for display.
export function tierForRank(rank: number): DemandTier {
  if (rank <= 5) return "Very High";
  if (rank <= 15) return "High";
  if (rank <= 30) return "Medium";
  return "Low";
}

export interface TopSkuRow {
  rank: number;
  sku: string;
  product: string;
  gmv: number;
  units: number;
  points: number; // this SKU's contribution to any PO's score, per occurrence
  tier: DemandTier;
  pendingPoIds: string[]; // this marketplace's currently Pending POs containing this SKU
  cities: string[]; // distinct cities among those POs
  totalPendingQty: number; // summed pending qty of this SKU across those POs
}

export interface TopSkuTableStats {
  top10GmvShare: number; // 0-100, % of this marketplace's total ranked GMV from the top 10 SKUs
  topSkuGmv: number;
  averageGmv: number; // across every ranked SKU, not just the displayed slice
  openPosContainingTopSkus: number; // distinct Pending POs containing any top-20 SKU
}

export interface TopSkuTableResult {
  rows: TopSkuRow[]; // ranked 1..N (capped at `limit`), best GMV first
  stats: TopSkuTableStats;
}

// Builds the ranked SKU table for one marketplace: demand data joined with
// which of those SKUs are actually sitting inside today's Pending POs, so
// an ops user can see "what sells" and "what's stuck" in one place. Capped
// at rank 50 by default — scoreForRank returns 0 beyond that, so showing
// weaker ranks would just be noise (confirmed pattern from the High-Demand
// badge fix: a bar with no discriminating power says nothing).
export function buildTopSkuTable(
  marketplace: SupportedMarketplace,
  demandIndex: DemandIndex,
  pendingPos: PurchaseOrder[],
  limit = 50
): TopSkuTableResult {
  const skuMap = demandIndex.get(marketplace);
  if (!skuMap || skuMap.size === 0) {
    return { rows: [], stats: { top10GmvShare: 0, topSkuGmv: 0, averageGmv: 0, openPosContainingTopSkus: 0 } };
  }

  const poIndexBySku = new Map<string, { poIds: Set<string>; cities: Set<string>; totalPendingQty: number }>();
  for (const po of pendingPos) {
    if (po.marketplace !== marketplace) continue;
    for (const line of po.lineItems) {
      const entry = poIndexBySku.get(line.sku) ?? { poIds: new Set(), cities: new Set(), totalPendingQty: 0 };
      entry.poIds.add(po.id);
      entry.cities.add(po.city);
      entry.totalPendingQty += line.pendingQty;
      poIndexBySku.set(line.sku, entry);
    }
  }

  const rankedAll = [...skuMap.entries()].sort((a, b) => a[1].rank - b[1].rank);
  const rows: TopSkuRow[] = rankedAll.slice(0, limit).map(([sku, stats]) => {
    const poInfo = poIndexBySku.get(sku);
    return {
      rank: stats.rank,
      sku,
      product: stats.product,
      gmv: stats.gmv,
      units: stats.units,
      points: scoreForRank(stats.rank),
      tier: tierForRank(stats.rank),
      pendingPoIds: poInfo ? [...poInfo.poIds] : [],
      cities: poInfo ? [...poInfo.cities].sort() : [],
      totalPendingQty: poInfo?.totalPendingQty ?? 0,
    };
  });

  const allGmvValues = rankedAll.map(([, s]) => s.gmv);
  const totalGmv = allGmvValues.reduce((a, b) => a + b, 0);
  const top10Gmv = rows.slice(0, 10).reduce((sum, r) => sum + r.gmv, 0);
  const top20Skus = new Set(rows.slice(0, 20).map((r) => r.sku));
  const openPosContainingTopSkus = new Set(
    pendingPos
      .filter((po) => po.marketplace === marketplace && po.skus.some((s) => top20Skus.has(s)))
      .map((po) => po.id)
  ).size;

  return {
    rows,
    stats: {
      top10GmvShare: totalGmv > 0 ? Math.round((top10Gmv / totalGmv) * 100) : 0,
      topSkuGmv: rankedAll[0]?.[1].gmv ?? 0,
      averageGmv: allGmvValues.length > 0 ? totalGmv / allGmvValues.length : 0,
      openPosContainingTopSkus,
    },
  };
}
