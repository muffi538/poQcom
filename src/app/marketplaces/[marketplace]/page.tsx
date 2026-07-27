import { notFound } from "next/navigation";
import { MARKETPLACES, marketplaceSlug } from "@/types/marketplace";
import { AwaitingConfig } from "@/components/dashboard/awaiting-config";
import { MarketplacePageClient } from "@/components/dashboard/marketplace-page-client";
import { MarketplaceThemeScope } from "@/components/theme/marketplace-theme-scope";
import { fetchPurchaseOrdersForMarketplaceName } from "@/lib/data/purchase-orders";
import { listRules } from "@/lib/rules/storage";
import { getEngineConfig } from "@/lib/config/store";
import { getDemandIndex } from "@/lib/demand";
import { themeFor } from "@/lib/theme/marketplace-colors";
import { PurchaseOrder } from "@/types/purchase-order";
import { Rule } from "@/types/rules";
import { EngineConfig } from "@/lib/config/engine-config";
import { DemandIndex } from "@/lib/demand/rank";

export function generateStaticParams() {
  return MARKETPLACES.map((m) => ({ marketplace: marketplaceSlug(m) }));
}

// Supabase is a live source of truth (updated by every sync) — this page
// must re-fetch on every request, never serve a build-time snapshot.
export const dynamic = "force-dynamic";

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
  let pos: PurchaseOrder[] = [];
  let rules: Rule[] = [];
  let config: EngineConfig | null = null;
  let demandIndex: DemandIndex = new Map();
  let demandError: string | null = null;

  try {
    const [fetchedPos, fetchedRules, fetchedConfig, demand] = await Promise.all([
      fetchPurchaseOrdersForMarketplaceName(marketplace),
      listRules(),
      getEngineConfig(),
      getDemandIndex(),
    ]);
    pos = fetchedPos;
    rules = fetchedRules;
    config = fetchedConfig;
    demandIndex = demand.index;
    demandError = demand.error;
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

        {errorMessage || !config ? (
          <AwaitingConfig title={`${marketplace} PO table`} items={[errorMessage ?? "Failed to load engine config."]} />
        ) : (
          <MarketplacePageClient
            marketplace={marketplace}
            pos={pos}
            rules={rules}
            config={config}
            demandIndex={demandIndex}
            demandError={demandError}
          />
        )}
      </div>
    </MarketplaceThemeScope>
  );
}
