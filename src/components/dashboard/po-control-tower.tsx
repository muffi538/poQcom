"use client";

import { useMemo, useState } from "react";
import { Search, SearchX, ArrowUpDown, AlertTriangle, Flame } from "lucide-react";
import { PoRow } from "@/lib/dashboard/po-rows";
import { PriorityBadge } from "./priority-badge";
import { MarketplaceBadge } from "./marketplace-badge";
import { OperationalDelayBadge } from "./operational-delay";
import { PoDetailPanel } from "./po-detail-panel";
import { fmtCurrency } from "./po-format";
import { HIGH_DEMAND_RANK_THRESHOLD } from "@/lib/demand/rank";

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
  expiry: (a, b) => a.daysRemaining - b.daysRemaining,
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
  score: 46,
  city: 88,
  fc: 150,
  qty: 60,
  value: 84,
  expiry: 76,
  delay: 100,
  demand: 34,
};
const STICKY_LEFT = {
  rank: 0,
  priority: COL.rank,
  poNumber: COL.rank + COL.priority,
  marketplace: COL.rank + COL.priority + COL.poNumber,
};

const inputClasses =
  "rounded-lg border border-frido-border bg-white px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-[var(--mp-accent)] dark:border-white/10 dark:bg-neutral-900";

function fmtShortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

interface Props {
  rows: PoRow[];
  marketplaces: string[]; // distinct marketplaces present — filter hidden when there's only one
  hasRules: boolean;
  demandError?: string | null; // set when the Demand Intelligence sales sheet failed to load — scores below are rules-only
}

type QuickFilter =
  | "overdue"
  | "expiringSoon"
  | "dispatchToday"
  | "delayedAppt"
  | "metro"
  | "highDemand"
  | "lowValue"
  | "critical";

