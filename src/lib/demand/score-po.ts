import { PurchaseOrder } from "@/types/purchase-order";
import { DemandIndex, scoreForRank } from "./rank";
import { SUPPORTED_MARKETPLACES, SupportedMarketplace } from "@/lib/sheets/marketplaces";

export interface DemandSkuHit {
  sku: string;
  rank: number;
  gmv: number;
  points: number;
}

export interface DemandContribution {
  score: number; // sum of scoreForRank across every matched SKU on the PO (confirmed)
  hits: DemandSkuHit[]; // only SKUs found in this PO's marketplace's sales data
  missingSkuCount: number; // SKUs on the PO with no match in the sales data — neutral, 0 contribution
}

function isSupportedMarketplace(m: string): m is SupportedMarketplace {
  return (SUPPORTED_MARKETPLACES as readonly string[]).includes(m);
}

// Compares a PO only against its OWN marketplace's sales data (confirmed:
// never compare Zepto POs against Blinkit sales). Sums the tiered
// per-rank score across every SKU on the PO — a PO with several
// top-selling SKUs scores higher than one with a single top SKU
// (confirmed, "the more top-performing SKUs, the higher the score").
export function computeDemandContribution(
  po: PurchaseOrder,
  demandIndex: DemandIndex
): DemandContribution {
  if (!isSupportedMarketplace(po.marketplace)) {
    return { score: 0, hits: [], missingSkuCount: po.skus.length };
  }

  const skuMap = demandIndex.get(po.marketplace);
  const hits: DemandSkuHit[] = [];
  let missingSkuCount = 0;

  for (const sku of po.skus) {
    const stats = skuMap?.get(sku);
    if (!stats) {
      missingSkuCount += 1;
      continue;
    }
    hits.push({ sku, rank: stats.rank, gmv: stats.gmv, points: scoreForRank(stats.rank) });
  }

  return {
    score: hits.reduce((sum, h) => sum + h.points, 0),
    hits,
    missingSkuCount,
  };
}
