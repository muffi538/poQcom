"use client";

import { useMemo, useState } from "react";
import { Search, SearchX, ArrowUpDown, MapPinned } from "lucide-react";
import { PoRow } from "@/lib/dashboard/po-rows";
import { PriorityBadge } from "./priority-badge";
import { MarketplaceBadge } from "./marketplace-badge";
import { SlaBar } from "./sla-bar";
import { PoDetailPanel } from "./po-detail-panel";
import { fmtDate, fmtCurrency } from "./po-format";

type SortKey =
  | "priority"
  | "expiry"
  | "value"
  | "qty"
  | "sla"
  | "delay"
  | "newest"
  | "oldest";

const SORTERS: Record<SortKey, (a: PoRow, b: PoRow) => number> = {
  priority: (a, b) => b.score - a.score,
  expiry: (a, b) => a.daysRemaining - b.daysRemaining,
  value: (a, b) => (b.po.poValue ?? -1) - (a.po.poValue ?? -1),
  qty: (a, b) => b.po.pendingQty - a.po.pendingQty,
  sla: (a, b) => b.slaConsumedPercent - a.slaConsumedPercent,
  delay: (a, b) => (b.appointmentDelayDays ?? -1) - (a.appointmentDelayDays ?? -1),
  newest: (a, b) => (b.po.poRaisedDate || "").localeCompare(a.po.poRaisedDate || ""),
  oldest: (a, b) => (a.po.poRaisedDate || "").localeCompare(b.po.poRaisedDate || ""),
};

const SORT_LABELS: Record<SortKey, string> = {
  priority: "Highest Priority",
  expiry: "Expiry Nearest",
  value: "Highest Value",
  qty: "Largest Qty",
  sla: "Highest SLA Risk",
  delay: "Largest Operational Delay",
  newest: "Newest PO",
  oldest: "Oldest PO",
};

const inputClasses =
  "rounded-xl border border-frido-border bg-white px-3 py-1.5 text-sm shadow-sm outline-none transition-colors focus:border-[var(--mp-accent)] dark:border-white/10 dark:bg-neutral-900";

interface Props {
  rows: PoRow[];
  marketplaces: string[]; // distinct marketplaces present — filter hidden when there's only one
  hasRules: boolean;
}

