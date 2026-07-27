"use client";

import { useMemo, useState } from "react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PriorityDonutChart } from "@/components/dashboard/priority-donut-chart";
import { MarketplaceTabbedView } from "@/components/dashboard/marketplace-tabbed-view";
import { computeLevelCounts } from "@/lib/dashboard/po-control-filters";
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
}: {
  marketplace: string;
  pos: PurchaseOrder[];
  rules: Rule[];
  config: EngineConfig;
  demandIndex: DemandIndex;
  demandError: string | null;
}) {
  const [dateFilter, setDateFilter] = useDateFilter();
  const hasRules = rules.some((r) => r.enabled);
  // Purely a visual highlight within the donut itself — unlike Overview,
  // this doesn't filter the table below (that table has its own
  // Priority filter, already reachable from its own toolbar/donut).
  const [donutActiveLevel, setDonutActiveLevel] = useState("all");

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

    // RTO Done is a pre-filter, same as before this refactor — it's not
    // one of the doc's 9 statuses and nobody's asked to see it.
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
      topSkuData: buildTopSkuTable(marketplace as SupportedMarketplace, demandIndex, pendingPos),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, rules, config, demandIndex, dateFilter, marketplace]);

  // Same "big picture" scope as the KPI cards beside it (buildExecutiveSummary
  // over every visible Pending PO for this marketplace) — not reactive to
  // the table's own toolbar filters below, same as those KPI numbers aren't.
  const levelCounts = useMemo(() => computeLevelCounts(pendingRows), [pendingRows]);

  return (
    <>
      <div className="flex shrink-0 items-stretch gap-2">
        <div className="grid flex-1 grid-cols-3 gap-2">
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
        </div>

        <div className="w-[480px] shrink-0">
          <PriorityDonutChart
            counts={levelCounts}
            activeLevel={donutActiveLevel}
            onSelectLevel={(level) => setDonutActiveLevel(level === donutActiveLevel ? "all" : level)}
            variant="xlarge"
          />
        </div>
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
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
      />
    </>
  );
}
