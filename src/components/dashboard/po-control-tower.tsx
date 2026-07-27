"use client";

import { useMemo, useState } from "react";
import { Search, SearchX, ArrowUpDown, AlertTriangle } from "lucide-react";
import { PoRow } from "@/lib/dashboard/po-rows";
import { PriorityBadge } from "./priority-badge";
import { MarketplaceBadge } from "./marketplace-badge";
import { OperationalDelayBadge } from "./operational-delay";
import { PoDetailPanel } from "./po-detail-panel";
import { fmtCurrency } from "./po-format";
import { HIGH_DEMAND_RANK_THRESHOLD } from "@/lib/demand/rank";
import { ExportButton } from "./export-button";
import { CsvCell } from "@/lib/export/csv";
import { DateFilterBar } from "./date-filter-bar";
import { DateFilterState } from "@/lib/dashboard/date-filter";
import { PriorityDonutChart } from "./priority-donut-chart";

type SortKey =
  | "priority"
  | "overdue"
  | "expiry"
  | "value"
  | "qty"
  | "apptDelay"
  | "newest"
  | "oldest";

const SORTERS: Record<SortKey, (a: PoRow, b: PoRow) => number> = {
  priority: (a, b) => b.score - a.score,
  overdue: (a, b) => (b.operationalDelayDays ?? -Infinity) - (a.operationalDelayDays ?? -Infinity),
  // A row with no expiry date at all (BigBasket/Amazon Now) always sorts
  // last here, regardless of direction — daysRemaining defaults to 0 for
  // math-safety elsewhere, but that must never look like "expires today"
  // in an expiry-ordered sort.
  expiry: (a, b) => {
    if (!a.hasExpiryDate && !b.hasExpiryDate) return 0;
    if (!a.hasExpiryDate) return 1;
    if (!b.hasExpiryDate) return -1;
    return a.daysRemaining - b.daysRemaining;
  },
  value: (a, b) => (b.po.poValue ?? -1) - (a.po.poValue ?? -1),
  qty: (a, b) => b.po.pendingQty - a.po.pendingQty,
  apptDelay: (a, b) => (b.appointmentDelayDays ?? -1) - (a.appointmentDelayDays ?? -1),
  newest: (a, b) => (b.po.poRaisedDate || "").localeCompare(a.po.poRaisedDate || ""),
  oldest: (a, b) => (a.po.poRaisedDate || "").localeCompare(b.po.poRaisedDate || ""),
};

const SORT_LABELS: Record<SortKey, string> = {
  priority: "Highest Priority",
  overdue: "Most Overdue",
  expiry: "Expiry Nearest",
  value: "Highest Value",
  qty: "Largest Qty",
  apptDelay: "Largest Appt Delay",
  newest: "Newest PO",
  oldest: "Oldest PO",
};

// Fixed column widths (px) — chosen so the table fits a 1920x1080 monitor
// without horizontal scrolling. Only the last column (Reason) flexes to
// fill remaining width; everything else is a hard pixel budget, enforced
// via <colgroup> + table-layout:fixed rather than letting content push
// columns wider. Sticky columns' left offsets are cumulative sums of the
// widths that come before them.
const COL = {
  rank: 30,
  priority: 92,
  poNumber: 112,
  marketplace: 84,
  city: 88,
  fc: 150,
  qty: 60,
  value: 84,
  poDate: 76,
  expiry: 76,
  delay: 100,
};
// Fixed row height (requirement: every row identical, no growing from
// wrapped text or multiple reasons) — applied as an explicit height on
// each <tr>, paired with single-line truncation on every cell so nothing
// can push a row taller than this. 56px (~17% over the prior 48px) per
// the confirmed "rows still feel cramped" follow-up, alongside a slightly
// larger table font (13px -> 14px) and more cell padding.
const ROW_HEIGHT = "h-14";

const EXPORT_HEADERS = [
  "Rank",
  "Priority",
  "PO Number",
  "Marketplace",
  "City",
  "FC / Warehouse",
  "Pending Qty",
  "PO Value",
  "PO Date",
  "Expiry Date",
  "Operational Delay (days)",
  "Metro City",
  "High Demand SKU",
  "Reason / Action",
];

const STICKY_LEFT = {
  rank: 0,
  priority: COL.rank,
  poNumber: COL.rank + COL.priority,
  marketplace: COL.rank + COL.priority + COL.poNumber,
};

const inputClasses =
  "rounded-lg border border-frido-border bg-white px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-[var(--mp-accent)] dark:border-white/10 dark:bg-neutral-900";