export function PoControlTower({ rows, marketplaces, hasRules, demandError }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [quickFilters, setQuickFilters] = useState<Set<QuickFilter>>(new Set());
  const [selected, setSelected] = useState<PoRow | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const cities = useMemo(() => Array.from(new Set(rows.map((r) => r.po.city))).sort(), [rows]);
  const levels = ["Critical", "High", "Medium", "Low", "Unscored"];

  // Counts shown on each chip reflect the whole Pending queue, independent
  // of whatever else is currently filtered — so the number always answers
  // "how big is this cohort," not "how many are left after my other filters."
  const quickFilterDefs: Array<{ key: QuickFilter; label: string; count: number; test: (r: PoRow) => boolean }> = [
    { key: "critical", label: "Critical", count: rows.filter((r) => r.level === "Critical").length, test: (r) => r.level === "Critical" },
    { key: "overdue", label: "Overdue", count: rows.filter((r) => r.isOverdue).length, test: (r) => r.isOverdue },
    {
      key: "expiringSoon",
      label: "Expiring ≤3d",
      count: rows.filter((r) => !r.isOverdue && r.daysRemaining <= 3).length,
      test: (r) => !r.isOverdue && r.daysRemaining <= 3,
    },
    {
      key: "dispatchToday",
      label: "Dispatch Today",
      count: rows.filter((r) => r.po.appointmentDate === today).length,
      test: (r) => r.po.appointmentDate === today,
    },
    {
      key: "delayedAppt",
      label: "Delayed Appt",
      count: rows.filter((r) => (r.appointmentDelayDays ?? 0) > 0).length,
      test: (r) => (r.appointmentDelayDays ?? 0) > 0,
    },
    { key: "metro", label: "Metro", count: rows.filter((r) => r.isMetroCity).length, test: (r) => r.isMetroCity },
    {
      key: "highDemand",
      label: "High Demand",
      count: rows.filter((r) => r.demandHits.some((h) => h.rank <= HIGH_DEMAND_RANK_THRESHOLD)).length,
      test: (r) => r.demandHits.some((h) => h.rank <= HIGH_DEMAND_RANK_THRESHOLD),
    },
    {
      key: "lowValue",
      label: "Low Value",
      count: rows.filter((r) => r.po.poValue !== null && r.po.poValue < 25000).length,
      test: (r) => r.po.poValue !== null && r.po.poValue < 25000,
    },
  ];

  function toggleQuickFilter(key: QuickFilter) {
    setQuickFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const activeTests = quickFilterDefs.filter((d) => quickFilters.has(d.key)).map((d) => d.test);
    return rows.filter((r) => {
      if (marketplaceFilter !== "all" && r.po.marketplace !== marketplaceFilter) return false;
      if (cityFilter !== "all" && r.po.city !== cityFilter) return false;
      if (levelFilter !== "all" && r.level !== levelFilter) return false;
      if (!activeTests.every((test) => test(r))) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!r.po.id.toLowerCase().includes(q) && !r.po.sku.toLowerCase().includes(q)) return false;
      }
      return true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, [rows, marketplaceFilter, cityFilter, levelFilter, quickFilters, search]);

  const sorted = useMemo(() => [...filtered].sort(SORTERS[sortKey]), [filtered, sortKey]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {marketplaces.length > 1 && (
          <FilterSelect label="Marketplace" value={marketplaceFilter} onChange={setMarketplaceFilter} options={marketplaces} />
        )}
        <FilterSelect label="City" value={cityFilter} onChange={setCityFilter} options={cities} />
        <FilterSelect label="Priority" value={levelFilter} onChange={setLevelFilter} options={levels} />
        <div className="relative">
          <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO # / SKU"
            className={`${inputClasses} w-36 pl-6`}
          />
        </div>

        <span className="mx-1 h-4 w-px bg-frido-border dark:bg-white/10" />

        {quickFilterDefs.map((d) => (
          <button
            key={d.key}
            onClick={() => toggleQuickFilter(d.key)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              quickFilters.has(d.key)
                ? "border-[var(--mp-accent)] bg-[var(--mp-primary)]/20 text-[var(--mp-accent)]"
                : "border-frido-border text-neutral-500 hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-neutral-900"
            }`}
          >
            {d.label} <span className="tabular-nums opacity-70">{d.count}</span>
          </button>
        ))}

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

      <div className="glass-card overflow-hidden rounded-lg shadow-sm">
        <div className="h-[78vh] overflow-auto">
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col style={{ width: COL.rank }} />
              <col style={{ width: COL.priority }} />
              <col style={{ width: COL.poNumber }} />
              <col style={{ width: COL.marketplace }} />
              <col style={{ width: COL.score }} />
              <col style={{ width: COL.city }} />
              <col style={{ width: COL.fc }} />
              <col style={{ width: COL.qty }} />
              <col style={{ width: COL.value }} />
              <col style={{ width: COL.expiry }} />
              <col style={{ width: COL.delay }} />
              <col style={{ width: COL.demand }} />
              <col style={{ minWidth: 220 }} />
            </colgroup>
            <thead className="sticky top-0 z-20 bg-white/95 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 backdrop-blur dark:bg-neutral-900/95">
              <tr className="border-b border-frido-border dark:border-white/10">
                <th className="po-table-sticky-col sticky z-20 bg-white/95 px-1.5 py-1.5 backdrop-blur dark:bg-neutral-900/95" style={{ left: STICKY_LEFT.rank }}>
                  #
                </th>
                <th className="po-table-sticky-col sticky z-20 bg-white/95 px-1.5 py-1.5 backdrop-blur dark:bg-neutral-900/95" style={{ left: STICKY_LEFT.priority }}>
                  Priority
                </th>
                <th className="po-table-sticky-col sticky z-20 bg-white/95 px-1.5 py-1.5 backdrop-blur dark:bg-neutral-900/95" style={{ left: STICKY_LEFT.poNumber }}>
                  PO Number
                </th>
                <th
                  className="po-table-sticky-col sticky z-20 bg-white/95 px-1.5 py-1.5 backdrop-blur dark:bg-neutral-900/95"
                  style={{ left: STICKY_LEFT.marketplace, boxShadow: "2px 0 0 0 rgba(0,0,0,0.06)" }}
                >
                  Mkt
                </th>
                <th className="px-1.5 py-1.5">Score</th>
                <th className="px-1.5 py-1.5">City</th>
                <th className="px-1.5 py-1.5">FC</th>
                <th className="px-1.5 py-1.5 text-right">Qty</th>
                <th className="px-1.5 py-1.5 text-right">Value</th>
                <th className="px-1.5 py-1.5">Expiry</th>
                <th className="px-1.5 py-1.5">Delay</th>
                <th className="px-1.5 py-1.5" title="Demand Intelligence: contains a top-selling SKU for this marketplace">
                  <Flame size={11} />
                </th>
                <th className="min-w-[220px] px-1.5 py-1.5">Reason / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-[12px] dark:divide-white/5">
              {sorted.map((r) => {
                const topHit = r.demandHits[0];
                const isHighDemand = topHit !== undefined && topHit.rank <= HIGH_DEMAND_RANK_THRESHOLD;
                const demandTag = isHighDemand ? `Top SKU #${topHit.rank} (${r.po.marketplace})` : null;
                const reason = [demandTag, r.rulesTriggered.join(", "), r.recommendedAction]
                  .filter(Boolean)
                  .join(" → ");
                const demandTitle = r.demandHits.length
                  ? r.demandHits
                      .map((h) => `${h.sku} — ${r.po.marketplace} #${h.rank} best-seller (${fmtCurrency(h.gmv)} GMV, +${h.points})`)
                      .join("\n")
                  : undefined;
                return (
                  <tr
                    key={r.po.id}
                    onClick={() => setSelected(r)}
                    className="group cursor-pointer transition-colors hover:bg-[var(--mp-primary)]/[0.06]"
                  >
                    <td
                      className={`po-table-sticky-col sticky z-10 bg-white px-1.5 py-1 text-neutral-500 transition-colors group-hover:bg-[#fbf9f2] dark:bg-neutral-900 dark:group-hover:bg-neutral-800 ${
                        r.isOverdue ? "border-l-2 border-l-[#d03b3b]" : ""
                      }`}
                      style={{ left: STICKY_LEFT.rank }}
                    >
                      {r.rank || "—"}
                    </td>
                    <td
                      className="po-table-sticky-col sticky z-10 bg-white px-1.5 py-1 transition-colors group-hover:bg-[#fbf9f2] dark:bg-neutral-900 dark:group-hover:bg-neutral-800"
                      style={{ left: STICKY_LEFT.priority }}
                    >
                      <div className="flex items-center gap-1">
                        <PriorityBadge level={r.level} compact />
                        {r.isOverdue && <AlertTriangle size={11} className="animate-pulse shrink-0 text-[#d03b3b]" />}
                      </div>
                    </td>
                    <td
                      className="po-table-sticky-col sticky z-10 truncate bg-white px-1.5 py-1 font-medium transition-colors group-hover:bg-[#fbf9f2] dark:bg-neutral-900 dark:group-hover:bg-neutral-800"
                      style={{ left: STICKY_LEFT.poNumber }}
                      title={r.po.id}
                    >
                      {r.po.id}
                    </td>
                    <td
                      className="po-table-sticky-col sticky z-10 bg-white px-1.5 py-1 transition-colors group-hover:bg-[#fbf9f2] dark:bg-neutral-900 dark:group-hover:bg-neutral-800"
                      style={{ left: STICKY_LEFT.marketplace, boxShadow: "2px 0 0 0 rgba(0,0,0,0.04)" }}
                    >
                      <MarketplaceBadge marketplace={r.po.marketplace} compact />
                    </td>
                    <td className="px-1.5 py-1 tabular-nums font-medium">{r.score}</td>
                    <td className="truncate px-1.5 py-1" title={r.po.city}>
                      {r.po.city}
                    </td>
                    <td className="truncate px-1.5 py-1 text-neutral-500" title={r.po.warehouse}>
                      {r.po.warehouse}
                    </td>
                    <td className="px-1.5 py-1 text-right tabular-nums">{r.po.pendingQty.toLocaleString("en-IN")}</td>
                    <td className="px-1.5 py-1 text-right tabular-nums">{fmtCurrency(r.po.poValue)}</td>
                    <td className="whitespace-nowrap px-1.5 py-1 text-neutral-500">{fmtShortDate(r.po.expiryDate)}</td>
                    <td className="px-1.5 py-1">
                      <OperationalDelayBadge days={r.operationalDelayDays} compact />
                    </td>
                    <td className="px-1.5 py-1 text-center" title={demandTitle}>
                      {isHighDemand && <Flame size={12} className="mx-auto text-[#ec835a]" />}
                    </td>
                    <td className="min-w-[220px] whitespace-normal break-words px-1.5 py-1 leading-snug text-neutral-500" title={reason || undefined}>
                      {reason || "—"}
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
