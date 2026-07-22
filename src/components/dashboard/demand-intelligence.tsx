"use client";

import { useMemo, useState } from "react";
import { X, MapPin, Boxes } from "lucide-react";
import { TopSkuRow, TopSkuTableResult } from "@/lib/demand/sku-table";
import { KpiCard } from "./kpi-card";
import { DemandTierBadge } from "./demand-tier-badge";
import { SlideOverPortal } from "./slide-over-portal";
import { ExportButton } from "./export-button";
import { CsvCell } from "@/lib/export/csv";

const EXPORT_HEADERS = ["Rank", "SKU", "Product", "GMV", "Units Sold", "Tier", "Priority Impact", "Pending POs", "Total Pending Qty"];

function fmtLakh(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

type RangeMode = "top10" | "top20" | "all";

export function DemandIntelligence({
  marketplace,
  data,
}: {
  marketplace: string;
  data: TopSkuTableResult;
}) {
  const [range, setRange] = useState<RangeMode>("top10");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [selected, setSelected] = useState<TopSkuRow | null>(null);

  const rangeLimit = range === "top10" ? 10 : range === "top20" ? 20 : data.rows.length;
  const visibleRows = useMemo(() => {
    const sliced = data.rows.slice(0, rangeLimit);
    return pendingOnly ? sliced.filter((r) => r.pendingPoIds.length > 0) : sliced;
  }, [data.rows, rangeLimit, pendingOnly]);

  const exportRows: CsvCell[][] = useMemo(
    () =>
      visibleRows.map((r) => [
        r.rank,
        r.sku,
        r.product,
        r.gmv,
        r.units,
        r.tier,
        r.points,
        r.pendingPoIds.length,
        r.totalPendingQty,
      ]),
    [visibleRows]
  );

  if (data.rows.length === 0) {
    return (
      <div className="glass-card rounded-md p-4 text-xs text-neutral-500">
        No sales data found for {marketplace} in the Demand Intelligence sheet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
          Top Performing SKUs <span className="font-normal text-neutral-400">({marketplace})</span>
        </h3>
      </div>

      <div className="flex flex-wrap gap-1">
        <KpiCard label="Top 10 GMV Share" value={`${data.stats.top10GmvShare}%`} tone="accent" />
        <KpiCard label="Top SKU GMV" value={fmtLakh(data.stats.topSkuGmv)} tone="accent" />
        <KpiCard label="Average GMV" value={fmtLakh(data.stats.averageGmv)} />
        <KpiCard label="Open POs / Top SKUs" value={data.stats.openPosContainingTopSkus} tone="accent" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(["top10", "top20", "all"] as RangeMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setRange(mode)}
            className={`rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
              range === mode
                ? "border-[var(--mp-accent)] bg-[var(--mp-primary)]/20 text-[var(--mp-accent)]"
                : "border-frido-border text-neutral-500 hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-neutral-900"
            }`}
          >
            {mode === "top10" ? "Top 10" : mode === "top20" ? "Top 20" : `All (${data.rows.length})`}
          </button>
        ))}
        <button
          onClick={() => setPendingOnly((v) => !v)}
          className={`rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
            pendingOnly
              ? "border-[var(--mp-accent)] bg-[var(--mp-primary)]/20 text-[var(--mp-accent)]"
              : "border-frido-border text-neutral-500 hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-neutral-900"
          }`}
        >
          In Pending POs Only
        </button>
        <span className="text-[11px] text-neutral-500">{visibleRows.length} shown</span>
        <ExportButton
          headers={EXPORT_HEADERS}
          rows={exportRows}
          filename={`top-skus-${marketplace.toLowerCase().replace(/\s+/g, "-")}.csv`}
        />
      </div>

      <div className="glass-card overflow-hidden rounded-md">
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full table-fixed border-collapse text-left text-[13px]">
            <colgroup>
              <col style={{ width: 40 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 220 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 60 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 68 }} />
              <col />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr className="border-b border-frido-border dark:border-white/10">
                <th className="px-1.5 py-1.5">#</th>
                <th className="px-1.5 py-1.5">SKU</th>
                <th className="px-1.5 py-1.5">Product</th>
                <th className="px-1.5 py-1.5 text-right">GMV</th>
                <th className="px-1.5 py-1.5 text-right">Units</th>
                <th className="px-1.5 py-1.5">Tier</th>
                <th className="px-1.5 py-1.5 text-right">Impact</th>
                <th className="px-1.5 py-1.5">Pending POs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
              {visibleRows.map((r) => {
                const inPending = r.pendingPoIds.length > 0;
                return (
                  <tr
                    key={r.sku}
                    onClick={() => setSelected(r)}
                    className={`h-10 cursor-pointer transition-colors hover:bg-[var(--mp-primary)]/[0.08] ${
                      inPending ? "bg-[var(--mp-primary)]/[0.04]" : ""
                    }`}
                  >
                    <td className="px-1.5 tabular-nums text-neutral-500">{r.rank}</td>
                    <td className="truncate px-1.5 font-medium" title={r.sku}>
                      {r.sku}
                    </td>
                    <td className="truncate px-1.5 text-neutral-600 dark:text-neutral-400" title={r.product}>
                      {r.product}
                    </td>
                    <td className="px-1.5 text-right tabular-nums">{fmtLakh(r.gmv)}</td>
                    <td className="px-1.5 text-right tabular-nums text-neutral-500">
                      {r.units.toLocaleString("en-IN")}
                    </td>
                    <td className="px-1.5">
                      <DemandTierBadge tier={r.tier} />
                    </td>
                    <td className="px-1.5 text-right tabular-nums font-semibold">+{r.points}</td>
                    <td className="px-1.5">
                      {inPending ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--mp-accent)]"
                          title={r.pendingPoIds.join(", ")}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--mp-primary)]" />
                          {r.pendingPoIds.length} PO{r.pendingPoIds.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                          No open PO
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <SkuDetailPanel row={selected} marketplace={marketplace} onClose={() => setSelected(null)} />}
    </div>
  );
}

