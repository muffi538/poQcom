"use client";

import { useMemo } from "react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PoControlTower } from "@/components/dashboard/po-control-tower";
import { PoCharts } from "@/components/dashboard/po-charts";
import { SecondaryPoTable } from "@/components/dashboard/secondary-po-table";
import { DemandIntelligenceTabs } from "@/components/dashboard/demand-intelligence-tabs";
import { SUPPORTED_MARKETPLACES, SupportedMarketplace } from "@/lib/sheets/marketplaces";
import { MARKETPLACES } from "@/types/marketplace";
import { buildTopSkuTable, TopSkuTableResult } from "@/lib/demand/sku-table";
import { buildExecutiveSummary } from "@/lib/dashboard/summary";
import { buildPoRows } from "@/lib/dashboard/po-rows";
import { classifyStatus, isFullyExcludedStatus, isLowValueCantDispatch, PurchaseOrder } from "@/types/purchase-order";
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

  const { summary, pendingRows, expiredRows, dispatchedRows, deliveredRows, needsReviewRows, topSkuByMarketplace } = useMemo(() => {
    const filteredPos = filterPurchaseOrdersByDate(pos, dateFilter);

    // Status routing (confirmed): only "Pending" runs through the
    // priority scoring chain. "Expired", "Dispatched", and "Delivered"
    // each get their own read-only section instead of being mixed into
    // the ranked table. Only Cancel/Cancelled/RTO Done/Low Value Cant
    // Dispatch are excluded everywhere. Anything else is "Needs Review".
    const visiblePos = filteredPos.filter((po) => !isFullyExcludedStatus(po.status) && !isLowValueCantDispatch(po.status));
    const pendingPos = visiblePos.filter((po) => classifyStatus(po.status) === "pending");
    const expiredPos = visiblePos.filter((po) => classifyStatus(po.status) === "expired");
    const dispatchedPos = visiblePos.filter((po) => classifyStatus(po.status) === "dispatched");
    const deliveredPos = visiblePos.filter((po) => classifyStatus(po.status) === "delivered");
    const needsReviewPos = visiblePos.filter((po) => classifyStatus(po.status) === "needs_review");

    return {
      summary: buildExecutiveSummary(visiblePos, rules, config, demandIndex),
      pendingRows: buildPoRows(pendingPos, rules, config, demandIndex),
      expiredRows: buildPoRows(expiredPos, rules, config, demandIndex),
      dispatchedRows: buildPoRows(dispatchedPos, rules, config, demandIndex),
      deliveredRows: buildPoRows(deliveredPos, rules, config, demandIndex),
      needsReviewRows: buildPoRows(needsReviewPos, rules, config, demandIndex),
      topSkuByMarketplace: Object.fromEntries(
        SUPPORTED_MARKETPLACES.map((m: SupportedMarketplace) => [m, buildTopSkuTable(m, demandIndex, pendingPos)])
      ) as Record<string, TopSkuTableResult>,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, rules, config, demandIndex, dateFilter]);

  return (
    <>
      <div className="flex flex-wrap gap-1">
        <KpiCard label="Active PO" value={fmtNumber(summary.totalActive)} tone="accent" />
        <KpiCard label="Expired Pending" value={fmtNumber(summary.expiredPending)} tone="critical" />
        <KpiCard label="Critical" value={fmtNumber(summary.critical)} tone="critical" />
        <KpiCard label="High" value={fmtNumber(summary.high)} tone="high" />
        <KpiCard label="Medium" value={fmtNumber(summary.medium)} tone="medium" />
        <KpiCard label="Low" value={fmtNumber(summary.low)} tone="low" />
        <KpiCard label="Unscored" value={fmtNumber(summary.unscored)} />
        <KpiCard label="Expired (Status)" value={fmtNumber(summary.expired)} tone="critical" />
        <KpiCard label="Expiring Today" value={fmtNumber(summary.expiringToday)} tone="high" />
        <KpiCard label="Expiring Tmrw" value={fmtNumber(summary.expiringTomorrow)} tone="medium" />
        <KpiCard label="Pending Qty" value={fmtNumber(summary.pendingQty)} />
        <KpiCard label="Pending Value" value={fmtCurrency(summary.pendingValue)} />
        <KpiCard label="Avg Dispatch" value={fmtDays(summary.avgDispatchTimeDays)} />
        <KpiCard label="Avg Appt Delay" value={fmtDays(summary.avgAppointmentDelayDays)} />
        <KpiCard
          label="Avg Days Late"
          value={summary.avgOperationalDelayDaysLate === null ? "—" : `${summary.avgOperationalDelayDaysLate.toFixed(1)}d`}
          tone="critical"
        />
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
          Expired, Dispatched, Delivered, Needs Review, and Charts
        </summary>
        <div className="mt-2 space-y-3 pb-1">
          <SecondaryPoTable title="Expired POs" rows={expiredRows} />
          <SecondaryPoTable
            title="Dispatched POs"
            note="Already shipped — read-only, kept for dispatch-performance history."
            rows={dispatchedRows}
          />
          <SecondaryPoTable title="Delivered POs" note="Fulfilled — read-only, kept for analytics/trends." rows={deliveredRows} />
          <SecondaryPoTable
            title="Needs Review — status not yet classified"
            note="Price issue, Scheduled, Revised appt. required, etc. — not run through priority scoring until confirmed how they should be handled."
            rows={needsReviewRows}
          />
          <PoCharts rows={pendingRows} />
        </div>
      </details>
    </>
  );
}
