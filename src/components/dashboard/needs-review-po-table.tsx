"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import { PurchaseOrder } from "@/types/purchase-order";
import { StatusBadge } from "./status-badge";
import { MarketplaceBadge } from "./marketplace-badge";
import { fmtDate, fmtCurrency } from "./po-format";
import { ExportButton } from "./export-button";
import { CsvCell } from "@/lib/export/csv";
import { WorkflowDetailPanel } from "./workflow-detail-panel";
import { PoDateRangeFilter } from "./po-date-range-filter";

const inputClasses =
  "rounded-lg border border-frido-border bg-white px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-[var(--mp-accent)] dark:border-white/10 dark:bg-neutral-900";

const EXPORT_HEADERS = ["Status", "Marketplace", "PO Number", "City", "PO Date", "Expiry Date", "Qty", "Value"];

// Needs Review (PO_Operations_Architecture_1.md): unknown statuses,
// import failures, missing mappings, invalid data. Never calculates
// priority — takes PurchaseOrder[] straight from the workflow router,
// same as the other non-Pending tables, no rules/demand dependency.
// Reused as-is for the "All" tab (every status combined) since its
// column set — Status/Marketplace/PO/City/Dates/Qty/Value — is status-
// agnostic; only the title/note differ there.
export function NeedsReviewPoTable({
  pos,
  title = "Needs Review",
  note = "Unrecognized status text, import failures, or missing mappings — never scored until reclassified.",
  fillHeight,
}: {
  pos: PurchaseOrder[];
  title?: string;
  note?: string;
  // True on marketplace pages (one tab per status) — the table should
  // stretch to fill whatever viewport height is left instead of capping
  // at a fixed max-height and leaving dead space below. False on
  // Overview's collapsible section, which stays a bounded scroll region.
  fillHeight?: boolean;
}) {
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [poDateFrom, setPoDateFrom] = useState<string>("");
  const [poDateTo, setPoDateTo] = useState<string>("");
  const [search, setSearch] = useState("");

  const cities = useMemo(() => Array.from(new Set(pos.map((po) => po.city))).filter(Boolean).sort(), [pos]);

  const filtered = useMemo(() => {
    return pos.filter((po) => {
      if (cityFilter !== "all" && po.city !== cityFilter) return false;
      // ISO yyyy-mm-dd strings compare correctly as-is.
      if (poDateFrom && po.poRaisedDate < poDateFrom) return false;
      if (poDateTo && po.poRaisedDate > poDateTo) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!po.id.toLowerCase().includes(q) && !po.sku.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [pos, cityFilter, poDateFrom, poDateTo, search]);

  const exportRows: CsvCell[][] = filtered.map((po) => [
    po.status,
    po.marketplace,
    po.id,
    po.city,
    po.poRaisedDate || null,
    po.expiryDate || null,
    po.orderedQty,
    po.poValue,
  ]);

  return (
    <div className={`flex flex-col gap-1 ${fillHeight ? "min-h-0 flex-1" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold">
            {title} <span className="font-normal text-neutral-500">({pos.length})</span>
          </h3>
          <p className="text-[11px] text-neutral-500">{note}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {pos.length > 0 && (
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
              <PoDateRangeFilter idPrefix="needs-review" from={poDateFrom} to={poDateTo} onFromChange={setPoDateFrom} onToChange={setPoDateTo} />
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
                {filtered.length} / {pos.length}
              </span>
            </>
          )}
          <ExportButton headers={EXPORT_HEADERS} rows={exportRows} filename={`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`} />
        </div>
      </div>
      <div className={`glass-card flex flex-col overflow-hidden rounded-md ${fillHeight ? "min-h-0 flex-1" : ""}`}>
        <div className={`overflow-auto ${fillHeight ? "min-h-0 flex-1" : "max-h-[320px]"}`}>
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
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr className="border-b border-frido-border dark:border-white/10">
                {["Status", "Mkt", "PO Number", "City", "PO Date", "Expiry", "Qty", "Value"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-1.5 py-1.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
              {filtered.map((po) => (
                <tr
                  key={po.id}
                  onClick={() => setSelected(po)}
                  className="h-10 cursor-pointer transition-colors hover:bg-[var(--mp-primary)]/[0.06]"
                >
                  <td className="truncate px-1.5">
                    <StatusBadge status={po.status} compact />
                  </td>
                  <td className="truncate px-1.5">
                    <MarketplaceBadge marketplace={po.marketplace} compact />
                  </td>
                  <td className="truncate px-1.5 font-medium" title={po.id}>
                    {po.id}
                  </td>
                  <td className="truncate px-1.5" title={po.city}>
                    {po.city}
                  </td>
                  <td className="whitespace-nowrap px-1.5 text-neutral-500">{fmtDate(po.poRaisedDate)}</td>
                  <td className="whitespace-nowrap px-1.5 text-neutral-500">{fmtDate(po.expiryDate)}</td>
                  <td className="px-1.5 tabular-nums">{po.orderedQty.toLocaleString("en-IN")}</td>
                  <td className="px-1.5 tabular-nums">{fmtCurrency(po.poValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-neutral-500">
            <SearchX size={22} className="text-neutral-300" />
            {pos.length === 0 ? "No POs in this section." : "No POs match these filters."}
          </div>
        )}
      </div>
      {selected && (
        <WorkflowDetailPanel
          po={selected}
          extraFields={[{ label: "Raw Status", value: selected.status || "—" }]}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
