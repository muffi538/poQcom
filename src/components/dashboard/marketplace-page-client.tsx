"use client";

import { useMemo } from "react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MarketplaceTabbedView } from "@/components/dashboard/marketplace-tabbed-view";
import { SupportedMarketplace } from "@/lib/sheets/marketplaces";
import { buildTopSkuTable } from "@/lib/demand/sku-table";
import { buildExecutiveSummary } from "@/lib/dashboard/summary";
import { buildPoRows } from "@/lib/dashboard/po-rows";
import { classifyStatus, isFullyExcludedStatus, isLowValueCantDispatch, PurchaseOrder } from "@/types/purchase-order";
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

  const { summary, pendingRows, expiredRows, dispatchedRows, deliveredRows, cancelledRows, needsReviewRows, topSkuData } = useMemo(() => {
    const filteredPos = filterPurchaseOrdersByDate(pos, dateFilter);

    const visiblePos = filteredPos.filter((po) => !isFullyExcludedStatus(po.status) && !isLowValueCantDispatch(po.status));
    const pendingPos = visiblePos.filter((po) => classifyStatus(po.status) === "pending");
    const expiredPos = visiblePos.filter((po) => classifyStatus(po.status) === "expired");
    const dispatchedPos = visiblePos.filter((po) => classifyStatus(po.status) === "dispatched");
    const deliveredPos = visiblePos.filter((po) => classifyStatus(po.status) === "delivered");
    const cancelledPos = visiblePos.filter((po) => classifyStatus(po.status) === "cancelled");
    const needsReviewPos = visiblePos.filter((po) => classifyStatus(po.status) === "needs_review");

    return {
      summary: buildExecutiveSummary(visiblePos, rules, config, demandIndex),
      pendingRows: buildPoRows(pendingPos, rules, config, demandIndex),
      expiredRows: buildPoRows(expiredPos, rules, config, demandIndex),
      dispatchedRows: buildPoRows(dispatchedPos, rules, config, demandIndex),
      deliveredRows: buildPoRows(deliveredPos, rules, config, demandIndex),
      cancelledRows: buildPoRows(cancelledPos, rules, config, demandIndex),
      needsReviewRows: buildPoRows(needsReviewPos, rules, config, demandIndex),
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
        deliveredRows={deliveredRows}
        dispatchedRows={dispatchedRows}
        cancelledRows={cancelledRows}
        expiredRows={expiredRows}
        needsReviewRows={needsReviewRows}
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
