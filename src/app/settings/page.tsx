import { getConfiguredSheetId } from "@/lib/sheets/client";
import { getEngineConfig } from "@/lib/config/store";
import { SUPPORTED_MARKETPLACES } from "@/lib/sheets/marketplaces";

const GID_ENV_KEYS: Record<string, string> = {
  Zepto: "GOOGLE_SHEET_GID_ZEPTO",
  Blinkit: "GOOGLE_SHEET_GID_BLINKIT",
  Instamart: "GOOGLE_SHEET_GID_INSTAMART",
};

export default async function SettingsPage() {
  const sheetId = getConfiguredSheetId();
  const config = await getEngineConfig();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-neutral-500">Google Sheets connection and priority engine config.</p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-semibold">Sheet connection</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Status:{" "}
          {sheetId ? (
            <span className="font-medium text-green-600">connected to sheet {sheetId}</span>
          ) : (
            <span className="font-medium text-amber-600">not configured</span>
          )}
        </p>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Read via Google&apos;s public CSV export — no service account needed, as long as the
          sheet stays shared as &quot;Anyone with the link can view&quot;.
        </p>

        <ul className="mt-4 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
          {SUPPORTED_MARKETPLACES.map((m) => (
            <li key={m}>
              {m}: tab {process.env[GID_ENV_KEYS[m]] ? "configured" : "missing"} ({GID_ENV_KEYS[m]})
            </li>
          ))}
          <li>
            EAN price master: {process.env.GOOGLE_SHEET_GID_EAN ? "configured" : "missing"} (GOOGLE_SHEET_GID_EAN)
          </li>
        </ul>

        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          This form is read-only for now — env vars (see <code>.env.example</code>) are the
          source of truth until it&apos;s decided whether ops users should edit the sheet
          link/tabs directly in this UI.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-semibold">Priority engine config</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Starting defaults, confirmed as editable — not hardcoded in the engine.
        </p>

        <div className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          <p className="font-medium text-neutral-800 dark:text-neutral-200">Metro cities (+{config.metroCityScoreBonus} score)</p>
          <p>{config.metroCities.join(", ")}</p>
        </div>

        <div className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          <p className="font-medium text-neutral-800 dark:text-neutral-200">Priority level thresholds</p>
          <p>
            Critical ≥ {config.levelThresholds.critical}, High ≥ {config.levelThresholds.high}, Medium ≥{" "}
            {config.levelThresholds.medium}, Low below that.
          </p>
        </div>

        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Also read-only for now — stored in <code>.data/engine-config.json</code>; an edit form
          is next once the Rules Builder itself is interactive.
        </p>
      </div>
    </div>
  );
}