export function PoControlTower({ rows, marketplaces, hasRules }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [metroFilter, setMetroFilter] = useState<"all" | "metro" | "non-metro">("all");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PoRow | null>(null);

  const cities = useMemo(
    () => Array.from(new Set(rows.map((r) => r.po.city))).sort(),
    [rows]
  );
  const levels = ["Critical", "High", "Medium", "Low", "Unscored"];

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (marketplaceFilter !== "all" && r.po.marketplace !== marketplaceFilter) return false;
      if (cityFilter !== "all" && r.po.city !== cityFilter) return false;
      if (levelFilter !== "all" && r.level !== levelFilter) return false;
      if (metroFilter === "metro" && !r.isMetroCity) return false;
      if (metroFilter === "non-metro" && r.isMetroCity) return false;
      if (criticalOnly && r.level !== "Critical") return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!r.po.id.toLowerCase().includes(q) && !r.po.sku.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, marketplaceFilter, cityFilter, levelFilter, metroFilter, criticalOnly, search]);

  const sorted = useMemo(
    () => [...filtered].sort(SORTERS[sortKey]),
    [filtered, sortKey]
  );

  // Sections computed from real fields only — none of these invent a
  // score. "Critical Action Queue" and "Safe to Postpone" are deliberately
  // NOT included here: both require the scoring engine's actual judgment,
  // which doesn't exist until rules are published (see hasRules below).
  const today = new Date().toISOString().slice(0, 10);
  const expiringSoon = useMemo(
    () => [...rows].filter((r) => r.daysRemaining <= 3).sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, 10),
    [rows]
  );
  const dispatchToday = useMemo(
    () => rows.filter((r) => r.po.appointmentDate === today),
    [rows, today]
  );
  const metroQueue = useMemo(
    () => rows.filter((r) => r.isMetroCity).sort((a, b) => a.daysRemaining - b.daysRemaining),
    [rows]
  );
  const delayedAppointments = useMemo(
    () =>
      [...rows]
        .filter((r) => (r.appointmentDelayDays ?? 0) > 0)
        .sort((a, b) => (b.appointmentDelayDays ?? 0) - (a.appointmentDelayDays ?? 0)),
    [rows]
  );
  const lowValueOrders = useMemo(
    () => rows.filter((r) => r.po.poValue !== null && r.po.poValue < 25000),
    [rows]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-500">
          Priority Queue <span className="text-neutral-400">— Status = Pending only</span>
        </h2>
        <span className="rounded-full bg-[var(--mp-primary)]/15 px-2.5 py-1 text-xs font-semibold text-[var(--mp-accent)]">
          {rows.length} POs
        </span>
      </div>

      {!hasRules && (
        <div className="animate-fade-in rounded-2xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          No rules are published yet, so Priority Score/Level/Rules Triggered/Recommended Action
          are honestly empty below (0 / Unscored / — ) rather than guessed. Sorting and filtering
          on real fields (expiry, value, qty, SLA%, delay) work today.
        </div>
      )}

      <SectionRow title="Expiring Soon (≤ 3 days)" rows={expiringSoon} onSelect={setSelected} />
      <SectionRow title="Today's Dispatch Queue (appointment today)" rows={dispatchToday} onSelect={setSelected} />
      <SectionRow title="Delayed Appointments" rows={delayedAppointments.slice(0, 10)} onSelect={setSelected} />
      <SectionRow title="Metro City Queue" rows={metroQueue.slice(0, 10)} onSelect={setSelected} />
      <SectionRow
        title="Low Value Orders (PO Value < ₹25,000)"
        rows={lowValueOrders.slice(0, 10)}
        onSelect={setSelected}
      />

      <div className="glass-card flex flex-wrap items-center gap-2 rounded-card p-3 shadow-sm">
        {marketplaces.length > 1 && (
          <FilterSelect label="Marketplace" value={marketplaceFilter} onChange={setMarketplaceFilter} options={marketplaces} />
        )}
        <FilterSelect label="City" value={cityFilter} onChange={setCityFilter} options={cities} />
        <FilterSelect label="Priority" value={levelFilter} onChange={setLevelFilter} options={levels} />
        <select
          value={metroFilter}
          onChange={(e) => setMetroFilter(e.target.value as typeof metroFilter)}
          className={inputClasses}
        >
          <option value="all">Metro / Non-Metro</option>
          <option value="metro">Metro only</option>
          <option value="non-metro">Non-metro only</option>
        </select>
        <label className="flex items-center gap-1.5 rounded-xl border border-frido-border px-3 py-1.5 text-sm shadow-sm dark:border-white/10">
          <input
            type="checkbox"
            checked={criticalOnly}
            onChange={(e) => setCriticalOnly(e.target.checked)}
            className="accent-[var(--mp-accent)]"
          />
          Critical only
        </label>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO # or SKU"
            className={`${inputClasses} pl-8`}
          />
        </div>
        <div className="relative ml-auto">
          <ArrowUpDown size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className={`${inputClasses} pl-8`}
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <span className="text-xs text-neutral-500">{sorted.length} of {rows.length}</span>
      </div>

      <div className="glass-card overflow-hidden rounded-card shadow-sm">
        <div className="max-h-[640px] overflow-auto">
          <table className="w-full min-w-[1600px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-white/95 text-xs uppercase tracking-wide text-neutral-500 backdrop-blur dark:bg-neutral-900/95">
              <tr className="border-b border-frido-border dark:border-white/10">
                {[
                  "#",
                  "Score",
                  "Level",
                  "Marketplace",
                  "PO Number",
                  "City / FC",
                  "PO Date",
                  "Expiry Date",
                  "Appt Date",
                  "Pending Qty",
                  "PO Value",
                  "Days Left",
                  "SLA %",
                  "Delay",
                  "Metro",
                  "Rules Triggered",
                  "Recommended Action",
                ].map((h, i) => (
                  <th
                    key={h}
                    className={`whitespace-nowrap px-3 py-2.5 font-medium ${
                      i === 4 ? "sticky left-0 z-10 bg-white/95 backdrop-blur dark:bg-neutral-900/95" : ""
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
              {sorted.map((r) => (
                <tr
                  key={r.po.id}
                  onClick={() => setSelected(r)}
                  className="group cursor-pointer transition-colors hover:bg-[var(--mp-primary)]/[0.06]"
                >
                  <td className="px-3 py-2.5 text-neutral-500">{r.rank || "—"}</td>
                  <td className="px-3 py-2.5 tabular-nums font-medium">{r.score}</td>
                  <td className="px-3 py-2.5">
                    <PriorityBadge level={r.level} />
                  </td>
                  <td className="px-3 py-2.5">
                    <MarketplaceBadge marketplace={r.po.marketplace} />
                  </td>
                  <td className="sticky left-0 z-[1] bg-white px-3 py-2.5 font-medium transition-colors group-hover:bg-[#fbf9f2] dark:bg-neutral-900 dark:group-hover:bg-neutral-800">
                    {r.po.id}
                  </td>
                  <td className="px-3 py-2.5">{r.po.city}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-neutral-500">{fmtDate(r.po.poRaisedDate)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-neutral-500">{fmtDate(r.po.expiryDate)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-neutral-500">{fmtDate(r.po.appointmentDate)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{r.po.pendingQty.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2.5 tabular-nums">{fmtCurrency(r.po.poValue)}</td>
                  <td className={`px-3 py-2.5 tabular-nums ${r.daysRemaining <= 2 ? "font-semibold text-[#d03b3b]" : ""}`}>
                    {r.daysRemaining}
                  </td>
                  <td className="px-3 py-2.5">
                    <SlaBar percent={r.slaConsumedPercent} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {r.appointmentDelayDays === null ? "—" : `${r.appointmentDelayDays}d`}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.isMetroCity ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                        <MapPinned size={12} /> Metro
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5">{r.rulesTriggered.length ? r.rulesTriggered.join(", ") : "—"}</td>
                  <td className="px-3 py-2.5">{r.recommendedAction ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-neutral-500">
            <SearchX size={24} className="text-neutral-300" />
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

function SectionRow({
  title,
  rows,
  onSelect,
}: {
  title: string;
  rows: PoRow[];
  onSelect: (r: PoRow) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="glass-card animate-fade-in-up rounded-card p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold">
        {title} <span className="font-normal text-neutral-500">({rows.length})</span>
      </h3>
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => (
          <button
            key={r.po.id}
            onClick={() => onSelect(r)}
            className="card-elevate rounded-xl border border-frido-border px-3 py-1.5 text-left text-xs shadow-sm dark:border-white/10"
          >
            <div className="font-medium">{r.po.id}</div>
            <div className="text-neutral-500">
              {r.po.marketplace} · {r.po.city} · {r.daysRemaining}d left
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
