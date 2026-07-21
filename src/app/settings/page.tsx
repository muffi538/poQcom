import { getConfiguredSheetId } from "@/lib/sheets/client";

export default function SettingsPage() {
  const sheetId = getConfiguredSheetId();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-neutral-500">Google Sheets connection and sync.</p>
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

        <div className="mt-4 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
          <p>To connect the sheet right now, for this environment:</p>
          <ol className="list-inside list-decimal space-y-1">
            <li>
              Copy <code>.env.example</code> to <code>.env</code> (or set these as deployment
              environment variables).
            </li>
            <li>
              Paste the Google Sheet URL into <code>GOOGLE_SHEET_URL</code>.
            </li>
            <li>
              Fill in <code>GOOGLE_SHEET_RANGE_ALL</code> (or the per-marketplace range vars)
              with the tab/range that holds PO rows.
            </li>
            <li>
              Share the sheet with the service account email as Viewer, and set{" "}
              <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code> /{" "}
              <code>GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code>.
            </li>
          </ol>
        </div>

        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          This form is read-only for now — env vars are the source of truth until it&apos;s
          decided whether ops users should be able to paste the sheet link into this UI directly
          (which needs a small settings store, not just env vars). See open questions.
        </p>
      </div>
    </div>
  );
}
