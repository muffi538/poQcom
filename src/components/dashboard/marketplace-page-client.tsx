"use client";

import { useMemo } from "react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MarketplaceTabbedView } from "@/components/dashboard/marketplace-tabbed-view";
import { SupportedMarketplace } from "@/lib/sheets/marketplaces";
import { buildTopSkuTable } from "@/lib/demand/sku-table";
import { buildExecutiveSummary } from "@/lib/dashboard/summary";
import { buildPoRows } from "@/lib/dashboard/po-rows";
import { buildDeliveredRows } from "@/lib/workflows/delivered-workflow";
import { classifyOperationalStatus, isFullyExcludedStatus, PurchaseOrder } from "@/types/purchase-order";
import { Rule } from "@/types/rules";
import { EngineConfig } from "@/lib/config/engine-config";
import { DemandIndex } from "@/lib/demand/rank";
import { useDateFilter } from "@/lib/dashboard/use-date-filter";
import { filterPurchaseOrdersByDate } from "@/lib/dashboard/date-filter";

function fmtDays(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}d`;
}

// Same client-side-recomputation pattern as OverviewClient: the date
// filter (shared across every marketplace page + Overview via
// useDateFilter's sessionStorage key) has to affect KPIs/tables/charts/
// Demand Intelligence uniformly, so everything downstream of the raw
// PurchaseOrder[] batch is recomputed here instead of once, server-side.
//
// Status-first routing (PO_Operations_Architecture_1.md): every visible
// PO is classified into exactly one of 9 buckets via
// classifyOperationalStatus, then handed to that bucket's own workflow.
// Only "pending" and "expired" ever reach buildPoRows/computePoPriority
// (the Priority Engine) — every other bucket gets a PurchaseOrder[] (or,
// for Delivered, a DeliveredRow[]) with no score/rank field at all, so
// there is no code path left that could accidentally score them.
export function MarketplacePageClient({
  marketplace,
  pos,
  rules,
  config,
  demandIndex,
  demandError,
  accentHex,
}: {
  marketplace: string;
  pos: PurchaseOrder[];
  rules: Rule[];
  config: EngineConfig;
  demandIndex: DemandIndex;
  demandError: string | null;
  accentHex: string;
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
    topSkuData,
  } = useMemo(() => {
    const filteredPos = filterPurchaseOrdersByDate(pos, dateFilter);
    const today = new Date();

    // RTO Done is a pre-filter, same as before this refactor — it's not
    // one of the doc's 9 statuses and nobody's asked to see it.
    const visiblePos = filteredPos.filter((po) => !isFullyExcludedStatus(po.status));
    const byStatus = new Map<string, PurchaseOrder[]>();
    for (const po of visiblePos) {
      const bucket = classifyOperationalStatus(po, today);
      const group = byStatus.get(bucket) ?? [];
      group.push(po);
      byStatus.set(bucket, group);
    }
    const pendingPos = byStatus.get("pending") ?? [];
    const expiredPos = byStatus.get("expired") ?? [];
    const deliveredPos = byStatus.get("delivered") ?? [];

    return {
      summary: buildExecutiveSummary(visiblePos, rules, config, demandIndex),
      pendingRows: buildPoRows(pendingPos, rules, config, demandIndex),
      expiredRows: buildPoRows(expiredPos, rules, config, demandIndex),
      deliveredRows: buildDeliveredRows(deliveredPos),
      dispatchedPos: byStatus.get("dispatched") ?? [],
      inTransitPos: byStatus.get("in_transit") ?? [],
      scheduledPos: byStatus.get("scheduled") ?? [],
      cancelledPos: byStatus.get("cancelled") ?? [],
      lowValuePos: byStatus.get("low_value_cant_dispatch") ?? [],
      needsReviewPos: byStatus.get("needs_review") ?? [],
      topSkuData: buildTopSkuTable(marketplace as SupportedMarketplace, demandIndex, pendingPos),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, rules, config, demandIndex, dateFilter, marketplace]);

  return (
    <>
      <div className="flex flex-wrap gap-1">
        <KpiCard label="Pending Orders" value={summary.totalActive} tone="accent" />
        <KpiCard label="Expired Pending" value={summary.expiredPending} tone="critical" />
        <KpiCard label="Pending Qty" value={summary.pendingQty} tone="accent" />
        <KpiCard label="Avg Dispatch" value={fmtDays(summary.avgDispatchTimeDays)} tone="accent" />
        <KpiCard label="Avg Appt Delay" value={fmtDays(summary.avgAppointmentDelayDays)} tone="accent" />
        <KpiCard
          label="Avg Days Late"
          value={summary.avgOperationalDelayDaysLate === null ? "—" : `${summary.avgOperationalDelayDaysLate.toFixed(1)}d`}
          tone="critical"
        />
        <KpiCard label="Risk (Crit+High)" value={summary.critical + summary.high} tone="critical" />
      </div>

      <MarketplaceTabbedView
        marketplace={marketplace}
        pendingRows={pendingRows}
        expiredRows={expiredRows}
        deliveredRows={deliveredRows}
        dispatchedPos={dispatchedPos}
        inTransitPos={inTransitPos}
        scheduledPos={scheduledPos}
        cancelledPos={cancelledPos}
        lowValuePos={lowValuePos}
        needsReviewPos={needsReviewPos}
        hasRules={hasRules}
        demandError={demandError}
        topSkuData={topSkuData}
        accentHex={accentHex}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
      />
    </>
  );
}
