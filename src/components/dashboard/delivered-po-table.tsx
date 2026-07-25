"use client";

import { useMemo, useState } from "react";
import { Search, SearchX, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { DeliveredRow, buildDeliveredStats } from "@/lib/workflows/delivered-workflow";
import { MarketplaceBadge } from "./marketplace-badge";
import { StatusBadge } from "./status-badge";
import { fmtDate, fmtCurrency } from "./po-format";
import { ExportButton } from "./export-button";
import { CsvCell } from "@/lib/export/csv";
import { WorkflowDetailPanel } from "./workflow-detail-panel";
import { KpiCard } from "./kpi-card";

const inputClasses =
  "rounded-lg border border-frido-border bg-white px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-[var(--mp-accent)] dark:border-white/10 dark:bg-neutral-900";

const EXPORT_HEADERS = [
  "Status",
  "Marketplace",
  "PO Number",
  "City",
  "PO Date",
  "Dispatch Date",
  "Delivery Days",
  "Dispatcher",
  "Dispatched From",
  "Ordered Qty",
  "Appointment Qty",
  "Dispatched Qty",
  "Fill Rate (%)",
  "Value",
  "Pending Qty",
  "Driver",
  "Shipment ID",
  "Invoice",
  "MRP Label",
];

type ColumnKey =
  | "status"
  | "marketplace"
  | "po"
  | "city"
  | "poDate"
  | "dispatchDate"
  | "fulfilmentDays"
  | "dispatcher"
  | "dispatchedFrom"
  | "orderedQty"
  | "appointmentQty"
  | "dispatchedQty"
  | "fillRate"
  | "value";

// Exact column order requested: Status, Marketplace, PO Number, City, PO
// Date, Dispatch Date, Delivery Days, Dispatcher, Dispatched From,
// Ordered Qty, Appointment Qty, Dispatched Qty, Fill Rate %, Value.
const COLUMNS: Array<{ key: ColumnKey; label: string; width: number; numeric?: boolean }> = [
  { key: "status", label: "Status", width: 90 },
  { key: "marketplace", label: "Marketplace", width: 112 },
  { key: "po", label: "PO Number", width: 132 },
  { key: "city", label: "City", width: 104 },
  { key: "poDate", label: "PO Date", width: 100 },
  { key: "dispatchDate", label: "Dispatch Date", width: 118 },
  { key: "fulfilmentDays", label: "Delivery Days", width: 110, numeric: true },
  { key: "dispatcher", label: "Dispatcher", width: 116 },
  { key: "dispatchedFrom", label: "Dispatched From", width: 142 },
  { key: "orderedQty", label: "Ordered Qty", width: 98, numeric: true },
  { key: "appointmentQty", label: "Appointment Qty", width: 128, numeric: true },
  { key: "dispatchedQty", label: "Dispatched Qty", width: 132, numeric: true },
  { key: "fillRate", label: "Fill Rate %", width: 98, numeric: true },
  { key: "value", label: "Value", width: 100, numeric: true },
];

// Ascending comparators — the click handler flips the sign for "desc".
// Nulls always sort last regardless of direction, so an unmatched
// Delivered PO's blank fields don't scatter across the middle of a sort.
const COMPARATORS: Record<ColumnKey, (a: DeliveredRow, b: DeliveredRow) => number> = {
  status: () => 0, // constant "Delivered" for every row in this table — nothing to order by
  marketplace: (a, b) => a.po.marketplace.localeCompare(b.po.marketplace),
  po: (a, b) => a.po.id.localeCompare(b.po.id),
  city: (a, b) => a.po.city.localeCompare(b.po.city),
  poDate: (a, b) => (a.po.poRaisedDate || "").localeCompare(b.po.poRaisedDate || ""),
  dispatchDate: (a, b) => nullsLast(a.po.dispatchDate, b.po.dispatchDate, (x, y) => x.localeCompare(y)),
  fulfilmentDays: (a, b) => nullsLast(a.po.fulfilmentDays, b.po.fulfilmentDays, (x, y) => x - y),
  dispatcher: (a, b) => nullsLast(a.po.dispatcherName, b.po.dispatcherName, (x, y) => x.localeCompare(y)),
  dispatchedFrom: (a, b) => nullsLast(a.po.dispatchedFrom, b.po.dispatchedFrom, (x, y) => x.localeCompare(y)),
  orderedQty: (a, b) => a.po.orderedQty - b.po.orderedQty,
  appointmentQty: (a, b) => nullsLast(a.po.appointmentQty, b.po.appointmentQty, (x, y) => x - y),
  dispatchedQty: (a, b) => a.po.dispatchedQty - b.po.dispatchedQty,
  fillRate: (a, b) => nullsLast(a.po.fillRate, b.po.fillRate, (x, y) => x - y),
  value: (a, b) => nullsLast(a.po.poValue, b.po.poValue, (x, y) => x - y),
};

function nullsLast<T>(a: T | null, b: T | null, compare: (a: T, b: T) => number): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return compare(a, b);
}

