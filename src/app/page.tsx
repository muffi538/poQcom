import {
  Package,
  AlertOctagon,
  AlertTriangle,
  Flame,
  Gauge,
  CircleSlash,
  CalendarClock,
  CalendarDays,
  CalendarX2,
  Boxes,
  Wallet,
  Truck,
  Clock,
  Hourglass,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AwaitingConfig } from "@/components/dashboard/awaiting-config";
import { PoControlTower } from "@/components/dashboard/po-control-tower";
import { PoCharts } from "@/components/dashboard/po-charts";
import { SecondaryPoTable } from "@/components/dashboard/secondary-po-table";
import { MarketplaceThemeScope } from "@/components/theme/marketplace-theme-scope";
import { fetchAllPurchaseOrders } from "@/lib/sheets/marketplaces";
import { listRules } from "@/lib/rules/storage";
import { getEngineConfig } from "@/lib/config/store";
import { getDemandIndex } from "@/lib/demand";
import { buildExecutiveSummary } from "@/lib/dashboard/summary";
import { buildPoRows } from "@/lib/dashboard/po-rows";
import { classifyStatus, isTerminalStatus, isLowValueCantDispatch } from "@/types/purchase-order";
import { MARKETPLACES } from "@/types/marketplace";

function fmtNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

function fmtCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function fmtDays(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}d`;
}


export default async function OverviewPage() {
  let errorMessage: string | null = null;
  let summary: Awaited<ReturnType<typeof buildExecutiveSummary>> | null = null;
  let pendingRows: ReturnType<typeof buildPoRows> = [];
  let expiredRows: ReturnType<typeof buildPoRows> = [];
  let needsReviewRows: ReturnType<typeof buildPoRows> = [];
  let hasRules = false;

  try {
    const [pos, rules, config, demandIndex] = await Promise.all([
      fetchAllPurchaseOrders(),
      listRules(),
      getEngineConfig(),
      getDemandIndex(),
    ]);
    hasRules = rules.some((r) => r.enabled);

    // Status routing (confirmed): only "Pending" runs through the
    // priority scoring chain. "Expired" gets its own section instead of
    // being mixed into the ranked table. Terminal statuses and "Low Value
    // Cant Dispatch" are excluded everywhere. Anything else (Price issue,
    // Scheduled, Revised appt. required, ...) is unclassified ground —
    // shown separately as "Needs Review" rather than silently scored.
    const visiblePos = pos.filter((po) => !isTerminalStatus(po.status) && !isLowValueCantDispatch(po.status));
    const pendingPos = visiblePos.filter((po) => classifyStatus(po.status) === "pending");
    const expiredPos = visiblePos.filter((po) => classifyStatus(po.status) === "expired");
    const needsReviewPos = visiblePos.filter((po) => classifyStatus(po.status) === "needs_review");

    summary = buildExecutiveSummary(visiblePos, rules, config, demandIndex);
    pendingRows = buildPoRows(pendingPos, rules, config, demandIndex);
    expiredRows = buildPoRows(expiredPos, rules, config, demandIndex);
    needsReviewRows = buildPoRows(needsReviewPos, rules, config, demandIndex);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Failed to load PO data.";
  }

  return (
    <MarketplaceThemeScope marketplace={null}>
      <div className="space-y-2">
        <h1 className="text-base font-semibold tracking-tight text-neutral-500">
          Overview <span className="font-normal text-neutral-400">— Zepto, Blinkit, Instamart</span>
        </h1>

        {errorMessage ? (
          <AwaitingConfig title="Executive Summary" items={[errorMessage]} />
        ) : summary ? (
          <div className="flex flex-wrap gap-1">
            <KpiCard label="Active PO" value={fmtNumber(summary.totalActive)} icon={Package} tone="accent" />
            <KpiCard label="Expired Pending" value={fmtNumber(summary.expiredPending)} icon={AlertTriangle} tone="critical" />
            <KpiCard label="Critical" value={fmtNumber(summary.critical)} icon={AlertOctagon} tone="critical" />
            <KpiCard label="High" value={fmtNumber(summary.high)} icon={Flame} tone="high" />
            <KpiCard label="Medium" value={fmtNumber(summary.medium)} icon={Gauge} tone="medium" />
            <KpiCard label="Low" value={fmtNumber(summary.low)} icon={Gauge} tone="low" />
            <KpiCard label="Unscored" value={fmtNumber(summary.unscored)} icon={CircleSlash} />
            <KpiCard label="Expired (Status)" value={fmtNumber(summary.expired)} icon={CalendarX2} tone="critical" />
            <KpiCard label="Expiring Today" value={fmtNumber(summary.expiringToday)} icon={CalendarClock} tone="high" />
            <KpiCard label="Expiring Tmrw" value={fmtNumber(summary.expiringTomorrow)} icon={CalendarDays} tone="medium" />
            <KpiCard label="Pending Qty" value={fmtNumber(summary.pendingQty)} icon={Boxes} />
            <KpiCard label="Pending Value" value={fmtCurrency(summary.pendingValue)} icon={Wallet} />
            <KpiCard label="Avg Dispatch" value={fmtDays(summary.avgDispatchTimeDays)} icon={Truck} />
            <KpiCard label="Avg Appt Delay" value={fmtDays(summary.avgAppointmentDelayDays)} icon={Clock} />
            <KpiCard
              label="Avg Days Late"
              value={summary.avgOperationalDelayDaysLate === null ? "—" : `${summary.avgOperationalDelayDaysLate.toFixed(1)}d`}
              icon={Hourglass}
              tone="critical"
            />
          </div>
        ) : null}

        {!errorMessage && (
          <>
            <PoControlTower rows={pendingRows} marketplaces={[...MARKETPLACES]} hasRules={hasRules} />
            <details className="glass-card rounded-lg px-3 py-1.5 text-xs">
              <summary className="cursor-pointer select-none font-medium text-neutral-500">
                Expired POs, Needs Review, and Charts
              </summary>
              <div className="mt-2 space-y-3 pb-1">
                <SecondaryPoTable title="Expired POs" rows={expiredRows} />
                <SecondaryPoTable
                  title="Needs Review — status not yet classified"
                  note="Price issue, Scheduled, Revised appt. required, etc. — not run through priority scoring until confirmed how they should be handled."
                  rows={needsReviewRows}
                />
                <PoCharts rows={pendingRows} />
              </div>
            </details>
          </>
        )}
      </div>
    </MarketplaceThemeScope>
  );
}
