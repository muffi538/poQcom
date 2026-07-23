"use client";

import { useMemo, useState } from "react";
import { PoRow } from "@/lib/dashboard/po-rows";
import { StatusTabBar } from "./status-tab-bar";
import { PoControlTower } from "./po-control-tower";
import { SecondaryPoTable } from "./secondary-po-table";
import { DemandIntelligence } from "./demand-intelligence";
import { PoCharts } from "./po-charts";
import { TopSkuTableResult } from "@/lib/demand/sku-table";

type TabKey = "all" | "pending" | "critical" | "delivered" | "dispatched" | "cancelled" | "expired" | "needs_review";

const TAB_LABELS: Record<TabKey, string> = {
  all: "All",
  pending: "Pending",
  critical: "Critical",
  delivered: "Delivered",
  dispatched: "Dispatched",
  cancelled: "Cancelled",
  expired: "Expired",
  needs_review: "Needs Review",
};

// Replaces the old "scroll past a collapsed <details> block to see
// Expired/Dispatched/Delivered/Needs Review" pattern with a sticky tab
// bar — every status is one click away, with a live count, and
// switching tabs never reloads the page (confirmed requirements). Tab
// selection lives here, entirely separate from each table's own
// City/Search/Priority filter state, so changing a filter never resets
// which tab is active. "Critical" is a shortcut onto the same Pending
// rows with the ranked table's own Priority filter pre-set, not a
// separate status — Cancel/Cancelled is a real bucket like the rest.
export function MarketplaceTabbedView({
  marketplace,
  pendingRows,
  deliveredRows,
  dispatchedRows,
  cancelledRows,
  expiredRows,
  needsReviewRows,
  hasRules,
  demandError,
  topSkuData,
  accentHex,
}: {
  marketplace: string;
  pendingRows: PoRow[];
  deliveredRows: PoRow[];
  dispatchedRows: PoRow[];
  cancelledRows: PoRow[];
  expiredRows: PoRow[];
  needsReviewRows: PoRow[];
  hasRules: boolean;
  demandError?: string | null;
  topSkuData: TopSkuTableResult | null;
  accentHex: string;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("pending");

  const criticalCount = useMemo(() => pendingRows.filter((r) => r.level === "Critical").length, [pendingRows]);

  // Every visible PO regardless of status, in one place — the six
  // buckets above are mutually exclusive (classifyStatus assigns each PO
  // to exactly one), so concatenating them is a safe union with no
  // double-counting.
  const allRows = useMemo(
    () => [...pendingRows, ...deliveredRows, ...dispatchedRows, ...cancelledRows, ...expiredRows, ...needsReviewRows],
    [pendingRows, deliveredRows, dispatchedRows, cancelledRows, expiredRows, needsReviewRows]
  );

  const tabs = [
    { key: "all", label: TAB_LABELS.all, count: allRows.length },
    { key: "pending", label: TAB_LABELS.pending, count: pendingRows.length },
    { key: "critical", label: TAB_LABELS.critical, count: criticalCount },
    { key: "delivered", label: TAB_LABELS.delivered, count: deliveredRows.length },
    { key: "dispatched", label: TAB_LABELS.dispatched, count: dispatchedRows.length },
    { key: "cancelled", label: TAB_LABELS.cancelled, count: cancelledRows.length },
    { key: "expired", label: TAB_LABELS.expired, count: expiredRows.length },
    { key: "needs_review", label: TAB_LABELS.needs_review, count: needsReviewRows.length },
  ];

  return (
    <div className="space-y-1.5">
      <StatusTabBar tabs={tabs} active={activeTab} onChange={(key) => setActiveTab(key as TabKey)} />

      {/* key={activeTab} forces a clean remount per tab — each status
          bucket starts with its own default filters rather than carrying
          over whatever was set on the previously-viewed tab. */}
      {activeTab === "all" && (
        <SecondaryPoTable key={activeTab} title="All POs" note="Every status, combined — read-only." rows={allRows} />
      )}
      {(activeTab === "pending" || activeTab === "critical") && (
        <PoControlTower
          key={activeTab}
          rows={pendingRows}
          marketplaces={[marketplace]}
          hasRules={hasRules}
          demandError={demandError}
          initialLevelFilter={activeTab === "critical" ? "Critical" : undefined}
        />
      )}
      {activeTab === "delivered" && (
        <SecondaryPoTable
          key={activeTab}
          title="Delivered POs"
          note="Fulfilled — read-only, kept for analytics/trends."
          rows={deliveredRows}
        />
      )}
      {activeTab === "dispatched" && (
        <SecondaryPoTable
          key={activeTab}
          title="Dispatched POs"
          note="Already shipped — read-only, kept for dispatch-performance history."
          rows={dispatchedRows}
        />
      )}
      {activeTab === "cancelled" && (
        <SecondaryPoTable key={activeTab} title="Cancelled POs" note="Read-only — kept for record." rows={cancelledRows} />
      )}
      {activeTab === "expired" && <SecondaryPoTable key={activeTab} title="Expired POs" rows={expiredRows} />}
      {activeTab === "needs_review" && (
        <SecondaryPoTable
          key={activeTab}
          title="Needs Review — status not yet classified"
          note="Price issue, Scheduled, Revised appt. required, etc. — not run through priority scoring until confirmed how they should be handled."
          rows={needsReviewRows}
        />
      )}

      {topSkuData && <DemandIntelligence marketplace={marketplace} data={topSkuData} />}
      <PoCharts rows={pendingRows} accentHex={accentHex} />
    </div>
  );
}
