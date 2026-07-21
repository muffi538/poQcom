import { notFound } from "next/navigation";
import { MARKETPLACES } from "@/types/marketplace";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AwaitingConfig } from "@/components/dashboard/awaiting-config";
import { PoControlTower } from "@/components/dashboard/po-control-tower";
import { PoCharts } from "@/components/dashboard/po-charts";
import { fetchPurchaseOrders, SupportedMarketplace } from "@/lib/sheets/marketplaces";
import { listRules } from "@/lib/rules/storage";
import { getEngineConfig } from "@/lib/config/store";
import { buildExecutiveSummary } from "@/lib/dashboard/summary";
import { buildPoRows } from "@/lib/dashboard/po-rows";
import { isTerminalStatus } from "@/types/purchase-order";

export function generateStaticParams() {
  return MARKETPLACES.map((m) => ({ marketplace: m.toLowerCase() }));
}

function fmtDays(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}d`;
}

function fmtPercent(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(0)}%`;
}

export default async function MarketplacePage({
  params,
}: {
  params: Promise<{ marketplace: string }>;
}) {
  const { marketplace: marketplaceParam } = await params;
  const marketplace = MARKETPLACES.find(
    (m) => m.toLowerCase() === marketplaceParam.toLowerCase()
  );
  if (!marketplace) notFound();

  let errorMessage: string | null = null;
  let summary: Awaited<ReturnType<typeof buildExecutiveSummary>> | null = null;
  let rows: ReturnType<typeof buildPoRows> = [];
  let hasRules = false;

  try {
    const [pos, rules, config] = await Promise.all([
      fetchPurchaseOrders(marketplace as SupportedMarketplace),
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
      <h1 className="text-xl font-semibold">{marketplace}</h1>

      {errorMessage ? (
        <AwaitingConfig title={`${marketplace} PO table`} items={[errorMessage]} />
      ) : summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Pending Orders" value={summary.totalActive} />
          <KpiCard label="Pending Qty" value={summary.pendingQty} />
          <KpiCard label="Avg Dispatch Time" value={fmtDays(summary.avgDispatchTimeDays)} />
          <KpiCard label="Avg Appointment Delay" value={fmtDays(summary.avgAppointmentDelayDays)} />
          <KpiCard label="SLA %" value={fmtPercent(summary.avgSlaConsumedPercent)} />
          <KpiCard label="Risk (Critical + High)" value={summary.critical + summary.high} />
        </div>
      ) : null}

      {!errorMessage && (
        <>
          <PoControlTower rows={rows} marketplaces={[marketplace]} hasRules={hasRules} />
          <PoCharts rows={rows} />
        </>
      )}
    </div>
  );
}
