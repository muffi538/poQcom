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
    <div className="animate-fade-in-up space-y-2">
      <div>
        <h3 className="text-sm font-semibold">
          {title} <span className="font-normal text-neutral-500">({rows.length})</span>
        </h3>
        {note && <p className="text-xs text-neutral-500">{note}</p>}
      </div>
      <div className="glass-card overflow-hidden rounded-card shadow-sm">
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-white/95 text-xs uppercase tracking-wide text-neutral-500 backdrop-blur dark:bg-neutral-900/95">
              <tr className="border-b border-frido-border dark:border-white/10">
                {["Status", "Marketplace", "PO Number", "City / FC", "PO Date", "Expiry Date", "Pending Qty", "PO Value", "Operational Delay"].map(
                  (h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2.5 font-medium">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
              {rows.map((r) => (
                <tr
                  key={r.po.id}
                  onClick={() => setSelected(r)}
                  className="cursor-pointer transition-colors hover:bg-[var(--mp-primary)]/[0.06]"
                >
                  <td className="px-3 py-2.5">
                    <StatusBadge status={r.po.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <MarketplaceBadge marketplace={r.po.marketplace} />
                  </td>
                  <td className="px-3 py-2.5 font-medium">{r.po.id}</td>
                  <td className="px-3 py-2.5">{r.po.city}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-neutral-500">{fmtDate(r.po.poRaisedDate)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-neutral-500">{fmtDate(r.po.expiryDate)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{r.po.pendingQty.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2.5 tabular-nums">{fmtCurrency(r.po.poValue)}</td>
                  <td className="px-3 py-2.5">
                    <OperationalDelayBadge days={r.operationalDelayDays} />
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
