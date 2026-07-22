import { CheckCircle2, AlertTriangle } from "lucide-react";
import { getConfiguredSheetId } from "@/lib/sheets/client";
import { getEngineConfig } from "@/lib/config/store";
import { SUPPORTED_MARKETPLACES, TAB_CONFIG } from "@/lib/sheets/marketplaces";
import { MarketplaceThemeScope } from "@/components/theme/marketplace-theme-scope";

export default async function SettingsPage() {
  const sheetId = getConfiguredSheetId();
  const config = await getEngineConfig();

  return (
    <MarketplaceThemeScope marketplace={null}>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-neutral-500">Google Sheets connection and priority engine config.</p>
        </div>

        <div className="glass-card rounded-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Sheet connection</h2>
          <p className="mt-2 flex items-center gap-1.5 text-sm">
            {sheetId ? (
              <>
                <CheckCircle2 size={15} className="text-[#0ca30c]" />
                <span className="font-medium text-[#0b7a0b] dark:text-[#6fdc6f]">
                  Connected to sheet {sheetId}
                </span>
              </>
            ) : (
              <>
                <AlertTriangle size={15} className="text-[#fab219]" />
                <span className="font-medium text-[#8a5c00] dark:text-[#ffd479]">Not configured</span>
              </>
            )}
          </p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Read via Google&apos;s public CSV export — no service account needed, as long as the
            sheet stays shared as &quot;Anyone with the link can view&quot;.
          </p>

          <ul className="mt-4 space-y-1.5 text-sm text-neutral-600 dark:text-neutral-400">
            {SUPPORTED_MARKETPLACES.map((m) => {
              const tab = TAB_CONFIG[m];
              const gidConfigured = Boolean(process.env[tab.gidEnvKey]);
              // sheetUrlEnvKey is an optional per-marketplace override, not
              // a requirement — unset just means this marketplace lives in
              // the shared GOOGLE_SHEET_URL workbook, not "missing".
              const usingSeparateSheet = Boolean(tab.sheetUrlEnvKey && process.env[tab.sheetUrlEnvKey]);
              const columnsMapped = tab.poNoColumn !== null;
              const ok = gidConfigured && columnsMapped;
              let detail = `${tab.gidEnvKey}${usingSeparateSheet ? `, ${tab.sheetUrlEnvKey}` : ""}`;
              if (!columnsMapped) detail = "column layout not yet mapped — see TAB_CONFIG";
              return (
                <li key={m} className="flex items-center gap-1.5">
                  {ok ? (
                    <CheckCircle2 size={13} className="text-[#0ca30c]" />
                  ) : (
                    <AlertTriangle size={13} className="text-[#fab219]" />
                  )}
                  {m}: tab {ok ? "configured" : "missing"} ({detail})
                </li>
              );
            })}
            <li className="flex items-center gap-1.5">
              {process.env.GOOGLE_SHEET_GID_EAN ? (
                <CheckCircle2 size={13} className="text-[#0ca30c]" />
              ) : (
                <AlertTriangle size={13} className="text-[#fab219]" />
              )}
              EAN price master: {process.env.GOOGLE_SHEET_GID_EAN ? "configured" : "missing"} (GOOGLE_SHEET_GID_EAN)
            </li>
          </ul>

          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            This form is read-only for now — env vars (see <code>.env.example</code>) are the
            source of truth until it&apos;s decided whether ops users should edit the sheet
            link/tabs directly in this UI.
          </p>
        </div>

        <div className="glass-card rounded-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Priority engine config</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Starting defaults, confirmed as editable — not hardcoded in the engine.
          </p>

          <div className="mt-3 rounded-xl bg-neutral-50 p-3 text-sm dark:bg-neutral-800/40">
            <p className="font-medium text-neutral-800 dark:text-neutral-200">
              Metro cities (+{config.metroCityScoreBonus} score)
            </p>
            <p className="mt-1 text-neutral-600 dark:text-neutral-400">{config.metroCities.join(", ")}</p>
          </div>

          <div className="mt-3 rounded-xl bg-neutral-50 p-3 text-sm dark:bg-neutral-800/40">
            <p className="font-medium text-neutral-800 dark:text-neutral-200">Priority level thresholds</p>
            <p className="mt-1 text-neutral-600 dark:text-neutral-400">
              Critical ≥ {config.levelThresholds.critical}, High ≥ {config.levelThresholds.high}, Medium ≥{" "}
              {config.levelThresholds.medium}, Low below that.
            </p>
          </div>

          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Also read-only for now — stored in <code>.data/engine-config.json</code>; an edit form
            is next once the Rules Builder itself is interactive.
          </p>
        </div>
      </div>
    </MarketplaceThemeScope>
  );
}
