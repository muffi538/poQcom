"use client";

import { useMemo, useState } from "react";
import { PoRow } from "@/lib/dashboard/po-rows";
import { PriorityBadge } from "./priority-badge";
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
      <h2 className="text-sm font-semibold text-neutral-500">
        Priority Queue — Status = Pending only ({rows.length})
      </h2>
      {!hasRules && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
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

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
        {marketplaces.length > 1 && (
          <FilterSelect label="Marketplace" value={marketplaceFilter} onChange={setMarketplaceFilter} options={marketplaces} />
        )}
        <FilterSelect label="City" value={cityFilter} onChange={setCityFilter} options={cities} />
        <FilterSelect label="Priority" value={levelFilter} onChange={setLevelFilter} options={levels} />
        <select
          value={metroFilter}
          onChange={(e) => setMetroFilter(e.target.value as typeof metroFilter)}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="all">Metro / Non-Metro</option>
          <option value="metro">Metro only</option>
          <option value="non-metro">Non-metro only</option>
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={criticalOnly} onChange={(e) => setCriticalOnly(e.target.checked)} />
          Critical only
        </label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search PO # or SKU"
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="ml-auto rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              Sort: {SORT_LABELS[k]}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-500">{sorted.length} of {rows.length} POs</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full min-w-[1600px] text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
            <tr>
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
              ].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {sorted.map((r) => (
              <tr
                key={r.po.id}
                onClick={() => setSelected(r)}
                className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <td className="px-3 py-2">{r.rank || "—"}</td>
                <td className="px-3 py-2 tabular-nums">{r.score}</td>
                <td className="px-3 py-2">
                  <PriorityBadge level={r.level} />
                </td>
                <td className="px-3 py-2">{r.po.marketplace}</td>
                <td className="px-3 py-2 font-medium">{r.po.id}</td>
                <td className="px-3 py-2">{r.po.city}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.po.poRaisedDate)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.po.expiryDate)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.po.appointmentDate)}</td>
                <td className="px-3 py-2 tabular-nums">{r.po.pendingQty.toLocaleString("en-IN")}</td>
                <td className="px-3 py-2 tabular-nums">{fmtCurrency(r.po.poValue)}</td>
                <td className="px-3 py-2 tabular-nums">{r.daysRemaining}</td>
                <td className="px-3 py-2 tabular-nums">{r.slaConsumedPercent.toFixed(0)}%</td>
                <td className="px-3 py-2 tabular-nums">
                  {r.appointmentDelayDays === null ? "—" : `${r.appointmentDelayDays}d`}
                </td>
                <td className="px-3 py-2">{r.isMetroCity ? "Metro" : "—"}</td>
                <td className="px-3 py-2">{r.rulesTriggered.length ? r.rulesTriggered.join(", ") : "—"}</td>
                <td className="px-3 py-2">{r.recommendedAction ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="p-8 text-center text-sm text-neutral-500">No POs match these filters.</div>
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
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
    >
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
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="mb-2 text-sm font-semibold">
        {title} <span className="font-normal text-neutral-500">({rows.length})</span>
      </h3>
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => (
          <button
            key={r.po.id}
            onClick={() => onSelect(r)}
            className="rounded-md border border-neutral-200 px-2 py-1 text-left text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
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

