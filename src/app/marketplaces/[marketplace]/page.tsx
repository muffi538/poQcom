import { notFound } from "next/navigation";
import { MARKETPLACES, marketplaceSlug } from "@/types/marketplace";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AwaitingConfig } from "@/components/dashboard/awaiting-config";
import { MarketplaceTabbedView } from "@/components/dashboard/marketplace-tabbed-view";
import { MarketplaceThemeScope } from "@/components/theme/marketplace-theme-scope";
import { fetchPurchaseOrders, SupportedMarketplace } from "@/lib/sheets/marketplaces";
import { listRules } from "@/lib/rules/storage";
import { getEngineConfig } from "@/lib/config/store";
import { getDemandIndex } from "@/lib/demand";
import { buildTopSkuTable, TopSkuTableResult } from "@/lib/demand/sku-table";
import { buildExecutiveSummary } from "@/lib/dashboard/summary";
import { buildPoRows } from "@/lib/dashboard/po-rows";
import { classifyStatus, isFullyExcludedStatus, isLowValueCantDispatch } from "@/types/purchase-order";
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
  let dispatchedRows: ReturnType<typeof buildPoRows> = [];
  let deliveredRows: ReturnType<typeof buildPoRows> = [];
  let cancelledRows: ReturnType<typeof buildPoRows> = [];
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

    const visiblePos = pos.filter((po) => !isFullyExcludedStatus(po.status) && !isLowValueCantDispatch(po.status));
    const pendingPos = visiblePos.filter((po) => classifyStatus(po.status) === "pending");
    const expiredPos = visiblePos.filter((po) => classifyStatus(po.status) === "expired");
    const dispatchedPos = visiblePos.filter((po) => classifyStatus(po.status) === "dispatched");
    const deliveredPos = visiblePos.filter((po) => classifyStatus(po.status) === "delivered");
    const cancelledPos = visiblePos.filter((po) => classifyStatus(po.status) === "cancelled");
    const needsReviewPos = visiblePos.filter((po) => classifyStatus(po.status) === "needs_review");

    summary = buildExecutiveSummary(visiblePos, rules, config, demandIndex);
    pendingRows = buildPoRows(pendingPos, rules, config, demandIndex);
    expiredRows = buildPoRows(expiredPos, rules, config, demandIndex);
    dispatchedRows = buildPoRows(dispatchedPos, rules, config, demandIndex);
    deliveredRows = buildPoRows(deliveredPos, rules, config, demandIndex);
    cancelledRows = buildPoRows(cancelledPos, rules, config, demandIndex);
    needsReviewRows = buildPoRows(needsReviewPos, rules, config, demandIndex);
    topSkuData = buildTopSkuTable(marketplace as SupportedMarketplace, demandIndex, pendingPos);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Failed to load PO data.";
  }

  const theme = themeFor(marketplace);

  return (
    <MarketplaceThemeScope marketplace={marketplace}>
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-2 text-base font-semibold tracking-tight text-neutral-500">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.primary }} />
          {marketplace}
        </h1>

        {errorMessage ? (
          <AwaitingConfig title={`${marketplace} PO table`} items={[errorMessage]} />
        ) : summary ? (
          <div className="flex flex-wrap gap-1">
            <KpiCard label="Pending Orders" value={summary.totalActive} tone="accent" />
            <KpiCard label="Expired Pending" value={summary.expiredPending} tone="critical" />
            <KpiCard label="Pending Qty" value={summary.pendingQty} tone="accent" />
            <KpiCard label="Avg Dispatch" value={fmtDays(summary.avgDispatchTimeDays)} tone="accent" />
            <KpiCard label="Avg Appt Delay" value={fmtDays(summary.avgAppointmentDelayDays)} tone="accent" />
            <KpiCard
              label="Avg Days Late"
              value={summary.avgOperationalDelayDaysLate === null ? "—" : `${summary.avgOperationalDelayDaysLate.toFixed(1)}d`}
              tone="critical"
            />
            <KpiCard label="Risk (Crit+High)" value={summary.critical + summary.high} tone="critical" />
          </div>
        ) : null}

        {!errorMessage && (
          <MarketplaceTabbedView
            marketplace={marketplace}
            pendingRows={pendingRows}
            deliveredRows={deliveredRows}
            dispatchedRows={dispatchedRows}
            cancelledRows={cancelledRows}
            expiredRows={expiredRows}
            needsReviewRows={needsReviewRows}
            hasRules={hasRules}
            demandError={demandError}
            topSkuData={topSkuData}
            accentHex={theme.primary}
          />
        )}
      </div>
    </MarketplaceThemeScope>
  );
}
