import { notFound } from "next/navigation";
import { Package, Boxes, Truck, Clock, AlertTriangle, ShieldAlert } from "lucide-react";
import { MARKETPLACES, marketplaceSlug } from "@/types/marketplace";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AwaitingConfig } from "@/components/dashboard/awaiting-config";
import { PoControlTower } from "@/components/dashboard/po-control-tower";
import { PoCharts } from "@/components/dashboard/po-charts";
import { SecondaryPoTable } from "@/components/dashboard/secondary-po-table";
import { DemandIntelligence } from "@/components/dashboard/demand-intelligence";
import { MarketplaceThemeScope } from "@/components/theme/marketplace-theme-scope";
import { fetchPurchaseOrders, SupportedMarketplace } from "@/lib/sheets/marketplaces";
import { listRules } from "@/lib/rules/storage";
import { getEngineConfig } from "@/lib/config/store";
import { getDemandIndex } from "@/lib/demand";
import { buildTopSkuTable, TopSkuTableResult } from "@/lib/demand/sku-table";
import { buildExecutiveSummary } from "@/lib/dashboard/summary";
import { buildPoRows } from "@/lib/dashboard/po-rows";
import { classifyStatus, isTerminalStatus, isLowValueCantDispatch } from "@/types/purchase-order";
import { themeFor } from "@/lib/theme/marketplace-colors";

export function generateStaticParams() {
  return MARKETPLACES.map((m) => ({ marketplace: marketplaceSlug(m) }));
}

function fmtDays(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}d`;
}

export default async function MarketplacePage({
  params,
}: {
  params: Promise<{ marketplace: string }>;
}) {
  const { marketplace: marketplaceParam } = await params;
  const marketplace = MARKETPLACES.find(
    (m) => marketplaceSlug(m) === marketplaceParam.toLowerCase()
  );
  if (!marketplace) notFound();

  let errorMessage: string | null = null;
  let summary: Awaited<ReturnType<typeof buildExecutiveSummary>> | null = null;
  let pendingRows: ReturnType<typeof buildPoRows> = [];
  let expiredRows: ReturnType<typeof buildPoRows> = [];
  let needsReviewRows: ReturnType<typeof buildPoRows> = [];
  let hasRules = false;
  let demandError: string | null = null;
  let topSkuData: TopSkuTableResult | null = null;

  try {
    const [pos, rules, config, demand] = await Promise.all([
      fetchPurchaseOrders(marketplace as SupportedMarketplace),
      listRules(),
      getEngineConfig(),
      getDemandIndex(),
    ]);
    hasRules = rules.some((r) => r.enabled);
    const demandIndex = demand.index;
    demandError = demand.error;

    const visiblePos = pos.filter((po) => !isTerminalStatus(po.status) && !isLowValueCantDispatch(po.status));
    const pendingPos = visiblePos.filter((po) => classifyStatus(po.status) === "pending");
    const expiredPos = visiblePos.filter((po) => classifyStatus(po.status) === "expired");
    const needsReviewPos = visiblePos.filter((po) => classifyStatus(po.status) === "needs_review");

    summary = buildExecutiveSummary(visiblePos, rules, config, demandIndex);
    pendingRows = buildPoRows(pendingPos, rules, config, demandIndex);
    expiredRows = buildPoRows(expiredPos, rules, config, demandIndex);
    needsReviewRows = buildPoRows(needsReviewPos, rules, config, demandIndex);
    topSkuData = buildTopSkuTable(marketplace as SupportedMarketplace, demandIndex, pendingPos);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Failed to load PO data.";
  }

  const theme = themeFor(marketplace);

  return (
    <MarketplaceThemeScope marketplace={marketplace}>
      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-base font-semibold tracking-tight text-neutral-500">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.primary }} />
          {marketplace}
        </h1>

        {errorMessage ? (
          <AwaitingConfig title={`${marketplace} PO table`} items={[errorMessage]} />
        ) : summary ? (
          <div className="flex flex-wrap gap-1">
            <KpiCard label="Pending Orders" value={summary.totalActive} icon={Package} tone="accent" />
            <KpiCard label="Expired Pending" value={summary.expiredPending} icon={AlertTriangle} tone="critical" />
            <KpiCard label="Pending Qty" value={summary.pendingQty} icon={Boxes} tone="accent" />
            <KpiCard label="Avg Dispatch" value={fmtDays(summary.avgDispatchTimeDays)} icon={Truck} tone="accent" />
            <KpiCard label="Avg Appt Delay" value={fmtDays(summary.avgAppointmentDelayDays)} icon={Clock} tone="accent" />
            <KpiCard
              label="Avg Days Late"
              value={summary.avgOperationalDelayDaysLate === null ? "—" : `${summary.avgOperationalDelayDaysLate.toFixed(1)}d`}
              icon={AlertTriangle}
              tone="critical"
            />
            <KpiCard label="Risk (Crit+High)" value={summary.critical + summary.high} icon={ShieldAlert} tone="critical" />
          </div>
        ) : null}

        {!errorMessage && (
          <>
            <PoControlTower
              rows={pendingRows}
              marketplaces={[marketplace]}
              hasRules={hasRules}
              demandError={demandError}
            />
            {topSkuData && <DemandIntelligence marketplace={marketplace} data={topSkuData} />}
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
                <PoCharts rows={pendingRows} accentHex={theme.primary} />
              </div>
            </details>
          </>
        )}
      </div>
    </MarketplaceThemeScope>
  );
}
