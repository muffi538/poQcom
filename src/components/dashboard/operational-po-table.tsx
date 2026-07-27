"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import { PurchaseOrder } from "@/types/purchase-order";
import { fmtDate } from "./po-format";
import { ExportButton } from "./export-button";
import { CsvCell } from "@/lib/export/csv";
import { WorkflowDetailPanel } from "./workflow-detail-panel";
import { PoDateRangeFilter } from "./po-date-range-filter";

export type OperationalVariant = "dispatched" | "in_transit" | "scheduled" | "cancelled" | "low_value_cant_dispatch";

interface ColumnDef {
  key: string;
  label: string;
  width: number;
  render: (po: PurchaseOrder) => React.ReactNode;
  csv: (po: PurchaseOrder) => CsvCell;
}

const products = (po: PurchaseOrder) => `${po.skuDescription || po.sku || "—"}`;
const qty = (po: PurchaseOrder) => po.orderedQty.toLocaleString("en-IN");

// Exact per-status field lists from PO_Operations_Architecture_1.md. No
// priority/score column anywhere here — these five statuses (Dispatched,
// In Transit, Scheduled, Cancelled, Low Value Can't Dispatch) only ever
// display operational information (Golden Rule #5). Shipment ID,
// Destination, Cancellation Reason and Reason aren't carried by any
// workbook mapping today — shown as "—" rather than fabricated; they'll
// populate automatically the moment a real column is mapped for them.
const VARIANT_COLUMNS: Record<OperationalVariant, ColumnDef[]> = {
  dispatched: [
    { key: "po", label: "PO Number", width: 130, render: (po) => po.id, csv: (po) => po.id },
    { key: "city", label: "City", width: 90, render: (po) => po.city || "—", csv: (po) => po.city },
    { key: "dispatcher", label: "Dispatcher", width: 110, render: (po) => po.dispatcherName ?? "—", csv: (po) => po.dispatcherName },
    { key: "dispatchedFrom", label: "Dispatched From", width: 110, render: (po) => po.dispatchedFrom ?? "—", csv: (po) => po.dispatchedFrom },
    { key: "dispatchDate", label: "Dispatch Date", width: 100, render: (po) => fmtDate(po.dispatchDate), csv: (po) => po.dispatchDate },
    {
      key: "fulfilmentDays",
      label: "Delivery Days",
      width: 90,
      render: (po) => (po.fulfilmentDays === null ? "—" : `${po.fulfilmentDays}d`),
      csv: (po) => po.fulfilmentDays,
    },
    { key: "qty", label: "Qty", width: 70, render: qty, csv: (po) => po.orderedQty },
    {
      key: "fillRate",
      label: "Fill Rate %",
      width: 80,
      render: (po) => (po.fillRate === null ? "—" : `${po.fillRate}%`),
      csv: (po) => po.fillRate,
    },
    { key: "shipmentId", label: "Shipment ID", width: 110, render: (po) => po.shipmentId ?? "—", csv: (po) => po.shipmentId },
    { key: "fc", label: "FC", width: 140, render: (po) => po.warehouse || "—", csv: (po) => po.warehouse },
    { key: "products", label: "Products", width: 220, render: products, csv: products },
  ],
  in_transit: [
    { key: "po", label: "PO Number", width: 130, render: (po) => po.id, csv: (po) => po.id },
    { key: "dispatchDate", label: "Dispatch Date", width: 100, render: (po) => fmtDate(po.dispatchDate), csv: (po) => po.dispatchDate },
    { key: "qty", label: "Qty", width: 70, render: qty, csv: (po) => po.orderedQty },
    { key: "destination", label: "Destination", width: 160, render: (po) => po.warehouse || "—", csv: (po) => po.warehouse },
    { key: "products", label: "Products", width: 260, render: products, csv: products },
  ],
  scheduled: [
    { key: "po", label: "PO Number", width: 130, render: (po) => po.id, csv: (po) => po.id },
    { key: "scheduledDate", label: "Scheduled Date", width: 110, render: (po) => fmtDate(po.appointmentDate), csv: (po) => po.appointmentDate },
    { key: "qty", label: "Qty", width: 70, render: qty, csv: (po) => po.orderedQty },
    { key: "products", label: "Products", width: 220, render: products, csv: products },
    { key: "fc", label: "FC", width: 140, render: (po) => po.warehouse || "—", csv: (po) => po.warehouse },
    { key: "city", label: "City", width: 100, render: (po) => po.city || "—", csv: (po) => po.city },
  ],
  cancelled: [
    { key: "po", label: "PO Number", width: 130, render: (po) => po.id, csv: (po) => po.id },
    { key: "qty", label: "Qty", width: 70, render: qty, csv: (po) => po.orderedQty },
    { key: "products", label: "Products", width: 260, render: products, csv: products },
    { key: "reason", label: "Cancellation Reason", width: 200, render: () => "—", csv: () => null },
  ],
  low_value_cant_dispatch: [
    { key: "po", label: "PO Number", width: 130, render: (po) => po.id, csv: (po) => po.id },
    { key: "qty", label: "Qty", width: 70, render: qty, csv: (po) => po.orderedQty },
    { key: "products", label: "Products", width: 220, render: products, csv: products },
    { key: "city", label: "City", width: 100, render: (po) => po.city || "—", csv: (po) => po.city },
    { key: "reason", label: "Reason", width: 160, render: () => "—", csv: () => null },
  ],
};

