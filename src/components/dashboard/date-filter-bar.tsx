"use client";

import { X, CalendarRange } from "lucide-react";
import {
  DateFilterState,
  DateFilterPreset,
  DateFilterField,
  DATE_FILTER_PRESET_LABELS,
  DATE_FILTER_FIELD_LABELS,
  DEFAULT_DATE_FILTER,
  formatDateFilterBadge,
} from "@/lib/dashboard/date-filter";

const inputClasses =
  "rounded-lg border border-frido-border bg-white px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-[var(--mp-accent)] dark:border-white/10 dark:bg-neutral-900";

const PRESET_ORDER: DateFilterPreset[] = [
  "all_time",
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
  "this_quarter",
  "this_year",
  "custom",
];

const FIELD_ORDER: DateFilterField[] = ["po_date", "dispatch_date"];

// Sits in the same toolbar row as City/Priority/Expiry (confirmed
// placement) — one preset dropdown, a small field-type dropdown beside
// it, custom From/To pickers that only appear for Custom Range, a badge
// showing the active filter, and a Clear Filter button. Everything here
// is controlled from the parent (Overview/marketplace client wrapper) so
// the same filter state can also drive KPIs/charts/secondary tables, not
// just this table.
export function DateFilterBar({ filter, onChange }: { filter: DateFilterState; onChange: (next: DateFilterState) => void }) {
  const isDefault = filter.preset === "all_time";

  function handlePresetChange(preset: DateFilterPreset) {
    if (preset === "custom") {
      onChange({ ...filter, preset, customFrom: filter.customFrom ?? new Date().toISOString().slice(0, 10), customTo: filter.customTo ?? new Date().toISOString().slice(0, 10) });
    } else {
      onChange({ ...filter, preset });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="relative">
        <CalendarRange size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
        <select
          value={filter.preset}
          onChange={(e) => handlePresetChange(e.target.value as DateFilterPreset)}
          className={`${inputClasses} pl-6`}
        >
          {PRESET_ORDER.map((preset) => (
            <option key={preset} value={preset}>
              {DATE_FILTER_PRESET_LABELS[preset]}
            </option>
          ))}
        </select>
      </div>

      <select
        value={filter.field}
        onChange={(e) => onChange({ ...filter, field: e.target.value as DateFilterField })}
        className={inputClasses}
        title="Which date field to filter by"
      >
        {FIELD_ORDER.map((field) => (
          <option key={field} value={field}>
            {DATE_FILTER_FIELD_LABELS[field]}
          </option>
        ))}
      </select>

      {filter.preset === "custom" && (
        <>
          <input
            type="date"
            value={filter.customFrom ?? ""}
            onChange={(e) => onChange({ ...filter, customFrom: e.target.value || null })}
            className={inputClasses}
          />
          <span className="text-[11px] text-neutral-400">to</span>
          <input
            type="date"
            value={filter.customTo ?? ""}
            onChange={(e) => onChange({ ...filter, customTo: e.target.value || null })}
            className={inputClasses}
          />
        </>
      )}

      {!isDefault && (
        <>
          <span className="rounded bg-[var(--mp-primary)]/15 px-2 py-1 text-[11px] font-semibold text-[var(--mp-accent)]">
            {formatDateFilterBadge(filter)}
          </span>
          <button
            onClick={() => onChange(DEFAULT_DATE_FILTER)}
            className="flex items-center gap-1 rounded border border-frido-border px-2 py-1 text-[11px] text-neutral-500 transition-colors hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-neutral-900"
            title="Clear date filter — return to All Time"
          >
            <X size={11} />
            Clear Filter
          </button>
        </>
      )}
    </div>
  );
}