// The Delivered workflow's table (PO_Operations_Architecture_1.md) — no
// score/rank/priority anywhere, by construction: DeliveredRow has no
// such field, and this component never imports rules/ or demand/. Every
// field shown here (Fill Rate, Fulfilment Days, Dispatcher, Dispatched
// From, ...) is read straight off the stored PurchaseOrder columns — see
// buildDeliveredRows/buildDeliveredStats — never recomputed here, so an
// unmatched Delivered PO shows "—", never a fabricated value.
type FillRateBucket = "all" | "gt90" | "lt50";
type DeliverySpeedBucket = "all" | "le3" | "4to7" | "gt7";

function matchesFillRateBucket(fillRate: number | null, bucket: FillRateBucket): boolean {
  if (bucket === "all") return true;
  if (fillRate === null) return false; // an unmatched PO has no rate to test against either bucket
  if (bucket === "gt90") return fillRate > 90;
  return fillRate < 50; // lt50
}

function matchesDeliverySpeedBucket(fulfilmentDays: number | null, bucket: DeliverySpeedBucket): boolean {
  if (bucket === "all") return true;
  if (fulfilmentDays === null) return false;
  if (bucket === "le3") return fulfilmentDays <= 3;
  if (bucket === "4to7") return fulfilmentDays >= 4 && fulfilmentDays <= 7;
  return fulfilmentDays > 7; // gt7
}

