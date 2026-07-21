"use client";

import { useState } from "react";
import { PoRow } from "@/lib/dashboard/po-rows";
import { PoDetailPanel } from "./po-detail-panel";
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
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">
          {title} <span className="font-normal text-neutral-500">({rows.length})</span>
        </h3>
        {note && <p className="text-xs text-neutral-500">{note}</p>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
            <tr>
              {["Status", "Marketplace", "PO Number", "City / FC", "PO Date", "Expiry Date", "Pending Qty", "PO Value", "Days Left", "SLA %"].map(
                (h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {rows.map((r) => (
              <tr
                key={r.po.id}
                onClick={() => setSelected(r)}
                className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <td className="px-3 py-2">{r.po.status}</td>
                <td className="px-3 py-2">{r.po.marketplace}</td>
                <td className="px-3 py-2 font-medium">{r.po.id}</td>
                <td className="px-3 py-2">{r.po.city}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.po.poRaisedDate)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.po.expiryDate)}</td>
                <td className="px-3 py-2 tabular-nums">{r.po.pendingQty.toLocaleString("en-IN")}</td>
                <td className="px-3 py-2 tabular-nums">{fmtCurrency(r.po.poValue)}</td>
                <td className="px-3 py-2 tabular-nums">{r.daysRemaining}</td>
                <td className="px-3 py-2 tabular-nums">{r.slaConsumedPercent.toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && <PoDetailPanel row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