// Single-select Expiry bucket for the toolbar dropdown — distinct from
// the OR-able "Overdue"/"Expiring ≤3d" quick-filter chips (those layer on
// top of everything else; this picks exactly one bucket at a time, per
// the confirmed toolbar filter set: City / Marketplace / Priority /
// Expiry / Search).
function matchesExpiryBucket(r: PoRow, bucket: string): boolean {
  if (!r.hasExpiryDate) return bucket === "No Expiry Date";
  if (r.isOverdue) return bucket === "Overdue";
  if (r.daysRemaining === 0) return bucket === "Due Today";
  if (r.daysRemaining <= 3) return bucket === "≤3 Days";
  if (r.daysRemaining <= 7) return bucket === "≤7 Days";
  return bucket === "8+ Days";
}

function fmtShortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// Shared between the on-screen Reason/Action cell and the CSV export so
// the two never drift apart. Returned as an ordered list (highest-
// priority reason first — a demand tag, then each rule that fired, then
// the recommended action) rather than one pre-joined string, so the
// table can show just the first item + "N more" without ever growing
// the row (requirement: multiple reasons must never make a row taller).
function buildReasonParts(r: PoRow): string[] {
  const topHit = r.demandHits[0];
  const isHighDemand = topHit !== undefined && topHit.rank <= HIGH_DEMAND_RANK_THRESHOLD;
  const demandTag = isHighDemand ? `Top SKU #${topHit.rank} (${r.po.marketplace})` : null;
  return [demandTag, ...r.rulesTriggered, r.recommendedAction].filter((v): v is string => Boolean(v));
}

interface Props {
  rows: PoRow[];
  marketplaces: string[]; // distinct marketplaces present — filter hidden when there's only one
  hasRules: boolean;
  demandError?: string | null; // set when the Demand Intelligence sales sheet failed to load — scores below are rules-only
  // Sets the Priority filter's starting value (e.g. the "Critical" status
  // tab is a shortcut onto this same table, pre-filtered) — only read on
  // mount; the dropdown remains fully changeable afterward like any other
  // filter, this just decides where it starts.
  initialLevelFilter?: string;
  // Lifted from the page-level client wrapper (Overview/marketplace),
  // never local state here — the date filter also has to recompute
  // KPIs/charts/secondary tables above this component, not just this
  // table's own `rows`, which already arrive pre-filtered by date.
  dateFilter?: DateFilterState;
  onDateFilterChange?: (next: DateFilterState) => void;
  // Rendered as the first item in the filter toolbar — lets a parent
  // (MarketplaceTabbedView) fold its own Status selector into the same
  // row as City/Priority/Expiry/Search instead of stacking it above.
  leadingToolbarItem?: React.ReactNode;
  // True on marketplace pages, where this table is the last thing on the
  // page and should stretch to fill whatever viewport height is left
  // (no page-level scroll, no dead space below it). False on Overview,
  // which has more sections after this table and needs its own bounded
  // scroll region instead.
  fillHeight?: boolean;
}

