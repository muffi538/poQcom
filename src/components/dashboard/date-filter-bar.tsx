"use client";

import { X, CalendarRange } from "lucide-react";
import { DateFilterState, DEFAULT_DATE_FILTER, formatDateFilterBadge } from "@/lib/dashboard/date-filter";

const inputClasses =
  "rounded-lg border border-frido-border bg-white px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-[var(--mp-accent)] dark:border-white/10 dark:bg-neutral-900";

// Plain native date inputs (an actual calendar picker on click) instead
// of a preset dropdown — From/To are always visible and editable, no
// "All Time"/"Last 7 Days"/etc. list to pick through first.
export function DateFilterBar({ filter, onChange }: { filter: DateFilterState; onChange: (next: DateFilterState) => void }) {
  const isDefault = !filter.from && !filter.to;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <CalendarRange size={12} className="text-neutral-400" />
      <input
        type="date"
        value={filter.from ?? ""}
        onChange={(e) => onChange({ ...filter, from: e.target.value || null })}
        className={inputClasses}
        title="From"
      />
      <span className="text-[11px] text-neutral-400">to</span>
      <input
        type="date"
        value={filter.to ?? ""}
        onChange={(e) => onChange({ ...filter, to: e.target.value || null })}
        className={inputClasses}
        title="To"
      />

      {!isDefault && (
        <>
          <span className="rounded bg-[var(--mp-primary)]/15 px-2 py-1 text-[11px] font-semibold text-[var(--mp-accent)]">
            {formatDateFilterBadge(filter)}
          </span>
          <button
            onClick={() => onChange(DEFAULT_DATE_FILTER)}
            className="flex items-center gap-1 rounded border border-frido-border px-2 py-1 text-[11px] text-neutral-500 transition-colors hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-neutral-900"
            title="Clear date filter"
          >
            <X size={11} />
            Clear Filter
          </button>
        </>
      )}
    </div>
  );
}
