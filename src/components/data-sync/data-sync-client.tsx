"use client";

import { useState, useTransition } from "react";
import { RefreshCw, CheckCircle2, XCircle, Circle } from "lucide-react";
import {
  SheetConnectionRow,
  SyncJobRow,
  AutoSyncSettings,
  saveSheetConnection,
  toggleSheetConnection,
  runPoSync,
  runSalesSync,
  runDispatchSync,
  runSyncAll,
  saveAutoSyncSettings,
} from "@/app/data-sync/actions";
import { WorkbookType } from "@/lib/import/field-mappings";

interface Marketplace {
  id: string;
  name: string;
}

const WORKBOOK_LABELS: Record<WorkbookType, string> = {
  po: "PO Workbook",
  sales: "Sales Workbook",
  dispatch: "Dispatch Workbook",
  ean: "EAN Workbook",
};

// PO has its own tab per marketplace (today's real shape); Sales/
// Dispatch/EAN share one tab across every marketplace, filtered
// internally by their own Marketplace/Platform column.
const PER_MARKETPLACE_WORKBOOKS: WorkbookType[] = ["po"];
const SHARED_WORKBOOKS: WorkbookType[] = ["sales", "dispatch", "ean"];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function StatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 size={14} className="text-[#0ca30c]" />;
  if (status === "failed") return <XCircle size={14} className="text-red-500" />;
  return <Circle size={14} className="text-neutral-400" />;
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

const JOB_TYPE_BY_WORKBOOK: Record<WorkbookType, string | null> = {
  po: "po_sync",
  sales: "sales_sync",
  dispatch: "dispatch_sync",
  ean: "ean_sync",
};

interface ConnectionStatus {
  lastSync: string | null;
  syncStatus: string | null;
  lastSuccess: string | null;
  lastFailure: string | null;
  durationMs: number | null;
  rowsInserted: number | null;
  rowsUpdated: number | null;
  rowsFailed: number | null;
}

// Derives per-workbook status straight from the same sync_jobs history
// the Sync History table already shows — no separate "current status"
// column to keep in sync with reality, just a filtered view of one log.
function getConnectionStatus(syncHistory: SyncJobRow[], workbookType: WorkbookType, marketplaceName: string | null): ConnectionStatus {
  const jobType = JOB_TYPE_BY_WORKBOOK[workbookType];
  const matching = syncHistory.filter((j) => j.jobType === jobType && (marketplaceName ? j.marketplaceName === marketplaceName : true));
  const latest = matching[0] ?? null;
  const lastSuccessJob = matching.find((j) => j.status === "success") ?? null;
  const lastFailureJob = matching.find((j) => j.status === "failed") ?? null;
  return {
    lastSync: latest?.startedAt ?? null,
    syncStatus: latest?.status ?? null,
    lastSuccess: lastSuccessJob?.completedAt ?? null,
    lastFailure: lastFailureJob?.startedAt ?? null,
    durationMs: latest?.durationMs ?? null,
    rowsInserted: latest?.rowsInserted ?? null,
    rowsUpdated: latest?.rowsUpdated ?? null,
    rowsFailed: latest?.rowsFailed ?? null,
  };
}

