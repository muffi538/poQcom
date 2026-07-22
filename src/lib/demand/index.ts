import { fetchSalesRows } from "@/lib/sheets/sales";
import { buildDemandIndex, DemandIndex } from "./rank";

const EMPTY_DEMAND_INDEX: DemandIndex = new Map();

// Fetches the sales sheet and builds the demand rank index. Demand
// Intelligence is an additional signal on top of the core priority
// engine (SALES_SHEET_URL is a separate, optional workbook) — if it's
// unreachable or unconfigured, PO scoring should still work off rules
// alone rather than taking the whole dashboard down. Callers that want
// to surface the failure (e.g. a Demand Intelligence section) should
// catch it themselves before calling this.
export async function getDemandIndex(): Promise<DemandIndex> {
  try {
    const rows = await fetchSalesRows();
    return buildDemandIndex(rows);
  } catch {
    return EMPTY_DEMAND_INDEX;
  }
}

export { scoreForRank } from "./rank";
export type { DemandIndex, DemandSkuStats } from "./rank";
