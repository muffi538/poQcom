"use client";

export interface StatusTabDef {
  key: string;
  label: string;
  count: number;
}

// Sticky navigation replacing the old "scroll down to a collapsed
// section" pattern — every status bucket (Pending, Critical, Delivered,
// Dispatched, Cancelled, Expired, Needs Review) is one click away, with
// a live count so the tab itself answers "how many" before it's even
// selected. Sticks below the page header while scrolling (confirmed
// requirement) via `sticky top-0` — the nearest scrolling ancestor is
// the page/window itself, since neither `main` nor this component's
// own container declares its own overflow.
export function StatusTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: StatusTabDef[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="sticky top-0 z-30 border-b border-frido-border bg-white py-1.5 dark:border-white/10 dark:bg-neutral-950">
      <div className="flex flex-wrap items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            aria-pressed={active === tab.key}
            className={`rounded px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
              active === tab.key
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            {tab.label} <span className="tabular-nums opacity-70">({tab.count})</span>
          </button>
        ))}
      </div>
    </div>
  );
}
