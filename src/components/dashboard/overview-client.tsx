"use client";

import { useMemo, useState } from "react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PoControlTower } from "@/components/dashboard/po-control-tower";
import { PriorityDonutChart } from "@/components/dashboard/priority-donut-chart";
import { CityDonutChart } from "@/components/dashboard/city-donut-chart";
import { PoCharts } from "@/components/dashboard/po-charts";
import { SecondaryPoTable } from "@/components/dashboard/secondary-po-table";
import { DeliveredPoTable } from "@/components/dashboard/delivered-po-table";
import { OperationalPoTable } from "@/components/dashboard/operational-po-table";
import { NeedsReviewPoTable } from "@/components/dashboard/needs-review-po-table";
import { DemandIntelligenceTabs } from "@/components/dashboard/demand-intelligence-tabs";
import { SupportedMarketplace } from "@/lib/sheets/marketplaces";
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
import {
  DEFAULT_PO_CONTROL_FILTERS,
  computeCityCounts,
  computeLevelCounts,
  filterRowsExceptCity,
  filterRowsExceptLevel,
} from "@/lib/dashboard/po-control-filters";

function fmtNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

function fmtCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
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
  marketplaces,
}: {
  pos: PurchaseOrder[];
  rules: Rule[];
  config: EngineConfig;
  demandIndex: DemandIndex;
  demandError: string | null;
  // Already scoped by the page to whatever this signed-in user is
  // actually permitted to see (or every marketplace, for an admin) —
  // never the full static list, so KPIs/donuts/table/Top SKUs here
  // can't leak another marketplace's data just because it exists.
  marketplaces: string[];
}) {
  const [dateFilter, setDateFilter] = useDateFilter();
  const hasRules = rules.some((r) => r.enabled);
  // Lifted out of PoControlTower (rather than local to it) so the donut
  // beside the KPI grid reads the exact same Marketplace/City/Expiry/
  // Search/Priority state driving the table below — clicking a slice
  // filters the table, and the table's own filters narrow the donut,
  // with a single shared source of truth instead of two copies drifting
  // apart.
  const [poFilters, setPoFilters] = useState(DEFAULT_PO_CONTROL_FILTERS);

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
        marketplaces.map((m) => [m, buildTopSkuTable(m as SupportedMarketplace, demandIndex, pendingPos)])
      ) as Record<string, TopSkuTableResult>,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, rules, config, demandIndex, dateFilter, marketplaces]);

  const levelCounts = useMemo(
    () => computeLevelCounts(filterRowsExceptLevel(pendingRows, poFilters)),
    [pendingRows, poFilters]
  );
  const cityCounts = useMemo(
    () => computeCityCounts(filterRowsExceptCity(pendingRows, poFilters)),
    [pendingRows, poFilters]
  );

  return (
    <div className="flex flex-col gap-1.5">
      {/* Row 1 + Row 2: 3 KPI cards each, full page width — every card
          the same size via a fixed 3-column grid, regardless of row. */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard label="Active PO" value={fmtNumber(summary.totalActive)} tone="accent" />
        <KpiCard label="Pending Qty" value={fmtNumber(summary.pendingQty)} />
        <KpiCard label="Pending Value" value={fmtCurrency(summary.pendingValue)} />
        <KpiCard label="Critical" value={fmtNumber(summary.critical)} tone="critical" />
        <KpiCard label="Expired Pending" value={fmtNumber(summary.expiredPending)} tone="critical" />
        <KpiCard label="Expiring <10 Days" value={fmtNumber(summary.expiringWithin10Days)} tone="high" />
      </div>

      {/* Row 3: the two donuts side by side, equal width via grid-cols-2
          (and equal height via each stretching to fill its grid cell). */}
      <div className="grid grid-cols-2 items-stretch gap-2">
        <PriorityDonutChart
          counts={levelCounts}
          activeLevel={poFilters.levelFilter}
          onSelectLevel={(level) => setPoFilters((f) => ({ ...f, levelFilter: level === f.levelFilter ? "all" : level }))}
          variant="large"
        />
        <CityDonutChart
          slices={cityCounts}
          activeCity={poFilters.cityFilter}
          onSelectCity={(city) => setPoFilters((f) => ({ ...f, cityFilter: city === f.cityFilter ? "all" : city }))}
        />
      </div>

      <PoControlTower
        rows={pendingRows}
        marketplaces={marketplaces}
        hasRules={hasRules}
        demandError={demandError}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        filters={poFilters}
        onFiltersChange={setPoFilters}
        hideDonut
      />
      <DemandIntelligenceTabs marketplaces={marketplaces} data={topSkuByMarketplace} />
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
