"use client";

import { X, Sparkles, Flag, ArrowRight, PackageSearch, AlertTriangle, TrendingUp } from "lucide-react";
import { PoRow } from "@/lib/dashboard/po-rows";
import { PriorityBadge } from "./priority-badge";
import { StatusBadge } from "./status-badge";
import { MarketplaceBadge } from "./marketplace-badge";
import { formatOperationalDelay } from "./operational-delay";
import { fmtDate, fmtCurrency } from "./po-format";
import { DemandTierBadge } from "./demand-tier-badge";
import { tierForRank } from "@/lib/demand/sku-table";
import { SlideOverPortal } from "./slide-over-portal";

// Always-real, rule-independent facts about why this PO ranks where it
// does — combined with the rule-triggered explanation below so the panel
// never shows just a bare number. Every line here comes straight from
// computed fields, nothing invented.
function buildFactualHighlights(row: PoRow): string[] {
  const lines: string[] = [];
  if (row.isOverdue) {
    lines.push(`PO expired ${formatOperationalDelay(row.operationalDelayDays).replace(" Late", " ago")}`);
    lines.push(`Status is still "${row.po.status}"`);
  }
  lines.push(`Operational Delay: ${formatOperationalDelay(row.operationalDelayDays)}`);
  lines.push(`${row.po.city} FC${row.isMetroCity ? " (Metro)" : ""}`);
  lines.push(`Qty: ${row.po.pendingQty.toLocaleString("en-IN")}`);
  if (row.po.poValue !== null) lines.push(`Value: ${formatLakh(row.po.poValue)}`);
  if (row.appointmentScheduledTooLate) lines.push("Appointment scheduled after the PO's own expiry date");
  if (row.hasDataError) lines.push("Data error: PO Raised Date is after Expiry Date");
  if (row.cityWorkloadBonus) lines.push(`${row.po.city} has the most pending POs in this view`);
  return lines;
}

function formatLakh(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function PoDetailPanel({ row, onClose }: { row: PoRow; onClose: () => void }) {
  const lineItems = (row.po.raw.lineItems as Array<{ sku: string; skuDescription: string; orderedQty: number }>) ?? [];
  const highlights = buildFactualHighlights(row);

  return (
    <SlideOverPortal>
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="animate-fade-in-up h-full w-full max-w-lg overflow-y-auto border-l border-frido-border bg-white p-6 shadow-lg dark:border-white/10 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{row.po.id}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <MarketplaceBadge marketplace={row.po.marketplace} />
              <StatusBadge status={row.po.status} />
              {row.isOverdue && (
                <span className="inline-flex items-center gap-1 rounded bg-[#d03b3b]/10 px-2 py-0.5 text-xs font-semibold text-[#9a2c2c] dark:text-[#ff9d9d]">
                  <AlertTriangle size={12} className="animate-pulse" /> Expired
                </span>
              )}
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

        <dl className="mt-5 grid grid-cols-2 gap-4 rounded-md bg-neutral-50 p-4 text-sm dark:bg-neutral-800/40">
          <Field label="PO Date" value={fmtDate(row.po.poRaisedDate)} />
          <Field label="Expiry Date" value={fmtDate(row.po.expiryDate)} />
          <Field label="Appointment Date" value={fmtDate(row.po.appointmentDate)} />
          <Field label="Dispatch Date" value={fmtDate(row.po.dispatchDate)} />
          <Field
            label="Operational Delay"
            value={formatOperationalDelay(row.operationalDelayDays)}
            emphasize={row.isOverdue}
          />
          <Field
            label="Appt. vs Expiry Delay"
            value={row.appointmentDelayDays === null ? "—" : `${row.appointmentDelayDays}d`}
          />
          <Field label="Metro City" value={row.isMetroCity ? "Yes" : "No"} />
          <Field label="Ordered Qty" value={row.po.orderedQty.toLocaleString("en-IN")} />
          <Field label="Dispatched Qty" value={row.po.dispatchedQty.toLocaleString("en-IN")} />
          <Field label="Pending Qty" value={row.po.pendingQty.toLocaleString("en-IN")} />
          <Field label="PO Value" value={fmtCurrency(row.po.poValue)} />
        </dl>

        {(row.hasDataError || row.appointmentScheduledTooLate) && (
          <div className="mt-3 space-y-1.5">
            {row.hasDataError && (
              <p className="rounded-md bg-[#fab219]/15 px-3 py-2 text-xs font-medium text-[#8a5c00] dark:text-[#ffd479]">
                ⚠ Data error: PO Raised Date is after Expiry Date
              </p>
            )}
            {row.appointmentScheduledTooLate && (
              <p className="rounded-md bg-[#fab219]/15 px-3 py-2 text-xs font-medium text-[#8a5c00] dark:text-[#ffd479]">
                ⚠ Appointment scheduled too late — after the PO&apos;s own expiry date
              </p>
            )}
          </div>
        )}

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

        {row.demandHits.length > 0 && (
          <div className="mt-6">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <TrendingUp size={15} className="text-neutral-400" />
              Demand contribution
            </h3>
            <div className="mt-2 overflow-hidden rounded-md border border-frido-border dark:border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-800/40">
                  <tr>
                    <th className="px-2.5 py-1.5">SKU</th>
                    <th className="px-2.5 py-1.5 text-right">Rank</th>
                    <th className="px-2.5 py-1.5 text-right">GMV</th>
                    <th className="px-2.5 py-1.5">Tier</th>
                    <th className="px-2.5 py-1.5 text-right">Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                  {row.demandHits.map((hit) => (
                    <tr key={hit.sku}>
                      <td className="px-2.5 py-1.5 font-medium">{hit.sku}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-neutral-500">#{hit.rank}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{formatLakh(hit.gmv)}</td>
                      <td className="px-2.5 py-1.5">
                        <DemandTierBadge tier={tierForRank(hit.rank)} />
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums font-semibold">+{hit.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles size={15} className="text-neutral-400" />
            Why this priority
          </h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
            {highlights.map((line, i) => (
              <li key={`fact-${i}`}>{line}</li>
            ))}
            {row.explanation.map((line, i) => (
              <li key={`rule-${i}`}>{line}</li>
            ))}
          </ul>
          {row.explanation.length === 0 && !row.isOverdue && row.demandHits.length === 0 && (
            <p className="mt-2 text-sm text-neutral-500">
              No score-affecting rules matched beyond the facts above — publish more rules in the
              Rules Builder for a fuller picture.
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
                <span key={f} className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium dark:bg-neutral-800">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 rounded-md bg-[var(--mp-primary)]/10 p-4">
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
    </SlideOverPortal>
  );
}

function Field({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className={`font-medium ${emphasize ? "text-[#d03b3b]" : ""}`}>{value}</dd>
    </div>
  );
}
