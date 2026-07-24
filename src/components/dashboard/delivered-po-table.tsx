"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import { DeliveredRow } from "@/lib/workflows/delivered-workflow";
import { MarketplaceBadge } from "./marketplace-badge";
import { fmtDate } from "./po-format";
import { ExportButton } from "./export-button";
import { CsvCell } from "@/lib/export/csv";
import { WorkflowDetailPanel } from "./workflow-detail-panel";

const inputClasses =
  "rounded-lg border border-frido-border bg-white px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-[var(--mp-accent)] dark:border-white/10 dark:bg-neutral-900";

const EXPORT_HEADERS = [
  "PO Number",
  "Marketplace",
  "PO Date",
  "Dispatch Date",
  "Shipping Duration (days)",
  "Fill Rate (%)",
  "Dispatcher",
  "Driver",
  "Ordered Qty",
  "Dispatched Qty",
];

// The Delivered workflow's table (PO_Operations_Architecture_1.md) — no
// score/rank/priority anywhere, by construction: DeliveredRow has no
// such field, and this component never imports rules/ or demand/.
export function DeliveredPoTable({ rows }: { rows: DeliveredRow[] }) {
  const [selected, setSelected] = useState<DeliveredRow | null>(null);
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const cities = useMemo(() => Array.from(new Set(rows.map((r) => r.po.city))).filter(Boolean).sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (cityFilter !== "all" && r.po.city !== cityFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!r.po.id.toLowerCase().includes(q) && !r.po.sku.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, cityFilter, search]);

  const exportRows: CsvCell[][] = filtered.map((r) => [
    r.po.id,
    r.po.marketplace,
    r.po.poRaisedDate || null,
    r.po.dispatchDate,
    r.shippingDurationDays,
    r.fillRate,
    r.dispatcherName,
    r.driverName,
    r.po.orderedQty,
    r.po.dispatchedQty,
  ]);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold">
            Delivered POs <span className="font-normal text-neutral-500">({rows.length})</span>
          </h3>
          <p className="text-[11px] text-neutral-500">Fulfilled — read-only, kept for analytics/trends. No priority scoring.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {rows.length > 0 && (
            <>
              {cities.length > 0 && (
                <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className={inputClasses}>
                  <option value="all">City: All</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
              <div className="relative">
                <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search PO # / SKU"
                  className={`${inputClasses} w-36 pl-6`}
                />
              </div>
              <span className="text-[11px] text-neutral-500">
                {filtered.length} / {rows.length}
              </span>
            </>
          )}
          <ExportButton headers={EXPORT_HEADERS} rows={exportRows} filename="delivered-pos.csv" />
        </div>
      </div>
      <div className="glass-card overflow-hidden rounded-md">
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full table-fixed border-collapse text-left text-[13px]">
            <colgroup>
              <col style={{ width: 130 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 80 }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr className="border-b border-frido-border dark:border-white/10">
                {["PO Number", "Mkt", "PO Date", "Dispatch Date", "Shipping Time", "Fill Rate", "Dispatcher", "Driver", "Ordered", "Dispatched"].map(
                  (h) => (
                    <th key={h} className="whitespace-nowrap px-1.5 py-1.5">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
              {filtered.map((r) => (
                <tr
                  key={r.po.id}
                  onClick={() => setSelected(r)}
                  className="h-10 cursor-pointer transition-colors hover:bg-[var(--mp-primary)]/[0.06]"
                >
                  <td className="truncate px-1.5 font-medium" title={r.po.id}>
                    {r.po.id}
                  </td>
                  <td className="truncate px-1.5">
                    <MarketplaceBadge marketplace={r.po.marketplace} compact />
                  </td>
                  <td className="whitespace-nowrap px-1.5 text-neutral-500">{fmtDate(r.po.poRaisedDate)}</td>
                  <td className="whitespace-nowrap px-1.5 text-neutral-500">{fmtDate(r.po.dispatchDate)}</td>
                  <td className="px-1.5 tabular-nums">{r.shippingDurationDays === null ? "—" : `${r.shippingDurationDays}d`}</td>
                  <td className="px-1.5 tabular-nums">{r.fillRate === null ? "—" : `${r.fillRate}%`}</td>
                  <td className="truncate px-1.5" title={r.dispatcherName ?? undefined}>
                    {r.dispatcherName ?? "—"}
                  </td>
                  <td className="truncate px-1.5" title={r.driverName ?? undefined}>
                    {r.driverName ?? "—"}
                  </td>
                  <td className="px-1.5 tabular-nums">{r.po.orderedQty.toLocaleString("en-IN")}</td>
                  <td className="px-1.5 tabular-nums">{r.po.dispatchedQty.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-neutral-500">
            <SearchX size={22} className="text-neutral-300" />
            {rows.length === 0 ? "No POs in this section." : "No POs match these filters."}
          </div>
        )}
      </div>
      {selected && (
        <WorkflowDetailPanel
          po={selected.po}
          extraFields={[
            { label: "Shipping Duration", value: selected.shippingDurationDays === null ? "—" : `${selected.shippingDurationDays}d` },
            { label: "Fill Rate", value: selected.fillRate === null ? "—" : `${selected.fillRate}%` },
            { label: "Dispatcher", value: selected.dispatcherName ?? "—" },
            { label: "Driver", value: selected.driverName ?? "—" },
          ]}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
