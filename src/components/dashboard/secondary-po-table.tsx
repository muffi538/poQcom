"use client";

import { useState } from "react";
import { PoRow } from "@/lib/dashboard/po-rows";
import { PoDetailPanel } from "./po-detail-panel";
import { MarketplaceBadge } from "./marketplace-badge";
import { StatusBadge } from "./status-badge";
import { OperationalDelayBadge } from "./operational-delay";
import { fmtDate, fmtCurrency } from "./po-format";

// Read-only table for POs that are deliberately NOT run through the
// priority scoring chain (Expired, or a status nobody's confirmed how to
// handle yet) — no rank/score/level/rules-triggered columns, since those
// would be meaningless (or misleadingly zero) here.
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

  if (rows.length === 0) return null;

  return (
    <div className="space-y-1">
      <div>
        <h3 className="text-xs font-semibold">
          {title} <span className="font-normal text-neutral-500">({rows.length})</span>
        </h3>
        {note && <p className="text-[11px] text-neutral-500">{note}</p>}
      </div>
      <div className="glass-card overflow-hidden rounded-lg shadow-sm">
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full table-fixed border-collapse text-left text-[12px]">
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
            <thead className="sticky top-0 z-10 bg-white/95 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 backdrop-blur dark:bg-neutral-900/95">
              <tr className="border-b border-frido-border dark:border-white/10">
                {["Status", "Mkt", "PO Number", "City", "PO Date", "Expiry", "Qty", "Value", "Op. Delay"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-1.5 py-1.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
              {rows.map((r) => (
                <tr
                  key={r.po.id}
                  onClick={() => setSelected(r)}
                  className="cursor-pointer transition-colors hover:bg-[var(--mp-primary)]/[0.06]"
                >
                  <td className="truncate px-1.5 py-1">
                    <StatusBadge status={r.po.status} compact />
                  </td>
                  <td className="truncate px-1.5 py-1">
                    <MarketplaceBadge marketplace={r.po.marketplace} compact />
                  </td>
                  <td className="truncate px-1.5 py-1 font-medium" title={r.po.id}>
                    {r.po.id}
                  </td>
                  <td className="truncate px-1.5 py-1" title={r.po.city}>
                    {r.po.city}
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-1 text-neutral-500">{fmtDate(r.po.poRaisedDate)}</td>
                  <td className="whitespace-nowrap px-1.5 py-1 text-neutral-500">{fmtDate(r.po.expiryDate)}</td>
                  <td className="px-1.5 py-1 tabular-nums">{r.po.pendingQty.toLocaleString("en-IN")}</td>
                  <td className="px-1.5 py-1 tabular-nums">{fmtCurrency(r.po.poValue)}</td>
                  <td className="px-1.5 py-1">
                    <OperationalDelayBadge days={r.operationalDelayDays} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selected && <PoDetailPanel row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
