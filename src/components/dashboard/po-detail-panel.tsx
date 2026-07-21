"use client";

import { PoRow } from "@/lib/dashboard/po-rows";
import { PriorityBadge } from "./priority-badge";
import { fmtDate, fmtCurrency } from "./po-format";

export function PoDetailPanel({ row, onClose }: { row: PoRow; onClose: () => void }) {
  const lineItems = (row.po.raw.lineItems as Array<{ sku: string; skuDescription: string; orderedQty: number }>) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{row.po.id}</h2>
            <p className="text-sm text-neutral-500">
              {row.po.marketplace} · {row.po.city} · {row.po.warehouse}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
            ✕
          </button>
        </div>

        <div className="mt-4">
          <PriorityBadge level={row.level} />
          <span className="ml-2 text-sm text-neutral-500">Score {row.score}</span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Field label="Status" value={row.po.status} />
          <Field label="PO Date" value={fmtDate(row.po.poRaisedDate)} />
          <Field label="Expiry Date" value={fmtDate(row.po.expiryDate)} />
          <Field label="Appointment Date" value={fmtDate(row.po.appointmentDate)} />
          <Field label="Dispatch Date" value={fmtDate(row.po.dispatchDate)} />
          <Field label="Days Remaining" value={String(row.daysRemaining)} />
          <Field label="SLA Consumed" value={`${row.slaConsumedPercent.toFixed(0)}%`} />
          <Field
            label="Operational Delay"
            value={row.appointmentDelayDays === null ? "—" : `${row.appointmentDelayDays}d`}
          />
          <Field label="Metro City" value={row.isMetroCity ? "Yes" : "No"} />
          <Field label="Ordered Qty" value={row.po.orderedQty.toLocaleString("en-IN")} />
          <Field label="Dispatched Qty" value={row.po.dispatchedQty.toLocaleString("en-IN")} />
          <Field label="Pending Qty" value={row.po.pendingQty.toLocaleString("en-IN")} />
          <Field label="PO Value" value={fmtCurrency(row.po.poValue)} />
        </dl>

        <div className="mt-5">
          <h3 className="text-sm font-semibold">SKUs on this PO ({lineItems.length || 1})</h3>
          <ul className="mt-2 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
            {(lineItems.length > 0
              ? lineItems
              : [{ sku: row.po.sku, skuDescription: row.po.skuDescription, orderedQty: row.po.orderedQty }]
            ).map((line, i) => (
              <li key={i}>
                {line.skuDescription} ({line.sku}) — qty {line.orderedQty}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold">Why this priority</h3>
          {row.explanation.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
              {row.explanation.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">
              {row.level === "Unscored" && row.rulesTriggered.length === 0
                ? "No rules matched this PO (or this status isn't run through the priority chain yet)."
                : "No rules matched this PO — publish rules in the Rules Builder to see an explanation here."}
            </p>
          )}
        </div>

        {row.flags.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold">Flags</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{row.flags.join(", ")}</p>
          </div>
        )}

        <div className="mt-5">
          <h3 className="text-sm font-semibold">Recommended action</h3>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            {row.recommendedAction ?? "No rule has set a recommended action for this PO yet."}
          </p>
        </div>
      </div>
    </div>
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
