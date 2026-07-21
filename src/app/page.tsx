import { KpiCard } from "@/components/dashboard/kpi-card";
import { AwaitingConfig } from "@/components/dashboard/awaiting-config";
import { fetchAllPurchaseOrders } from "@/lib/sheets/marketplaces";
import { listRules } from "@/lib/rules/storage";
import { getEngineConfig } from "@/lib/config/store";
import { buildExecutiveSummary } from "@/lib/dashboard/summary";

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

  try {
    const [pos, rules, config] = await Promise.all([
      fetchAllPurchaseOrders(),
      listRules(),
      getEngineConfig(),
    ]);
    summary = buildExecutiveSummary(pos, rules, config);
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
        <>
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

          {summary.unscored === summary.totalActive && (
            <AwaitingConfig
              title='Every PO is currently "Unscored"'
              items={[
                "No rules have been published in the Rules Builder yet — every PO's score is 0 and its level shows Unscored until at least one rule matches it.",
              ]}
            />
          )}
        </>
      ) : null}

      <AwaitingConfig
        title="Operations Control Tower"
        items={[
          "Dispatch-in-next-2-hours, Safe-to-postpone, SLA-risk, and bottleneck questions all read from the Priority Engine output — once rules exist, this section answers them automatically.",
        ]}
      />
    </div>
  );
}
