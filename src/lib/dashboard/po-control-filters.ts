import { PoRow } from "./po-rows";

// The 4 pieces of toolbar filter state PoControlTower's table AND the
// Overview donuts both need to agree on — bundled together so a caller
// (Overview) can lift this whole bundle out to render its own donuts
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

function matchesMarketplace(r: PoRow, marketplaceFilter: string): boolean {
  return marketplaceFilter === "all" || r.po.marketplace === marketplaceFilter;
}

function matchesCity(r: PoRow, cityFilter: string): boolean {
  return cityFilter === "all" || r.po.city === cityFilter;
}

// Unscored counts as Low here (and in filterRowsByLevel below) so every
// Pending PO lands in one of the four visible priority-donut slices — a
// Pending PO with no rule signal shouldn't silently vanish from the total.
function matchesLevel(r: PoRow, levelFilter: string): boolean {
  if (levelFilter === "all") return true;
  if (levelFilter === "Low") return r.level === "Low" || r.level === "Unscored";
  return r.level === levelFilter;
}

function matchesSearch(r: PoRow, search: string): boolean {
  if (!search.trim()) return true;
  const q = search.trim().toLowerCase();
  return r.po.id.toLowerCase().includes(q) || r.po.sku.toLowerCase().includes(q);
}

// Everything except the level/priority filter — the priority donut needs
// this so all four priority slices stay visible (and clickable) even
// once one is selected, instead of collapsing to a single 100% slice.
export function filterRowsExceptLevel(
  rows: PoRow[],
  f: Pick<PoControlFilters, "marketplaceFilter" | "cityFilter" | "search">
): PoRow[] {
  return rows.filter((r) => matchesMarketplace(r, f.marketplaceFilter) && matchesCity(r, f.cityFilter) && matchesSearch(r, f.search));
}

// Mirror of filterRowsExceptLevel for the city donut — everything except
// the city filter, so every city slice stays visible/clickable even once
// one city is selected.
export function filterRowsExceptCity(
  rows: PoRow[],
  f: Pick<PoControlFilters, "marketplaceFilter" | "levelFilter" | "search">
): PoRow[] {
  return rows.filter((r) => matchesMarketplace(r, f.marketplaceFilter) && matchesLevel(r, f.levelFilter) && matchesSearch(r, f.search));
}

export function computeLevelCounts(rows: PoRow[]): { Critical: number; High: number; Medium: number; Low: number } {
  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  for (const r of rows) {
    const bucket = r.level === "Unscored" ? "Low" : r.level;
    if (bucket in counts) counts[bucket as keyof typeof counts]++;
  }
  return counts;
}

export function filterRowsByLevel(rows: PoRow[], levelFilter: string): PoRow[] {
  return rows.filter((r) => matchesLevel(r, levelFilter));
}

export interface CitySlice {
  city: string;
  count: number;
}

// Top-N cities by Pending PO count, with everything past that collapsed
// into a single "Other" slice — a real city list (dozens of cities) would
// make an unreadable donut/legend otherwise.
export function computeCityCounts(rows: PoRow[], topN = 5): CitySlice[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.po.city, (counts.get(r.po.city) ?? 0) + 1);
  const sorted = Array.from(counts.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, topN);
  const otherCount = sorted.slice(topN).reduce((sum, s) => sum + s.count, 0);
  return otherCount > 0 ? [...top, { city: "Other", count: otherCount }] : top;
}

export interface TopCityResult {
  city: string;
  count: number;
}

// The single highest-count city — ties broken alphabetically so the KPI
// is deterministic regardless of which PO happened to appear first in
// the data, not just "whichever the Map iterates to last".
export function computeTopCity(rows: PoRow[]): TopCityResult | null {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.po.city, (counts.get(r.po.city) ?? 0) + 1);
  let best: TopCityResult | null = null;
  for (const [city, count] of counts) {
    if (!best || count > best.count || (count === best.count && city < best.city)) {
      best = { city, count };
    }
  }
  return best;
}