function ConnectionRow({
  workbookType,
  marketplace,
  connection,
  syncHistory,
  nextRunAt,
}: {
  workbookType: WorkbookType;
  marketplace: Marketplace | null; // null = shared connection
  connection: SheetConnectionRow | undefined;
  syncHistory: SyncJobRow[];
  nextRunAt: string | null;
}) {
  const status = getConnectionStatus(syncHistory, workbookType, marketplace?.name ?? null);
  const [sheetUrl, setSheetUrl] = useState(connection?.sheetUrl ?? "");
  const [gid, setGid] = useState(connection?.gid ?? "");
  const [minPoRaisedYear, setMinPoRaisedYear] = useState(connection?.minPoRaisedYear?.toString() ?? "");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const label = marketplace ? marketplace.name : `${WORKBOOK_LABELS[workbookType]} (shared)`;

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      try {
        await saveSheetConnection({
          workbookType,
          marketplaceId: marketplace?.id ?? null,
          sheetUrl,
          gid: gid.trim() || null,
          minPoRaisedYear: minPoRaisedYear.trim() ? Number(minPoRaisedYear) : null,
        });
        setMessage("Saved.");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  function handleToggle() {
    if (!connection) return;
    startTransition(async () => {
      try {
        await toggleSheetConnection(connection.id, !connection.isEnabled);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to toggle.");
      }
    });
  }

  function handleSync() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result =
          workbookType === "po" && marketplace
            ? await runPoSync(marketplace.id, marketplace.name)
            : workbookType === "sales"
              ? await runSalesSync()
              : workbookType === "dispatch"
                ? await runDispatchSync()
                : null;
        if (!result) {
          setMessage("No manual sync wired up for this workbook yet.");
          return;
        }
        setMessage(
          result.status === "success"
            ? `Synced: ${result.rowsInserted} inserted, ${result.rowsUpdated} updated, ${result.rowsFailed} failed.`
            : `${result.status}: ${result.errorMessage ?? "unknown error"}`
        );
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Sync failed.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-frido-border py-2 text-sm first:border-t-0 dark:border-white/10">
      <span className="w-32 shrink-0 font-medium">{label}</span>
      <input
        value={sheetUrl}
        onChange={(e) => setSheetUrl(e.target.value)}
        placeholder="Google Sheet URL"
        className="min-w-[220px] flex-1 rounded border border-frido-border bg-transparent px-2 py-1 text-xs dark:border-white/10"
      />
      <input
        value={gid}
        onChange={(e) => setGid(e.target.value)}
        placeholder="gid (optional)"
        className="w-28 rounded border border-frido-border bg-transparent px-2 py-1 text-xs dark:border-white/10"
      />
      {workbookType === "po" && (
        <input
          value={minPoRaisedYear}
          onChange={(e) => setMinPoRaisedYear(e.target.value)}
          placeholder="Min year"
          className="w-20 rounded border border-frido-border bg-transparent px-2 py-1 text-xs dark:border-white/10"
        />
      )}
      <button
        onClick={handleSave}
        disabled={isPending || !sheetUrl.trim()}
        className="rounded bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
      >
        Save
      </button>
      {connection && (
        <button
          onClick={handleToggle}
          disabled={isPending}
          className="rounded border border-frido-border px-2.5 py-1 text-xs disabled:opacity-40 dark:border-white/10"
        >
          {connection.isEnabled ? "Enabled" : "Disabled"}
        </button>
      )}
      <button
        onClick={handleSync}
        disabled={isPending || !connection}
        title={!connection ? "Save a connection first" : undefined}
        className="flex items-center gap-1 rounded border border-frido-border px-2.5 py-1 text-xs disabled:opacity-40 dark:border-white/10"
      >
        <RefreshCw size={12} className={isPending ? "animate-spin" : ""} />
        Manual Sync
      </button>
      {message && <span className="w-full text-xs text-neutral-500">{message}</span>}

      <div className="mt-1 grid w-full grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-neutral-500 sm:grid-cols-4">
        <span className="flex items-center gap-1">
          {status.syncStatus && <StatusIcon status={status.syncStatus} />} Last Sync: {fmtDate(status.lastSync)}
        </span>
        <span>Next Sync: {fmtDate(nextRunAt)}</span>
        <span>Last Success: {fmtDate(status.lastSuccess)}</span>
        <span>Last Failure: {fmtDate(status.lastFailure)}</span>
        <span>Duration: {fmtDuration(status.durationMs)}</span>
        <span>Rows Imported: {status.rowsInserted ?? "—"}</span>
        <span>Rows Updated: {status.rowsUpdated ?? "—"}</span>
        <span>Rows Failed: {status.rowsFailed ?? "—"}</span>
      </div>
    </div>
  );
}

