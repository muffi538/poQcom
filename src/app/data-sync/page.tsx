import { supabase } from "@/lib/supabase";
import { MarketplaceThemeScope } from "@/components/theme/marketplace-theme-scope";
import { DataSyncClient } from "@/components/data-sync/data-sync-client";
import { getSheetConnections, getSyncHistory, getAutoSyncSettings } from "./actions";

export default async function DataSyncPage() {
  const [{ data: marketplaces }, connections, syncHistory, autoSyncSettings] = await Promise.all([
    supabase.from("marketplaces").select("id, name").eq("is_active", true).order("name"),
    getSheetConnections(),
    getSyncHistory(),
    getAutoSyncSettings(),
  ]);

  return (
    <MarketplaceThemeScope marketplace={null}>
      <div className="max-w-4xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Data Sync</h1>
          <p className="text-sm text-neutral-500">
            Google Sheet connections, manual syncs, and sync history — all stored in Supabase, no env
            var or redeploy needed to change a sheet.
          </p>
        </div>

        <DataSyncClient
          marketplaces={marketplaces ?? []}
          connections={connections}
          syncHistory={syncHistory}
          autoSyncSettings={autoSyncSettings}
        />
      </div>
    </MarketplaceThemeScope>
  );
}