function SkuDetailPanel({
  row,
  marketplace,
  onClose,
}: {
  row: TopSkuRow;
  marketplace: string;
  onClose: () => void;
}) {
  return (
    <SlideOverPortal>
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="animate-fade-in-up h-full w-full max-w-md overflow-y-auto border-l border-frido-border bg-white p-6 shadow-lg dark:border-white/10 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">{row.product}</h2>
            <p className="mt-1 text-xs text-neutral-500">
              {row.sku} · {marketplace}
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
          <DemandTierBadge tier={row.tier} />
          <span className="text-sm text-neutral-500">Rank #{row.rank}</span>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 rounded-md bg-neutral-50 p-4 text-sm dark:bg-neutral-800/40">
          <Field label="Marketplace Rank" value={`#${row.rank}`} />
          <Field label="GMV" value={fmtLakh(row.gmv)} />
          <Field label="Units Sold" value={row.units.toLocaleString("en-IN")} />
          <Field label="Priority Contribution" value={`+${row.points}`} />
          <Field label="Pending POs" value={String(row.pendingPoIds.length)} />
          <Field label="Total Pending Qty" value={row.totalPendingQty.toLocaleString("en-IN")} />
        </dl>

        <div className="mt-6">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <MapPin size={15} className="text-neutral-400" />
            Cities waiting ({row.cities.length})
          </h3>
          {row.cities.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.cities.map((c) => (
                <span key={c} className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium dark:bg-neutral-800">
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">No open PO contains this SKU right now.</p>
          )}
        </div>

        {row.pendingPoIds.length > 0 && (
          <div className="mt-6">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Boxes size={15} className="text-neutral-400" />
              Pending PO Numbers
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.pendingPoIds.map((id) => (
                <span key={id} className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium dark:bg-neutral-800">
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}
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
