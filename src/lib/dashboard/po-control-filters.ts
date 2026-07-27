import { PoRow } from "./po-rows";

// The 5 pieces of toolbar filter state PoControlTower's table AND the
// priority donut both need to agree on — bundled together so a caller
// (Overview) can lift this whole bundle out to render its own donut
// beside the KPI grid while PoControlTower still drives the table with
// the exact same state. Sort key and the selected-row drawer stay local
// to PoControlTower since nothing outside it needs them.
export interface PoControlFilters {
  marketplaceFilter: string;
  cityFilter: string;
  levelFilter: string;
  search: string;
}

export const DEFAULT_PO_CONTROL_FILTERS: PoControlFilters = {
  marketplaceFilter: "all",
  cityFilter: "all",
  levelFilter: "all",
  search: "",
};

// Everything except the level/priority filter — the donut chart needs
// this so all four priority slices stay visible (and clickable) even
// once one is selected, instead of collapsing to a single 100% slice.
export function filterRowsExceptLevel(
  rows: PoRow[],
  f: Pick<PoControlFilters, "marketplaceFilter" | "cityFilter" | "search">
): PoRow[] {
  return rows.filter((r) => {
    if (f.marketplaceFilter !== "all" && r.po.marketplace !== f.marketplaceFilter) return false;
    if (f.cityFilter !== "all" && r.po.city !== f.cityFilter) return false;
    if (f.search.trim()) {
      const q = f.search.trim().toLowerCase();
      if (!r.po.id.toLowerCase().includes(q) && !r.po.sku.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

// Unscored counts as Low here (and in filterRowsByLevel below) so every
// Pending PO lands in one of the four visible donut slices — a Pending
// PO with no rule signal shouldn't silently vanish from the donut total.
export function computeLevelCounts(rows: PoRow[]): { Critical: number; High: number; Medium: number; Low: number } {
  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  for (const r of rows) {
    const bucket = r.level === "Unscored" ? "Low" : r.level;
    if (bucket in counts) counts[bucket as keyof typeof counts]++;
  }
  return counts;
}

export function filterRowsByLevel(rows: PoRow[], levelFilter: string): PoRow[] {
  return rows.filter((r) => {
    if (levelFilter === "all") return true;
    if (levelFilter === "Low") return r.level === "Low" || r.level === "Unscored";
    return r.level === levelFilter;
  });
}