export function DeliveredPoTable({ rows }: { rows: DeliveredRow[] }) {
  const [selected, setSelected] = useState<DeliveredRow | null>(null);
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>("all");
  const [dispatcherFilter, setDispatcherFilter] = useState<string>("all");
  const [dispatchedFromFilter, setDispatchedFromFilter] = useState<string>("all");
  const [fillRateBucket, setFillRateBucket] = useState<FillRateBucket>("all");
  const [deliverySpeedBucket, setDeliverySpeedBucket] = useState<DeliverySpeedBucket>("all");
  const [poDateFrom, setPoDateFrom] = useState<string>("");
  const [poDateTo, setPoDateTo] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<ColumnKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const cities = useMemo(() => Array.from(new Set(rows.map((r) => r.po.city))).filter(Boolean).sort(), [rows]);
  const marketplaces = useMemo(() => Array.from(new Set(rows.map((r) => r.po.marketplace))).filter(Boolean).sort(), [rows]);
  const dispatchers = useMemo(
    () => Array.from(new Set(rows.map((r) => r.po.dispatcherName).filter((v): v is string => Boolean(v)))).sort(),
    [rows]
  );
  const dispatchedFroms = useMemo(
    () => Array.from(new Set(rows.map((r) => r.po.dispatchedFrom).filter((v): v is string => Boolean(v)))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (cityFilter !== "all" && r.po.city !== cityFilter) return false;
      if (marketplaceFilter !== "all" && r.po.marketplace !== marketplaceFilter) return false;
      if (dispatcherFilter !== "all" && r.po.dispatcherName !== dispatcherFilter) return false;
      if (dispatchedFromFilter !== "all" && r.po.dispatchedFrom !== dispatchedFromFilter) return false;
      if (!matchesFillRateBucket(r.po.fillRate, fillRateBucket)) return false;
      if (!matchesDeliverySpeedBucket(r.po.fulfilmentDays, deliverySpeedBucket)) return false;
      // PO Date range — ISO yyyy-mm-dd strings compare correctly as-is,
      // no Date parsing needed. A PO with no poRaisedDate never matches a
      // set range rather than being silently included.
      if (poDateFrom || poDateTo) {
        if (!r.po.poRaisedDate) return false;
        if (poDateFrom && r.po.poRaisedDate < poDateFrom) return false;
        if (poDateTo && r.po.poRaisedDate > poDateTo) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = [r.po.id, r.po.sku, r.po.dispatcherName, r.po.dispatchedFrom, r.po.shipmentId]
          .filter(Boolean)
          .map((v) => (v as string).toLowerCase());
        if (!haystack.some((v) => v.includes(q))) return false;
      }
      return true;
    });
  }, [rows, cityFilter, marketplaceFilter, dispatcherFilter, dispatchedFromFilter, fillRateBucket, deliverySpeedBucket, poDateFrom, poDateTo, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const cmp = COMPARATORS[sortKey];
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => cmp(a, b) * dir);
  }, [filtered, sortKey, sortDir]);

  const stats = useMemo(() => buildDeliveredStats(filtered), [filtered]);

  function handleSort(key: ColumnKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const exportRows: CsvCell[][] = sorted.map((r) => [
    r.po.status,
    r.po.marketplace,
    r.po.id,
    r.po.city,
    r.po.poRaisedDate || null,
    r.po.dispatchDate,
    r.po.fulfilmentDays,
    r.po.dispatcherName,
    r.po.dispatchedFrom,
    r.po.orderedQty,
    r.po.appointmentQty,
    r.po.dispatchedQty,
    r.po.fillRate,
    r.po.poValue,
    r.po.pendingQty,
    r.po.driverName,
    r.po.shipmentId,
    r.po.invoice === null ? null : r.po.invoice ? "TRUE" : "FALSE",
    r.po.mrpLabel === null ? null : r.po.mrpLabel ? "TRUE" : "FALSE",
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
              {marketplaces.length > 1 && (
                <select value={marketplaceFilter} onChange={(e) => setMarketplaceFilter(e.target.value)} className={inputClasses}>
                  <option value="all">Marketplace: All</option>
                  {marketplaces.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              )}
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
              {dispatchers.length > 0 && (
                <select value={dispatcherFilter} onChange={(e) => setDispatcherFilter(e.target.value)} className={inputClasses}>
                  <option value="all">Dispatcher: All</option>
                  {dispatchers.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
              {dispatchedFroms.length > 0 && (
                <select value={dispatchedFromFilter} onChange={(e) => setDispatchedFromFilter(e.target.value)} className={inputClasses}>
                  <option value="all">Dispatched From: All</option>
                  {dispatchedFroms.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
              <select value={fillRateBucket} onChange={(e) => setFillRateBucket(e.target.value as FillRateBucket)} className={inputClasses}>
                <option value="all">Fill Rate: All</option>
                <option value="gt90">Fill Rate &gt; 90%</option>
                <option value="lt50">Fill Rate &lt; 50%</option>
              </select>
              <select
                value={deliverySpeedBucket}
                onChange={(e) => setDeliverySpeedBucket(e.target.value as DeliverySpeedBucket)}
                className={inputClasses}
              >
                <option value="all">Delivered in: All</option>
                <option value="le3">≤ 3 days</option>
                <option value="4to7">4–7 days</option>
                <option value="gt7">&gt; 7 days</option>
              </select>
              <div className="flex items-center gap-1">
                <label className="text-[11px] text-neutral-500" htmlFor="delivered-po-date-from">
                  PO Date
                </label>
                <input
                  id="delivered-po-date-from"
                  type="date"
                  value={poDateFrom}
                  onChange={(e) => setPoDateFrom(e.target.value)}
                  className={`${inputClasses} w-[130px]`}
                />
                <span className="text-[11px] text-neutral-500">to</span>
                <input
                  type="date"
                  value={poDateTo}
                  onChange={(e) => setPoDateTo(e.target.value)}
                  className={`${inputClasses} w-[130px]`}
                />
                {(poDateFrom || poDateTo) && (
                  <button
                    onClick={() => {
                      setPoDateFrom("");
                      setPoDateTo("");
                    }}
                    className="text-[11px] text-neutral-500 underline transition-colors hover:text-neutral-900 dark:hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="relative">
                <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search PO / SKU / Dispatcher / Shipment ID"
                  className={`${inputClasses} w-52 pl-6`}
                />
              </div>
              <span className="text-[11px] text-neutral-500">
                {sorted.length} / {rows.length}
              </span>
            </>
          )}
          <ExportButton headers={EXPORT_HEADERS} rows={exportRows} filename="delivered-pos.csv" />
        </div>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <KpiCard label="Avg Delivery Days" value={stats.avgFulfilmentDays === null ? "—" : `${stats.avgFulfilmentDays}d`} tone="accent" />
          <KpiCard label="Avg Fill Rate" value={stats.avgFillRate === null ? "—" : `${stats.avgFillRate}%`} tone="accent" />
          <KpiCard label="Best Fill Rate" value={stats.bestFillRate === null ? "—" : `${stats.bestFillRate}%`} tone="low" />
          <KpiCard label="Fastest Delivery" value={stats.fastestDeliveryDays === null ? "—" : `${stats.fastestDeliveryDays}d`} tone="low" />
          <KpiCard label="Slowest Delivery" value={stats.slowestDeliveryDays === null ? "—" : `${stats.slowestDeliveryDays}d`} tone="high" />
        </div>
      )}

      <div className="glass-card overflow-hidden rounded-md">
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full table-fixed border-collapse text-left text-[13px]">
            <colgroup>
              {COLUMNS.map((c) => (
                <col key={c.key} style={{ width: c.width }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr className="border-b border-frido-border dark:border-white/10">
                {COLUMNS.map((c) => (
                  <th key={c.key} className="overflow-hidden px-1.5 py-1.5">
                    <button
                      onClick={() => handleSort(c.key)}
                      className="flex w-full items-center gap-0.5 overflow-hidden uppercase tracking-wide text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-white"
                    >
                      <span className="truncate" title={c.label}>
                        {c.label}
                      </span>
                      {sortKey === c.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp size={11} className="shrink-0" />
                        ) : (
                          <ArrowDown size={11} className="shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown size={11} className="shrink-0 opacity-30" />
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
              {sorted.map((r) => (
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
                  <td className="truncate px-1.5 text-neutral-500" title={r.po.city}>
                    {r.po.city}
                  </td>
                  <td className="whitespace-nowrap px-1.5 text-neutral-500">{fmtDate(r.po.poRaisedDate)}</td>
                  <td className="whitespace-nowrap px-1.5 text-neutral-500">{fmtDate(r.po.dispatchDate)}</td>
                  <td className="px-1.5 tabular-nums">{r.po.fulfilmentDays === null ? "—" : `${r.po.fulfilmentDays}d`}</td>
                  <td className="truncate px-1.5" title={r.po.dispatcherName ?? undefined}>
                    {r.po.dispatcherName ?? "—"}
                  </td>
                  <td className="truncate px-1.5" title={r.po.dispatchedFrom ?? undefined}>
                    {r.po.dispatchedFrom ?? "—"}
                  </td>
                  <td className="px-1.5 tabular-nums">{r.po.orderedQty.toLocaleString("en-IN")}</td>
                  <td className="px-1.5 tabular-nums">{r.po.appointmentQty === null ? "—" : r.po.appointmentQty.toLocaleString("en-IN")}</td>
                  <td className="px-1.5 tabular-nums">
                    {r.po.dispatchedQty.toLocaleString("en-IN")}
                    {r.po.appointmentQty !== null && (
                      <span className="text-neutral-400"> / {r.po.appointmentQty.toLocaleString("en-IN")}</span>
                    )}
                  </td>
                  <td className="px-1.5 tabular-nums">{r.po.fillRate === null ? "—" : `${r.po.fillRate}%`}</td>
                  <td className="px-1.5 tabular-nums">{fmtCurrency(r.po.poValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length === 0 && (
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
            { label: "Delivery Days", value: selected.po.fulfilmentDays === null ? "—" : `${selected.po.fulfilmentDays}d` },
            { label: "Pending Qty", value: selected.po.pendingQty.toLocaleString("en-IN") },
            { label: "Fill Rate", value: selected.po.fillRate === null ? "—" : `${selected.po.fillRate}%` },
            { label: "Dispatcher", value: selected.po.dispatcherName ?? "—" },
            { label: "Dispatched From", value: selected.po.dispatchedFrom ?? "—" },
            { label: "Driver", value: selected.po.driverName ?? "—" },
            { label: "Appointment Qty", value: selected.po.appointmentQty === null ? "—" : selected.po.appointmentQty.toLocaleString("en-IN") },
            { label: "PO Value", value: fmtCurrency(selected.po.poValue) },
            { label: "Shipment ID", value: selected.po.shipmentId ?? "—" },
            { label: "Consignment ID", value: selected.po.consignmentId ?? "—" },
            { label: "Invoice", value: selected.po.invoice === null ? "—" : selected.po.invoice ? "Yes" : "No" },
            { label: "MRP Label", value: selected.po.mrpLabel === null ? "—" : selected.po.mrpLabel ? "Yes" : "No" },
          ]}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
