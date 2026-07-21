import { KpiCard } from "@/components/dashboard/kpi-card";
import { AwaitingConfig } from "@/components/dashboard/awaiting-config";
import { PoControlTower } from "@/components/dashboard/po-control-tower";
import { PoCharts } from "@/components/dashboard/po-charts";
import { fetchAllPurchaseOrders } from "@/lib/sheets/marketplaces";
import { listRules } from "@/lib/rules/storage";
import { getEngineConfig } from "@/lib/config/store";
import { buildExecutiveSummary } from "@/lib/dashboard/summary";
import { buildPoRows } from "@/lib/dashboard/po-rows";
import { isTerminalStatus } from "@/types/purchase-order";
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

function fmtPercent(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(0)}%`;
}

export default async function OverviewPage() {
  let errorMessage: string | null = null;
  let summary: Awaited<ReturnType<typeof buildExecutiveSummary>> | null = null;
  let rows: ReturnType<typeof buildPoRows> = [];
  let hasRules = false;

  try {
    const [pos, rules, config] = await Promise.all([
      fetchAllPurchaseOrders(),
      listRules(),
      getEngineConfig(),
    ]);
    summary = buildExecutiveSummary(pos, rules, config);
    const activePos = pos.filter((po) => !isTerminalStatus(po.status));
    rows = buildPoRows(activePos, rules, config);
    hasRules = rules.some((r) => r.enabled);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Failed to load PO data.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Overview — All Marketplaces</h1>
        <p className="text-sm text-neutral-500">
          Executive summary across Zepto, Blinkit, and Instamart.
        </p>
      </div>

      {errorMessage ? (
        <AwaitingConfig title="Executive Summary" items={[errorMessage]} />
      ) : summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <KpiCard label="Total Active PO" value={fmtNumber(summary.totalActive)} />
          <KpiCard label="Critical" value={fmtNumber(summary.critical)} />
          <KpiCard label="High" value={fmtNumber(summary.high)} />
          <KpiCard label="Medium" value={fmtNumber(summary.medium)} />
          <KpiCard label="Low" value={fmtNumber(summary.low)} />
          <KpiCard label="Unscored" value={fmtNumber(summary.unscored)} />
          <KpiCard label="Expired" value={fmtNumber(summary.expired)} />
          <KpiCard label="Expiring Today" value={fmtNumber(summary.expiringToday)} />
          <KpiCard label="Pending Qty" value={fmtNumber(summary.pendingQty)} />
          <KpiCard label="Pending Value" value={fmtCurrency(summary.pendingValue)} />
          <KpiCard label="Avg Dispatch Time" value={fmtDays(summary.avgDispatchTimeDays)} />
          <KpiCard label="Avg Appointment Delay" value={fmtDays(summary.avgAppointmentDelayDays)} />
          <KpiCard label="Avg SLA Consumption" value={fmtPercent(summary.avgSlaConsumedPercent)} />
        </div>
      ) : null}

      {!errorMessage && (
        <>
          <PoControlTower rows={rows} marketplaces={[...MARKETPLACES]} hasRules={hasRules} />
          <PoCharts rows={rows} />
        </>
      )}
    </div>
  );
}
