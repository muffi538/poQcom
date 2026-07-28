import { AwaitingConfig } from "@/components/dashboard/awaiting-config";
import { OverviewClient } from "@/components/dashboard/overview-client";
import { MarketplaceThemeScope } from "@/components/theme/marketplace-theme-scope";
import { fetchAllPurchaseOrdersFromSupabase } from "@/lib/data/purchase-orders";
import { listRules } from "@/lib/rules/storage";
import { getEngineConfig } from "@/lib/config/store";
import { getDemandIndex } from "@/lib/demand";
import { MARKETPLACES, marketplaceSlug } from "@/types/marketplace";
import { PurchaseOrder } from "@/types/purchase-order";
import { Rule } from "@/types/rules";
import { EngineConfig } from "@/lib/config/engine-config";
import { DemandIndex } from "@/lib/demand/rank";
import { getSessionUser } from "@/lib/auth/session";

// Supabase is a live source of truth (updated by every sync) — this page
// must re-fetch on every request, never serve a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  let errorMessage: string | null = null;
  let pos: PurchaseOrder[] = [];
  let rules: Rule[] = [];
  let config: EngineConfig | null = null;
  let demandIndex: DemandIndex = new Map();
  let demandError: string | null = null;

  // Overview aggregates across marketplaces itself (unlike a single
  // marketplace page, which is inherently scoped by its own URL) — a
  // user only granted a subset of marketplaces must only ever see that
  // subset's data here too, not silently everyone's.
  const sessionUser = await getSessionUser();
  const visibleMarketplaces: string[] = sessionUser?.isAdmin
    ? [...MARKETPLACES]
    : MARKETPLACES.filter((m) => sessionUser?.pageKeys.includes(marketplaceSlug(m)));

  try {
    const [fetchedPos, fetchedRules, fetchedConfig, demand] = await Promise.all([
      fetchAllPurchaseOrdersFromSupabase(),
      listRules(),
      getEngineConfig(),
      getDemandIndex(),
    ]);
    pos = fetchedPos.filter((po) => visibleMarketplaces.includes(po.marketplace));
    rules = fetchedRules;
    config = fetchedConfig;
    demandIndex = demand.index;
    demandError = demand.error;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Failed to load PO data.";
  }

  return (
    <MarketplaceThemeScope marketplace={null}>
      <div className="space-y-1.5">
        <h1 className="text-base font-semibold tracking-tight text-neutral-500">
          Overview <span className="font-normal text-neutral-400">— {visibleMarketplaces.join(", ") || "no marketplaces granted"}</span>
        </h1>

        {errorMessage || !config ? (
          <AwaitingConfig title="Executive Summary" items={[errorMessage ?? "Failed to load engine config."]} />
        ) : (
          <OverviewClient
            pos={pos}
            rules={rules}
            config={config}
            demandIndex={demandIndex}
            demandError={demandError}
            marketplaces={visibleMarketplaces}
          />
        )}
      </div>
    </MarketplaceThemeScope>
  );
}
