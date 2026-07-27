import { PurchaseOrder } from "@/types/purchase-order";

// A plain from/to date-range filter on PO Date (poRaisedDate) — no
// presets, no alternate date field. Both null means no filtering at all.
export interface DateFilterState {
  from: string | null; // ISO date (yyyy-mm-dd)
  to: string | null;
}

export const DEFAULT_DATE_FILTER: DateFilterState = {
  from: null,
  to: null,
};

// Applies the filter to a PurchaseOrder[] batch — called once, before
// everything downstream (buildExecutiveSummary/buildPoRows/
// buildTopSkuTable/charts), so every metric/table/chart/priority count
// reflects the same filtered set uniformly rather than each needing its
// own date-filtering logic.
export function filterPurchaseOrdersByDate(pos: PurchaseOrder[], filter: DateFilterState): PurchaseOrder[] {
  if (!filter.from && !filter.to) return pos;

  return pos.filter((po) => {
    const value = po.poRaisedDate || null;
    // A PO with no PO Date at all can't be judged against the range —
    // excluded rather than guessed in either direction.
    if (!value) return false;
    if (filter.from && value < filter.from) return false;
    if (filter.to && value > filter.to) return false;
    return true;
  });
}

export function formatDateFilterBadge(filter: DateFilterState): string {
  if (filter.from && filter.to) return `${filter.from} → ${filter.to}`;
  if (filter.from) return `From ${filter.from}`;
  if (filter.to) return `Until ${filter.to}`;
  return "All Time";
}
