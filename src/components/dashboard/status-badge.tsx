export function StatusBadge({ status, compact }: { status: string; compact?: boolean }) {
  if (compact) {
    return (
      <span className="block truncate text-[11px] font-medium text-neutral-600 dark:text-neutral-300" title={status || "—"}>
        {status || "—"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
      {status || "—"}
    </span>
  );
}
