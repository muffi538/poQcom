"use client";

import { useMemo } from "react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PoControlTower } from "@/components/dashboard/po-control-tower";
import { PoCharts } from "@/components/dashboard/po-charts";
import { SecondaryPoTable } from "@/components/dashboard/secondary-po-table";
import { DeliveredPoTable } from "@/components/dashboard/delivered-po-table";
import { OperationalPoTable } from "@/components/dashboard/operational-po-table";
import { NeedsReviewPoTable } from "@/components/dashboard/needs-review-po-table";
import { DemandIntelligenceTabs } from "@/components/dashboard/demand-intelligence-tabs";
import { SUPPORTED_MARKETPLACES, SupportedMarketplace } from "@/lib/sheets/marketplaces";
import { MARKETPLACES } from "@/types/marketplace";
import { buildTopSkuTable, TopSkuTableResult } from "@/lib/demand/sku-table";
import { buildExecutiveSummary } from "@/lib/dashboard/summary";
import { buildPoRows } from "@/lib/dashboard/po-rows";
import { buildDeliveredRows } from "@/lib/workflows/delivered-workflow";
import { classifyOperationalStatus, isFullyExcludedStatus, PurchaseOrder } from "@/types/purchase-order";
import { Rule } from "@/types/rules";
import { EngineConfig } from "@/lib/config/engine-config";
import { DemandIndex } from "@/lib/demand/rank";
import { useDateFilter } from "@/lib/dashboard/use-date-filter";
import { filterPurchaseOrdersByDate } from "@/lib/dashboard/date-filter";

function fmtNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

function fmtCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function fmtDays(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}d`;
}

// Everything below buildExecutiveSummary/buildPoRows/buildTopSkuTable
// used to run once, server-side, in page.tsx. It's moved here (a Client
// Component) so the global date filter — shared with every marketplace
// page via useDateFilter's sessionStorage key — can re-run all of it
// instantly on every change: KPIs, the ranked table, secondary tables,
// charts, and Demand Intelligence all recompute from the same filtered
// PurchaseOrder[] batch, never independently.
//
// Status-first routing (PO_Operations_Architecture_1.md): classified via
// classifyOperationalStatus into 9 buckets; only Pending/Expired ever
// reach buildPoRows/computePoPriority (the Priority Engine). Every other
// bucket's row type carries no score/rank field, so there's no path left
// that could accidentally score a Delivered/Dispatched/Cancelled/etc. PO.
export function OverviewClient({
  pos,
  rules,
  config,
  demandIndex,
  demandError,
}: {
  pos: PurchaseOrder[];
  rules: Rule[];
  config: EngineConfig;
  demandIndex: DemandIndex;
  demandError: string | null;
}) {
  const [dateFilter, setDateFilter] = useDateFilter();
  const hasRules = rules.some((r) => r.enabled);

  const {
    summary,
    pendingRows,
    expiredRows,
    deliveredRows,
    dispatchedPos,
    inTransitPos,
    scheduledPos,
    cancelledPos,
    lowValuePos,
    needsReviewPos,
    topSkuByMarketplace,
  } = useMemo(() => {
    const filteredPos = filterPurchaseOrdersByDate(pos, dateFilter);

    const visiblePos = filteredPos.filter((po) => !isFullyExcludedStatus(po.status));
    const byStatus = new Map<string, PurchaseOrder[]>();
    for (const po of visiblePos) {
      const bucket = classifyOperationalStatus(po);
      const group = byStatus.get(bucket) ?? [];
      group.push(po);
      byStatus.set(bucket, group);
    }
    const pendingPos = byStatus.get("pending") ?? [];
    // Literal-text "Expired" status only (see isExpiredStatus) — no sheet
    // currently writes this, so this is essentially always empty.
    const literalExpiredPos = byStatus.get("expired") ?? [];
    const deliveredPos = byStatus.get("delivered") ?? [];
    const pendingRows = buildPoRows(pendingPos, rules, config, demandIndex);

    return {
      summary: buildExecutiveSummary(visiblePos, rules, config, demandIndex),
      pendingRows,
      // A subset of Pending Orders past their own expiry date (isOverdue),
      // not a separate bucket — keeps this total from ever exceeding
      // Pending Orders / the priority donut, which both come from the
      // same pendingRows.
      expiredRows: [...pendingRows.filter((r) => r.isOverdue), ...buildPoRows(literalExpiredPos, rules, config, demandIndex)],
      deliveredRows: buildDeliveredRows(deliveredPos),
      dispatchedPos: byStatus.get("dispatched") ?? [],
      inTransitPos: byStatus.get("in_transit") ?? [],
      scheduledPos: byStatus.get("scheduled") ?? [],
      cancelledPos: byStatus.get("cancelled") ?? [],
      lowValuePos: byStatus.get("low_value_cant_dispatch") ?? [],
      needsReviewPos: byStatus.get("needs_review") ?? [],
      topSkuByMarketplace: Object.fromEntries(
        SUPPORTED_MARKETPLACES.map((m: SupportedMarketplace) => [m, buildTopSkuTable(m, demandIndex, pendingPos)])
      ) as Record<string, TopSkuTableResult>,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, rules, config, demandIndex, dateFilter]);

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        <KpiCard label="Active PO" value={fmtNumber(summary.totalActive)} tone="accent" />
        <KpiCard label="Pending Qty" value={fmtNumber(summary.pendingQty)} />
        <KpiCard label="Pending Value" value={fmtCurrency(summary.pendingValue)} />
        <KpiCard label="Critical" value={fmtNumber(summary.critical)} tone="critical" />
        <KpiCard label="Expired Pending" value={fmtNumber(summary.expiredPending)} tone="critical" />
        <KpiCard label="Avg Dispatch" value={fmtDays(summary.avgDispatchTimeDays)} />
        <KpiCard label="Avg Appt Delay" value={fmtDays(summary.avgAppointmentDelayDays)} />
        <KpiCard
          label="Avg Days Late"
          value={summary.avgOperationalDelayDaysLate === null ? "—" : `${summary.avgOperationalDelayDaysLate.toFixed(1)}d`}
          tone="critical"
        />
        <KpiCard label="Expired (Status)" value={fmtNumber(summary.expired)} tone="critical" />
        <KpiCard label="Expiring <10 Days" value={fmtNumber(summary.expiringWithin10Days)} tone="high" />
      </div>

      <PoControlTower
        rows={pendingRows}
        marketplaces={[...MARKETPLACES]}
        hasRules={hasRules}
        demandError={demandError}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
      />
      <DemandIntelligenceTabs marketplaces={[...MARKETPLACES]} data={topSkuByMarketplace} />
      <details className="glass-card rounded-lg px-3 py-1.5 text-xs">
        <summary className="cursor-pointer select-none font-medium text-neutral-500">
          Expired, Delivered, Dispatched, In Transit, Scheduled, Cancelled, Low Value, Needs Review, and Charts
        </summary>
        <div className="mt-2 space-y-3 pb-1">
          <SecondaryPoTable
            title="Expired POs"
            note="Pending POs that passed their own expiry date — still run through the Priority Engine."
            rows={expiredRows}
          />
          <DeliveredPoTable rows={deliveredRows} />
          <OperationalPoTable
            title="Dispatched POs"
            note="Already shipped — read-only, kept for dispatch-performance history."
            variant="dispatched"
            pos={dispatchedPos}
          />
          <OperationalPoTable title="In Transit POs" variant="in_transit" pos={inTransitPos} />
          <OperationalPoTable title="Scheduled POs" variant="scheduled" pos={scheduledPos} />
          <OperationalPoTable title="Cancelled POs" note="Read-only — kept for record." variant="cancelled" pos={cancelledPos} />
          <OperationalPoTable title="Low Value Can't Dispatch" variant="low_value_cant_dispatch" pos={lowValuePos} />
          <NeedsReviewPoTable pos={needsReviewPos} />
          <PoCharts rows={pendingRows} />
        </div>
      </details>
    </div>
  );
}
