import { fetchSalesRowsFromSupabase } from "@/lib/data/sales";
import { buildDemandIndex, DemandIndex } from "./rank";

const EMPTY_DEMAND_INDEX: DemandIndex = new Map();

export interface DemandIndexResult {
  index: DemandIndex;
  error: string | null; // null = loaded fine; otherwise why demand scoring is silently 0 everywhere
}

// Reads sales_records from Supabase and builds the demand rank index.
// Demand Intelligence is an additional signal on top of the core
// priority engine — if Supabase is unreachable or sales_records is
// empty, PO scoring should still work off rules alone rather than taking
// the whole dashboard down. But a silent 0 everywhere is indistinguishable
// from "no PO has demand data today", which already burned a full
// debugging round-trip once — so this returns the error for the page to
// show as a visible banner instead of swallowing it.
export async function getDemandIndex(): Promise<DemandIndexResult> {
  try {
    const rows = await fetchSalesRowsFromSupabase();
    return { index: buildDemandIndex(rows), error: null };
  } catch (err) {
    return {
      index: EMPTY_DEMAND_INDEX,
      error: err instanceof Error ? err.message : "Failed to load Demand Intelligence sales data from Supabase.",
    };
  }
}

export { scoreForRank } from "./rank";
export type { DemandIndex, DemandSkuStats } from "./rank";
