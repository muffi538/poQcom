"use client";

const inputClasses =
  "rounded-lg border border-frido-border bg-white px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-[var(--mp-accent)] dark:border-white/10 dark:bg-neutral-900";

// Shared "PO Date [from] to [to]" control — same ISO yyyy-mm-dd
// comparison every table filters on, so this is UI-only; each caller
// keeps its own from/to state and does the filtering itself.
export function PoDateRangeFilter({
  idPrefix,
  from,
  to,
  onFromChange,
  onToChange,
}: {
  idPrefix: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <label className="text-[11px] text-neutral-500" htmlFor={`${idPrefix}-po-date-from`}>
        PO Date
      </label>
      <input
        id={`${idPrefix}-po-date-from`}
        type="date"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
        className={`${inputClasses} w-[130px]`}
      />
      <span className="text-[11px] text-neutral-500">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onToChange(e.target.value)}
        className={`${inputClasses} w-[130px]`}
      />
      {(from || to) && (
        <button
          onClick={() => {
            onFromChange("");
            onToChange("");
          }}
          className="text-[11px] text-neutral-500 underline transition-colors hover:text-neutral-900 dark:hover:text-white"
        >
          Clear
        </button>
      )}
    </div>
  );
}