export function PoControlTower({
  rows,
  marketplaces,
  hasRules,
  demandError,
  initialLevelFilter,
  dateFilter,
  onDateFilterChange,
  leadingToolbarItem,
  fillHeight,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>(initialLevelFilter ?? "all");
  const [expiryFilter, setExpiryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PoRow | null>(null);

  const cities = useMemo(() => Array.from(new Set(rows.map((r) => r.po.city))).sort(), [rows]);
  const levels = ["Critical", "High", "Medium", "Low", "Unscored"];
  // "No Expiry Date" only shows up when at least one row genuinely lacks
  // one (e.g. BigBasket/Amazon Now) — no point cluttering the dropdown
  // with an always-empty bucket for marketplaces that always have a date.
  const hasAnyMissingExpiry = useMemo(() => rows.some((r) => !r.hasExpiryDate), [rows]);
  const expiryBuckets = [
    "Overdue",
    "Due Today",
    "≤3 Days",
    "≤7 Days",
    "8+ Days",
    ...(hasAnyMissingExpiry ? ["No Expiry Date"] : []),
  ];

  // Everything except the level/priority filter — the donut chart reads
  // this so all four priority slices stay visible (and clickable) even
  // once one is selected, instead of collapsing to a single 100% slice.
  const filteredExceptLevel = useMemo(() => {
    return rows.filter((r) => {
      if (marketplaceFilter !== "all" && r.po.marketplace !== marketplaceFilter) return false;
      if (cityFilter !== "all" && r.po.city !== cityFilter) return false;
      if (expiryFilter !== "all" && !matchesExpiryBucket(r, expiryFilter)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!r.po.id.toLowerCase().includes(q) && !r.po.sku.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, marketplaceFilter, cityFilter, expiryFilter, search]);

  const levelCounts = useMemo(() => {
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    for (const r of filteredExceptLevel) {
      if (r.level in counts) counts[r.level as keyof typeof counts]++;
    }
    return counts;
  }, [filteredExceptLevel]);

  const filtered = useMemo(
    () => filteredExceptLevel.filter((r) => levelFilter === "all" || r.level === levelFilter),
    [filteredExceptLevel, levelFilter]
  );

  const sorted = useMemo(() => [...filtered].sort(SORTERS[sortKey]), [filtered, sortKey]);

  // Exports exactly what's currently filtered/sorted on screen, not the
  // full unfiltered rows — so the download matches what the user is
  // actually looking at. Raw numbers/ISO dates, not display strings
  // (no ₹ symbol, no thousands separators), so Excel treats them as
  // numbers/dates rather than text.
  const exportRows: CsvCell[][] = useMemo(
    () =>
      sorted.map((r) => [
        r.rank || null,
        r.level,
        r.po.id,
        r.po.marketplace,
        r.po.city,
        r.po.warehouse,
        r.po.pendingQty,
        r.po.poValue,
        r.po.poRaisedDate || null,
        r.po.expiryDate || null,
        r.operationalDelayDays,
        r.isMetroCity ? "Yes" : "No",
        r.demandHits.some((h) => h.rank <= HIGH_DEMAND_RANK_THRESHOLD) ? "Yes" : "No",
        buildReasonParts(r).join(" → "),
      ]),
    [sorted]
  );

  return (
    <div className={`flex flex-col gap-1.5 ${fillHeight ? "min-h-0 flex-1" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {leadingToolbarItem}
        {marketplaces.length > 1 && (
          <FilterSelect label="Marketplace" value={marketplaceFilter} onChange={setMarketplaceFilter} options={marketplaces} />
        )}
        <FilterSelect label="City" value={cityFilter} onChange={setCityFilter} options={cities} />
        <FilterSelect label="Priority" value={levelFilter} onChange={setLevelFilter} options={levels} />
        {dateFilter && onDateFilterChange && <DateFilterBar filter={dateFilter} onChange={onDateFilterChange} />}
        <FilterSelect label="Expiry" value={expiryFilter} onChange={setExpiryFilter} options={expiryBuckets} />
        <div className="relative">
          <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO # / SKU"
            className={`${inputClasses} w-36 pl-6`}
          />
        </div>

        <div className="relative ml-auto">
          <ArrowUpDown size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={`${inputClasses} pl-6`}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                Sort: {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <span className="text-[11px] text-neutral-500">
          {sorted.length} / {rows.length}
        </span>
        <ExportButton headers={EXPORT_HEADERS} rows={exportRows} filename="po-control-tower.csv" />
      </div>

      {!hasRules && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          Only 5 rules published — every already-overdue PO is still guaranteed Critical regardless.
        </div>
      )}
      {demandError && (
        <div
          className="rounded-lg border border-amber-300/60 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
          title={demandError}
        >
          Demand Intelligence sales sheet failed to load — scores below reflect rules only, no SKU
          demand data. ({demandError})
        </div>
      )}

      <PriorityDonutChart
        counts={levelCounts}
        activeLevel={levelFilter}
        onSelectLevel={(level) => setLevelFilter(level === levelFilter ? "all" : level)}
      />

      <div className={`glass-card flex flex-col overflow-hidden rounded-md ${fillHeight ? "min-h-0 flex-1" : ""}`}>
        <div className={`overflow-auto ${fillHeight ? "min-h-0 flex-1" : "h-[80vh]"}`}>
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col style={{ width: COL.rank }} />
              <col style={{ width: COL.priority }} />
              <col style={{ width: COL.poNumber }} />
              <col style={{ width: COL.marketplace }} />
              <col style={{ width: COL.city }} />
              <col style={{ width: COL.fc }} />
              <col style={{ width: COL.qty }} />
              <col style={{ width: COL.value }} />
              <col style={{ width: COL.poDate }} />
              <col style={{ width: COL.expiry }} />
              <col style={{ width: COL.delay }} />
              {/* No width/min-width here on purpose — under table-fixed,
                  an unconstrained column absorbs 100% of whatever width
                  is left over, which is what makes Reason/Action flex
                  flush to the scrollbar instead of leaving a dead gap. */}
              <col />
            </colgroup>
            <thead className="sticky top-0 z-20 bg-white text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr className="border-b border-frido-border dark:border-white/10">
                <th className="po-table-sticky-col sticky z-20 bg-white px-2 py-2 dark:bg-neutral-900" style={{ left: STICKY_LEFT.rank }}>
                  #
                </th>
                <th className="po-table-sticky-col sticky z-20 bg-white px-2 py-2 dark:bg-neutral-900" style={{ left: STICKY_LEFT.priority }}>
                  Priority
                </th>
                <th className="po-table-sticky-col sticky z-20 bg-white px-2 py-2 dark:bg-neutral-900" style={{ left: STICKY_LEFT.poNumber }}>
                  PO Number
                </th>
                <th
                  className="po-table-sticky-col sticky z-20 bg-white px-2 py-2 dark:bg-neutral-900"
                  style={{ left: STICKY_LEFT.marketplace, boxShadow: "2px 0 0 0 rgba(0,0,0,0.06)" }}
                >
                  Mkt
                </th>
                <th className="px-2 py-2">City</th>
                <th className="px-2 py-2">FC</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Value</th>
                <th className="px-2 py-2">PO Date</th>
                <th className="px-2 py-2">Expiry</th>
                <th className="px-2 py-2">Delay</th>
                <th className="px-2 py-2">Reason / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-[14px] dark:divide-white/5">
              {sorted.map((r) => {
                const reasonParts = buildReasonParts(r);
                const primaryReason = reasonParts[0] ?? "—";
                const moreCount = reasonParts.length - 1;
                return (
                  <tr
                    key={r.po.id}
                    onClick={() => setSelected(r)}
                    className={`group cursor-pointer transition-colors hover:bg-[var(--mp-primary)]/[0.06] ${ROW_HEIGHT}`}
                  >
                    <td
                      className={`po-table-sticky-col sticky z-10 bg-white px-2 text-neutral-500 transition-colors group-hover:bg-[#fbf9f2] dark:bg-neutral-900 dark:group-hover:bg-neutral-800 ${
                        r.isOverdue ? "border-l-2 border-l-[#d03b3b]" : ""
                      }`}
                      style={{ left: STICKY_LEFT.rank }}
                    >
                      {r.rank || "—"}
                    </td>
                    <td
                      className="po-table-sticky-col sticky z-10 bg-white px-2 transition-colors group-hover:bg-[#fbf9f2] dark:bg-neutral-900 dark:group-hover:bg-neutral-800"
                      style={{ left: STICKY_LEFT.priority }}
                    >
                      <div className="flex h-full items-center gap-1">
                        <PriorityBadge level={r.level} compact />
                        {r.isOverdue && <AlertTriangle size={11} className="animate-pulse shrink-0 text-[#d03b3b]" />}
                      </div>
                    </td>
                    <td
                      className="po-table-sticky-col sticky z-10 truncate bg-white px-2 font-medium transition-colors group-hover:bg-[#fbf9f2] dark:bg-neutral-900 dark:group-hover:bg-neutral-800"
                      style={{ left: STICKY_LEFT.poNumber }}
                      title={r.po.id}
                    >
                      {r.po.id}
                    </td>
                    <td
                      className="po-table-sticky-col sticky z-10 bg-white px-2 transition-colors group-hover:bg-[#fbf9f2] dark:bg-neutral-900 dark:group-hover:bg-neutral-800"
                      style={{ left: STICKY_LEFT.marketplace, boxShadow: "2px 0 0 0 rgba(0,0,0,0.04)" }}
                    >
                      <div className="flex h-full items-center">
                        <MarketplaceBadge marketplace={r.po.marketplace} compact />
                      </div>
                    </td>
                    <td className="truncate px-2" title={r.po.city}>
                      {r.po.city}
                    </td>
                    <td className="truncate px-2 text-neutral-500" title={r.po.warehouse}>
                      {r.po.warehouse}
                    </td>
                    <td className="px-2 text-right tabular-nums">{r.po.pendingQty.toLocaleString("en-IN")}</td>
                    <td className="px-2 text-right tabular-nums">{fmtCurrency(r.po.poValue)}</td>
                    <td className="whitespace-nowrap px-2 text-neutral-500">{fmtShortDate(r.po.poRaisedDate)}</td>
                    <td className="whitespace-nowrap px-2 text-neutral-500">{fmtShortDate(r.po.expiryDate)}</td>
                    <td className="px-2">
                      <OperationalDelayBadge days={r.operationalDelayDays} compact />
                    </td>
                    <td className="px-2 text-neutral-500" title={reasonParts.join("\n")}>
                      <div className="flex h-full items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate">{primaryReason}</span>
                        {moreCount > 0 && (
                          <span className="shrink-0 whitespace-nowrap rounded-md border border-frido-border bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300">
                            +{moreCount} more
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sorted.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-neutral-500">
            <SearchX size={22} className="text-neutral-300" />
            No POs match these filters.
          </div>
        )}
      </div>

      {selected && <PoDetailPanel row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClasses}>
      <option value="all">{label}: All</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
