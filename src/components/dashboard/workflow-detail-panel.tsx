"use client";

import { X, PackageSearch } from "lucide-react";
import { PurchaseOrder } from "@/types/purchase-order";
import { StatusBadge } from "./status-badge";
import { MarketplaceBadge } from "./marketplace-badge";
import { fmtDate } from "./po-format";
import { SlideOverPortal } from "./slide-over-portal";

// Shared read-only detail slide-over for every non-Pending workflow
// (Delivered, Dispatched, In Transit, Scheduled, Cancelled, Low Value
// Can't Dispatch, Needs Review). Deliberately has no score/level/rank —
// those belong only to the Pending workflow's PoDetailPanel. `extraFields`
// carries whatever a workflow computes for itself (e.g. Delivered's
// Shipping Duration/Fill Rate/Dispatcher/Driver).
export function WorkflowDetailPanel({
  po,
  extraFields = [],
  onClose,
}: {
  po: PurchaseOrder;
  extraFields?: Array<{ label: string; value: string }>;
  onClose: () => void;
}) {
  const lineItems = (po.raw.lineItems as Array<{ sku: string; skuDescription: string; orderedQty: number }>) ?? [];

  return (
    <SlideOverPortal>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
        <div
          className="animate-fade-in-up h-full w-full max-w-lg overflow-y-auto border-l border-frido-border bg-white p-6 shadow-lg dark:border-white/10 dark:bg-neutral-900"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{po.id}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <MarketplaceBadge marketplace={po.marketplace} />
                <StatusBadge status={po.status} />
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                {po.city} · {po.warehouse}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 rounded-md bg-neutral-50 p-4 text-sm dark:bg-neutral-800/40">
            <Field label="PO Date" value={fmtDate(po.poRaisedDate)} />
            <Field label="Expiry Date" value={fmtDate(po.expiryDate)} />
            <Field label="Scheduled Date" value={fmtDate(po.appointmentDate)} />
            <Field label="Dispatch Date" value={fmtDate(po.dispatchDate)} />
            <Field label="Ordered Qty" value={po.orderedQty.toLocaleString("en-IN")} />
            <Field label="Dispatched Qty" value={po.dispatchedQty.toLocaleString("en-IN")} />
            {extraFields.map((f) => (
              <Field key={f.label} label={f.label} value={f.value} />
            ))}
          </dl>

          <div className="mt-6">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <PackageSearch size={15} className="text-neutral-400" />
              SKUs on this PO ({lineItems.length || 1})
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-600 dark:text-neutral-400">
              {(lineItems.length > 0
                ? lineItems
                : [{ sku: po.sku, skuDescription: po.skuDescription, orderedQty: po.orderedQty }]
              ).map((line, i) => (
                <li key={i} className="rounded-lg bg-neutral-50 px-3 py-1.5 dark:bg-neutral-800/40">
                  {line.skuDescription} ({line.sku}) — qty {line.orderedQty}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </SlideOverPortal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
