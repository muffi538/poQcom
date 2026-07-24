"use client";

import { useMemo, useState } from "react";
import { PoRow } from "@/lib/dashboard/po-rows";
import { PurchaseOrder } from "@/types/purchase-order";
import { DeliveredRow } from "@/lib/workflows/delivered-workflow";
import { StatusTabBar } from "./status-tab-bar";
import { PoControlTower } from "./po-control-tower";
import { SecondaryPoTable } from "./secondary-po-table";
import { DeliveredPoTable } from "./delivered-po-table";
import { OperationalPoTable } from "./operational-po-table";
import { NeedsReviewPoTable } from "./needs-review-po-table";
import { DemandIntelligence } from "./demand-intelligence";
import { PoCharts } from "./po-charts";
import { TopSkuTableResult } from "@/lib/demand/sku-table";
import { DateFilterState } from "@/lib/dashboard/date-filter";

type TabKey =
  | "all"
  | "pending"
  | "critical"
  | "expired"
  | "delivered"
  | "dispatched"
  | "in_transit"
  | "scheduled"
  | "cancelled"
  | "low_value"
  | "needs_review";

const TAB_LABELS: Record<TabKey, string> = {
  all: "All",
  pending: "Pending",
  critical: "Critical",
  expired: "Expired",
  delivered: "Delivered",
  dispatched: "Dispatched",
  in_transit: "In Transit",
  scheduled: "Scheduled",
  cancelled: "Cancelled",
  low_value: "Low Value",
  needs_review: "Needs Review",
};

// One tab per status in PO_Operations_Architecture_1.md, plus "All" and
// the "Critical" shortcut onto Pending. Each tab renders its own
// workflow's table with its own field set — only Pending/Critical route
// through PoControlTower (the Priority Engine); every other tab is a
// pure-display table with no score/rank column, by construction (their
// row types don't carry one).
export function MarketplaceTabbedView({
  marketplace,
  pendingRows,
  expiredRows,
  deliveredRows,
  dispatchedPos,
  inTransitPos,
  scheduledPos,
  cancelledPos,
  lowValuePos,
  needsReviewPos,
  hasRules,
  demandError,
  topSkuData,
  accentHex,
  dateFilter,
  onDateFilterChange,
}: {
  marketplace: string;
  pendingRows: PoRow[];
  expiredRows: PoRow[];
  deliveredRows: DeliveredRow[];
  dispatchedPos: PurchaseOrder[];
  inTransitPos: PurchaseOrder[];
  scheduledPos: PurchaseOrder[];
  cancelledPos: PurchaseOrder[];
  lowValuePos: PurchaseOrder[];
  needsReviewPos: PurchaseOrder[];
  hasRules: boolean;
  demandError?: string | null;
  topSkuData: TopSkuTableResult | null;
  accentHex: string;
  dateFilter?: DateFilterState;
  onDateFilterChange?: (next: DateFilterState) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("pending");

  const criticalCount = useMemo(() => pendingRows.filter((r) => r.level === "Critical").length, [pendingRows]);

  // Every visible PO regardless of status, in one place — every bucket
  // above is mutually exclusive (classifyOperationalStatus assigns each
  // PO to exactly one), so this is a safe union with no double-counting.
  const allPos = useMemo(
    () => [
      ...pendingRows.map((r) => r.po),
      ...expiredRows.map((r) => r.po),
      ...deliveredRows.map((r) => r.po),
      ...dispatchedPos,
      ...inTransitPos,
      ...scheduledPos,
      ...cancelledPos,
      ...lowValuePos,
      ...needsReviewPos,
    ],
    [pendingRows, expiredRows, deliveredRows, dispatchedPos, inTransitPos, scheduledPos, cancelledPos, lowValuePos, needsReviewPos]
  );

  const tabs = [
    { key: "all", label: TAB_LABELS.all, count: allPos.length },
    { key: "pending", label: TAB_LABELS.pending, count: pendingRows.length },
    { key: "critical", label: TAB_LABELS.critical, count: criticalCount },
    { key: "expired", label: TAB_LABELS.expired, count: expiredRows.length },
    { key: "delivered", label: TAB_LABELS.delivered, count: deliveredRows.length },
    { key: "dispatched", label: TAB_LABELS.dispatched, count: dispatchedPos.length },
    { key: "in_transit", label: TAB_LABELS.in_transit, count: inTransitPos.length },
    { key: "scheduled", label: TAB_LABELS.scheduled, count: scheduledPos.length },
    { key: "cancelled", label: TAB_LABELS.cancelled, count: cancelledPos.length },
    { key: "low_value", label: TAB_LABELS.low_value, count: lowValuePos.length },
    { key: "needs_review", label: TAB_LABELS.needs_review, count: needsReviewPos.length },
  ];

  return (
    <div className="space-y-1.5">
      <StatusTabBar tabs={tabs} active={activeTab} onChange={(key) => setActiveTab(key as TabKey)} />

      {/* key={activeTab} forces a clean remount per tab — each status
          bucket starts with its own default filters rather than carrying
          over whatever was set on the previously-viewed tab. */}
      {activeTab === "all" && (
        <NeedsReviewPoTable key={activeTab} title="All POs" note="Every status, combined — read-only." pos={allPos} />
      )}
      {(activeTab === "pending" || activeTab === "critical") && (
        <PoControlTower
          key={activeTab}
          rows={pendingRows}
          marketplaces={[marketplace]}
          hasRules={hasRules}
          demandError={demandError}
          initialLevelFilter={activeTab === "critical" ? "Critical" : undefined}
          dateFilter={dateFilter}
          onDateFilterChange={onDateFilterChange}
        />
      )}
      {activeTab === "expired" && (
        <SecondaryPoTable
          key={activeTab}
          title="Expired POs"
          note="Pending POs that passed their own expiry date — still run through the Priority Engine (Operational Urgency drives their score)."
          rows={expiredRows}
        />
      )}
      {activeTab === "delivered" && <DeliveredPoTable key={activeTab} rows={deliveredRows} />}
      {activeTab === "dispatched" && (
        <OperationalPoTable
          key={activeTab}
          title="Dispatched POs"
          note="Already shipped — read-only, kept for dispatch-performance history."
          variant="dispatched"
          pos={dispatchedPos}
        />
      )}
      {activeTab === "in_transit" && (
        <OperationalPoTable key={activeTab} title="In Transit POs" variant="in_transit" pos={inTransitPos} />
      )}
      {activeTab === "scheduled" && (
        <OperationalPoTable key={activeTab} title="Scheduled POs" variant="scheduled" pos={scheduledPos} />
      )}
      {activeTab === "cancelled" && (
        <OperationalPoTable key={activeTab} title="Cancelled POs" note="Read-only — kept for record." variant="cancelled" pos={cancelledPos} />
      )}
      {activeTab === "low_value" && (
        <OperationalPoTable key={activeTab} title="Low Value Can't Dispatch" variant="low_value_cant_dispatch" pos={lowValuePos} />
      )}
      {activeTab === "needs_review" && <NeedsReviewPoTable key={activeTab} pos={needsReviewPos} />}

      {topSkuData && <DemandIntelligence marketplace={marketplace} data={topSkuData} />}
      <PoCharts rows={pendingRows} accentHex={accentHex} />
    </div>
  );
}
