"use client";

import { X, Sparkles, Flag, ArrowRight, PackageSearch } from "lucide-react";
import { PoRow } from "@/lib/dashboard/po-rows";
import { PriorityBadge } from "./priority-badge";
import { StatusBadge } from "./status-badge";
import { MarketplaceBadge } from "./marketplace-badge";
import { fmtDate, fmtCurrency } from "./po-format";

export function PoDetailPanel({ row, onClose }: { row: PoRow; onClose: () => void }) {
  const lineItems = (row.po.raw.lineItems as Array<{ sku: string; skuDescription: string; orderedQty: number }>) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="animate-fade-in-up h-full w-full max-w-lg overflow-y-auto rounded-l-3xl bg-white p-6 shadow-2xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{row.po.id}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <MarketplaceBadge marketplace={row.po.marketplace} />
              <StatusBadge status={row.po.status} />
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              {row.po.city} · {row.po.warehouse}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <PriorityBadge level={row.level} />
          <span className="text-sm text-neutral-500">Score {row.score}</span>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 rounded-2xl bg-neutral-50 p-4 text-sm dark:bg-neutral-800/40">
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

        <div className="mt-6">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <PackageSearch size={15} className="text-neutral-400" />
            SKUs on this PO ({lineItems.length || 1})
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm text-neutral-600 dark:text-neutral-400">
            {(lineItems.length > 0
              ? lineItems
              : [{ sku: row.po.sku, skuDescription: row.po.skuDescription, orderedQty: row.po.orderedQty }]
            ).map((line, i) => (
              <li key={i} className="rounded-lg bg-neutral-50 px-3 py-1.5 dark:bg-neutral-800/40">
                {line.skuDescription} ({line.sku}) — qty {line.orderedQty}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles size={15} className="text-neutral-400" />
            Why this priority
          </h3>
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
          <div className="mt-6">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Flag size={15} className="text-neutral-400" />
              Flags
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.flags.map((f) => (
                <span key={f} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium dark:bg-neutral-800">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl bg-[var(--mp-primary)]/10 p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <ArrowRight size={15} />
            Recommended action
          </h3>
          <p className="mt-1.5 text-sm text-neutral-700 dark:text-neutral-300">
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