export function DataSyncClient({
  marketplaces,
  connections,
  syncHistory,
  autoSyncSettings,
}: {
  marketplaces: Marketplace[];
  connections: SheetConnectionRow[];
  syncHistory: SyncJobRow[];
  autoSyncSettings: AutoSyncSettings;
}) {
  const [isPending, startTransition] = useTransition();
  const [syncAllMessage, setSyncAllMessage] = useState<string | null>(null);
  const [autoEnabled, setAutoEnabled] = useState(autoSyncSettings.enabled);
  const [interval, setIntervalValue] = useState(autoSyncSettings.intervalMinutes);

  const connectionByKey = new Map(connections.map((c) => [`${c.workbookType}:${c.marketplaceId ?? "shared"}`, c]));

  function handleSyncAll() {
    setSyncAllMessage(null);
    startTransition(async () => {
      const results = await runSyncAll();
      const ok = results.filter((r) => r.status === "success").length;
      setSyncAllMessage(`Sync All: ${ok}/${results.length} succeeded.`);
    });
  }

  function handleAutoSyncSave(enabled: boolean, intervalMinutes: number) {
    setAutoEnabled(enabled);
    setIntervalValue(intervalMinutes);
    startTransition(async () => {
      await saveAutoSyncSettings({ enabled, intervalMinutes });
    });
  }

  const failedJobs = syncHistory.filter((j) => j.status === "failed");
  const lastSuccessful = syncHistory.find((j) => j.status === "success");

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Sync controls</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Last successful sync: {lastSuccessful ? fmtDate(lastSuccessful.completedAt) : "never"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={autoEnabled} onChange={(e) => handleAutoSyncSave(e.target.checked, interval)} />
              Auto Sync
            </label>
            <select
              value={interval}
              onChange={(e) => handleAutoSyncSave(autoEnabled, Number(e.target.value))}
              disabled={!autoEnabled}
              className="rounded border border-frido-border bg-transparent px-2 py-1 text-xs disabled:opacity-40 dark:border-white/10"
            >
              {[5, 10, 15, 30, 60].map((m) => (
                <option key={m} value={m}>
                  Every {m} min
                </option>
              ))}
            </select>
            <button
              onClick={handleSyncAll}
              disabled={isPending}
              className="flex items-center gap-1 rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
            >
              <RefreshCw size={13} className={isPending ? "animate-spin" : ""} />
              Sync All
            </button>
          </div>
        </div>
        {syncAllMessage && <p className="mt-2 text-xs text-neutral-500">{syncAllMessage}</p>}
      </div>

      {PER_MARKETPLACE_WORKBOOKS.map((workbookType) => (
        <div key={workbookType} className="glass-card rounded-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">{WORKBOOK_LABELS[workbookType]}</h2>
          <div className="mt-2">
            {marketplaces.map((m) => (
              <ConnectionRow
                key={m.id}
                workbookType={workbookType}
                marketplace={m}
                connection={connectionByKey.get(`${workbookType}:${m.id}`)}
                syncHistory={syncHistory}
                nextRunAt={autoSyncSettings.nextRunAt}
              />
            ))}
          </div>
        </div>
      ))}

      {SHARED_WORKBOOKS.map((workbookType) => (
        <div key={workbookType} className="glass-card rounded-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">{WORKBOOK_LABELS[workbookType]}</h2>
          <div className="mt-2">
            <ConnectionRow
              workbookType={workbookType}
              marketplace={null}
              connection={connectionByKey.get(`${workbookType}:shared`)}
              syncHistory={syncHistory}
              nextRunAt={autoSyncSettings.nextRunAt}
            />
          </div>
        </div>
      ))}

      <div className="glass-card rounded-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Sync Errors</h2>
        {failedJobs.length === 0 ? (
          <p className="mt-2 text-xs text-neutral-500">No failed syncs.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {failedJobs.slice(0, 10).map((j) => (
              <li key={j.id} className="flex items-start gap-1.5 text-xs">
                <XCircle size={13} className="mt-0.5 shrink-0 text-red-500" />
                <span>
                  <span className="font-medium">{j.jobType}</span>
                  {j.marketplaceName ? ` (${j.marketplaceName})` : ""} — {j.errorMessage ?? "unknown error"}
                  <span className="text-neutral-400"> · {fmtDate(j.startedAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass-card rounded-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Sync History</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="pb-1 pr-3 font-medium">Status</th>
                <th className="pb-1 pr-3 font-medium">Job</th>
                <th className="pb-1 pr-3 font-medium">Marketplace</th>
                <th className="pb-1 pr-3 font-medium">Inserted</th>
                <th className="pb-1 pr-3 font-medium">Updated</th>
                <th className="pb-1 pr-3 font-medium">Failed</th>
                <th className="pb-1 pr-3 font-medium">Duration</th>
                <th className="pb-1 font-medium">Started</th>
              </tr>
            </thead>
            <tbody>
              {syncHistory.map((j) => (
                <tr key={j.id} className="border-t border-frido-border dark:border-white/10">
                  <td className="py-1 pr-3">
                    <StatusIcon status={j.status} />
                  </td>
                  <td className="py-1 pr-3">{j.jobType}</td>
                  <td className="py-1 pr-3">{j.marketplaceName ?? "—"}</td>
                  <td className="py-1 pr-3 tabular-nums">{j.rowsInserted}</td>
                  <td className="py-1 pr-3 tabular-nums">{j.rowsUpdated}</td>
                  <td className="py-1 pr-3 tabular-nums">{j.rowsFailed}</td>
                  <td className="py-1 pr-3 tabular-nums">{fmtDuration(j.durationMs)}</td>
                  <td className="py-1 text-neutral-500">{fmtDate(j.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
