import { notFound } from "next/navigation";
import { Package, Boxes, Truck, Clock, Percent, ShieldAlert } from "lucide-react";
import { MARKETPLACES } from "@/types/marketplace";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AwaitingConfig } from "@/components/dashboard/awaiting-config";
import { PoControlTower } from "@/components/dashboard/po-control-tower";
import { PoCharts } from "@/components/dashboard/po-charts";
import { SecondaryPoTable } from "@/components/dashboard/secondary-po-table";
import { MarketplaceThemeScope } from "@/components/theme/marketplace-theme-scope";
import { fetchPurchaseOrders, SupportedMarketplace } from "@/lib/sheets/marketplaces";
import { listRules } from "@/lib/rules/storage";
import { getEngineConfig } from "@/lib/config/store";
import { buildExecutiveSummary } from "@/lib/dashboard/summary";
import { buildPoRows } from "@/lib/dashboard/po-rows";
import { classifyStatus, isTerminalStatus, isLowValueCantDispatch } from "@/types/purchase-order";
import { themeFor } from "@/lib/theme/marketplace-colors";

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
  let pendingRows: ReturnType<typeof buildPoRows> = [];
  let expiredRows: ReturnType<typeof buildPoRows> = [];
  let needsReviewRows: ReturnType<typeof buildPoRows> = [];
  let hasRules = false;

  try {
    const [pos, rules, config] = await Promise.all([
      fetchPurchaseOrders(marketplace as SupportedMarketplace),
      listRules(),
      getEngineConfig(),
    ]);
    hasRules = rules.some((r) => r.enabled);

    const visiblePos = pos.filter((po) => !isTerminalStatus(po.status) && !isLowValueCantDispatch(po.status));
    const pendingPos = visiblePos.filter((po) => classifyStatus(po.status) === "pending");
    const expiredPos = visiblePos.filter((po) => classifyStatus(po.status) === "expired");
    const needsReviewPos = visiblePos.filter((po) => classifyStatus(po.status) === "needs_review");

    summary = buildExecutiveSummary(visiblePos, rules, config);
    pendingRows = buildPoRows(pendingPos, rules, config);
    expiredRows = buildPoRows(expiredPos, rules, config);
    needsReviewRows = buildPoRows(needsReviewPos, rules, config);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Failed to load PO data.";
  }

  const theme = themeFor(marketplace);

  return (
    <MarketplaceThemeScope marketplace={marketplace}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.primary }} />
          <h1 className="text-2xl font-semibold tracking-tight">{marketplace}</h1>
        </div>

        {errorMessage ? (
          <AwaitingConfig title={`${marketplace} PO table`} items={[errorMessage]} />
        ) : summary ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KpiCard label="Pending Orders" value={summary.totalActive} icon={Package} tone="accent" />
            <KpiCard label="Pending Qty" value={summary.pendingQty} icon={Boxes} tone="accent" />
            <KpiCard label="Avg Dispatch Time" value={fmtDays(summary.avgDispatchTimeDays)} icon={Truck} tone="accent" />
            <KpiCard label="Avg Appointment Delay" value={fmtDays(summary.avgAppointmentDelayDays)} icon={Clock} tone="accent" />
            <KpiCard label="SLA %" value={fmtPercent(summary.avgSlaConsumedPercent)} icon={Percent} tone="accent" />
            <KpiCard label="Risk (Critical + High)" value={summary.critical + summary.high} icon={ShieldAlert} tone="critical" />
          </div>
        ) : null}

        {!errorMessage && (
          <>
            <PoControlTower rows={pendingRows} marketplaces={[marketplace]} hasRules={hasRules} />
            <SecondaryPoTable title="Expired POs" rows={expiredRows} />
            <SecondaryPoTable
              title="Needs Review — status not yet classified"
              note="Price issue, Scheduled, Revised appt. required, etc. — not run through priority scoring until confirmed how they should be handled."
              rows={needsReviewRows}
            />
            <PoCharts rows={pendingRows} accentHex={theme.primary} />
          </>
        )}
      </div>
    </MarketplaceThemeScope>
  );
}
