import { fetchSalesRows } from "@/lib/sheets/sales";
import { buildDemandIndex, DemandIndex } from "./rank";

const EMPTY_DEMAND_INDEX: DemandIndex = new Map();

export interface DemandIndexResult {
  index: DemandIndex;
  error: string | null; // null = loaded fine; otherwise why demand scoring is silently 0 everywhere
}

// Fetches the sales sheet and builds the demand rank index. Demand
// Intelligence is an additional signal on top of the core priority
// engine (SALES_SHEET_URL is a separate, optional workbook) — if it's
// unreachable or unconfigured, PO scoring should still work off rules
// alone rather than taking the whole dashboard down. But a silent 0
// everywhere is indistinguishable from "no PO has demand data today",
// which already burned a full debugging round-trip once (the sheet
// wasn't shared publicly and separately, SALES_SHEET_URL wasn't set in
// the deployment's environment) — so this returns the error for the
// page to show as a visible banner instead of swallowing it.
export async function getDemandIndex(): Promise<DemandIndexResult> {
  try {
    const rows = await fetchSalesRows();
    return { index: buildDemandIndex(rows), error: null };
  } catch (err) {
    return {
      index: EMPTY_DEMAND_INDEX,
      error: err instanceof Error ? err.message : "Failed to load the Demand Intelligence sales sheet.",
    };
  }
}

export { scoreForRank } from "./rank";
export type { DemandIndex, DemandSkuStats } from "./rank";