// Only the Dispatched variant gets the Dispatch-workbook extra fields —
// the same stored (never recomputed) columns the Delivered workflow
// shows, since a PO already reaches Dispatched the moment the Dispatch
// workbook has a record for it. The other four variants (In Transit,
// Scheduled, Cancelled, Low Value) keep the base fields only, unchanged.
function dispatchedExtraFields(po: PurchaseOrder) {
  return [
    { label: "Delivery Days", value: po.fulfilmentDays === null ? "—" : `${po.fulfilmentDays}d` },
    { label: "Fill Rate", value: po.fillRate === null ? "—" : `${po.fillRate}%` },
    { label: "Dispatcher", value: po.dispatcherName ?? "—" },
    { label: "Dispatched From", value: po.dispatchedFrom ?? "—" },
    { label: "Driver", value: po.driverName ?? "—" },
    { label: "Appointment Qty", value: po.appointmentQty === null ? "—" : po.appointmentQty.toLocaleString("en-IN") },
    { label: "Shipment ID", value: po.shipmentId ?? "—" },
    { label: "Invoice", value: po.invoice === null ? "—" : po.invoice ? "Yes" : "No" },
    { label: "MRP Label", value: po.mrpLabel === null ? "—" : po.mrpLabel ? "Yes" : "No" },
  ];
}

const inputClasses =
  "rounded-lg border border-frido-border bg-white px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-[var(--mp-accent)] dark:border-white/10 dark:bg-neutral-900";

// Pure display table for the five status buckets the doc marks
// "No priority calculation" — Dispatched, In Transit, Scheduled,
// Cancelled, Low Value Can't Dispatch. Never touches rules/, demand/, or
// computePoPriority; takes PurchaseOrder[] straight from the workflow
// router, nothing computed on top.
export function OperationalPoTable({
  title,
  note,
  variant,
  pos,
  fillHeight,
}: {
  title: string;
  note?: string;
  variant: OperationalVariant;
  pos: PurchaseOrder[];
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

  const columns = VARIANT_COLUMNS[variant];
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

  const exportRows: CsvCell[][] = filtered.map((po) => columns.map((c) => c.csv(po)));

  return (
    <div className={`flex flex-col gap-1 ${fillHeight ? "min-h-0 flex-1" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold">
            {title} <span className="font-normal text-neutral-500">({pos.length})</span>
          </h3>
          {note && <p className="text-[11px] text-neutral-500">{note}</p>}
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
              <PoDateRangeFilter idPrefix={`${variant}-op`} from={poDateFrom} to={poDateTo} onFromChange={setPoDateFrom} onToChange={setPoDateTo} />
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
          <ExportButton
            headers={columns.map((c) => c.label)}
            rows={exportRows}
            filename={`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`}
          />
        </div>
      </div>
      <div className={`glass-card flex flex-col overflow-hidden rounded-md ${fillHeight ? "min-h-0 flex-1" : ""}`}>
        <div className={`overflow-auto ${fillHeight ? "min-h-0 flex-1" : "max-h-[320px]"}`}>
          <table className="w-full table-fixed border-collapse text-left text-[13px]">
            <colgroup>
              {columns.map((c) => (
                <col key={c.key} style={{ width: c.width }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr className="border-b border-frido-border dark:border-white/10">
                {columns.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-1.5 py-1.5">
                    {c.label}
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
                  {columns.map((c) => (
                    <td key={c.key} className="truncate px-1.5" title={typeof c.render(po) === "string" ? (c.render(po) as string) : undefined}>
                      {c.render(po)}
                    </td>
                  ))}
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
          extraFields={variant === "dispatched" ? dispatchedExtraFields(selected) : []}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
