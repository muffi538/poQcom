"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import { PoRow } from "@/lib/dashboard/po-rows";
import { PoDetailPanel } from "./po-detail-panel";
import { MarketplaceBadge } from "./marketplace-badge";
import { StatusBadge } from "./status-badge";
import { OperationalDelayBadge } from "./operational-delay";
import { fmtDate, fmtCurrency } from "./po-format";
import { ExportButton } from "./export-button";
import { CsvCell } from "@/lib/export/csv";

const EXPORT_HEADERS = ["Status", "Marketplace", "PO Number", "City", "PO Date", "Expiry Date", "Pending Qty", "PO Value", "Operational Delay (days)"];

const inputClasses =
  "rounded-lg border border-frido-border bg-white px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-[var(--mp-accent)] dark:border-white/10 dark:bg-neutral-900";

// Read-only table for POs that are deliberately NOT run through the
// priority scoring chain (Expired, Delivered, Dispatched, Cancelled, or
// a status nobody's confirmed how to handle yet) — no rank/score/level/
// rules-triggered columns, since those would be meaningless (or
// misleadingly zero) here. City + Search filters (confirmed: every
// status tab keeps the same basic filtering the ranked table has,
// Priority excepted since nothing here is priority-scored).
export function SecondaryPoTable({
  title,
  note,
  rows,
}: {
  title: string;
  note?: string;
  rows: PoRow[];
}) {
  const [selected, setSelected] = useState<PoRow | null>(null);
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const cities = useMemo(() => Array.from(new Set(rows.map((r) => r.po.city))).sort(), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (cityFilter !== "all" && r.po.city !== cityFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!r.po.id.toLowerCase().includes(q) && !r.po.sku.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, cityFilter, search]);

  const exportRows: CsvCell[][] = filteredRows.map((r) => [
    r.po.status,
    r.po.marketplace,
    r.po.id,
    r.po.city,
    r.po.poRaisedDate || null,
    r.po.expiryDate || null,
    r.po.pendingQty,
    r.po.poValue,
    r.operationalDelayDays,
  ]);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold">
            {title} <span className="font-normal text-neutral-500">({rows.length})</span>
          </h3>
          {note && <p className="text-[11px] text-neutral-500">{note}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {rows.length > 0 && (
            <>
              <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className={inputClasses}>
                <option value="all">City: All</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
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
                {filteredRows.length} / {rows.length}
              </span>
            </>
          )}
          <ExportButton headers={EXPORT_HEADERS} rows={exportRows} filename={`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`} />
        </div>
      </div>
      <div className="glass-card overflow-hidden rounded-md">
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full table-fixed border-collapse text-left text-[13px]">
            <colgroup>
              <col style={{ width: 110 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 76 }} />
              <col style={{ width: 76 }} />
              <col style={{ width: 60 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 100 }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr className="border-b border-frido-border dark:border-white/10">
                {["Status", "Mkt", "PO Number", "City", "PO Date", "Expiry", "Qty", "Value", "Op. Delay"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-1.5 py-1.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
              {filteredRows.map((r) => (
                <tr
                  key={r.po.id}
                  onClick={() => setSelected(r)}
                  className="h-10 cursor-pointer transition-colors hover:bg-[var(--mp-primary)]/[0.06]"
                >
                  <td className="truncate px-1.5">
                    <StatusBadge status={r.po.status} compact />
                  </td>
                  <td className="truncate px-1.5">
                    <MarketplaceBadge marketplace={r.po.marketplace} compact />
                  </td>
                  <td className="truncate px-1.5 font-medium" title={r.po.id}>
                    {r.po.id}
                  </td>
                  <td className="truncate px-1.5" title={r.po.city}>
                    {r.po.city}
                  </td>
                  <td className="whitespace-nowrap px-1.5 text-neutral-500">{fmtDate(r.po.poRaisedDate)}</td>
                  <td className="whitespace-nowrap px-1.5 text-neutral-500">{fmtDate(r.po.expiryDate)}</td>
                  <td className="px-1.5 tabular-nums">{r.po.pendingQty.toLocaleString("en-IN")}</td>
                  <td className="px-1.5 tabular-nums">{fmtCurrency(r.po.poValue)}</td>
                  <td className="px-1.5">
                    <OperationalDelayBadge days={r.operationalDelayDays} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredRows.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-neutral-500">
            <SearchX size={22} className="text-neutral-300" />
            {rows.length === 0 ? "No POs in this section." : "No POs match these filters."}
          </div>
        )}
      </div>
      {selected && <PoDetailPanel row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
