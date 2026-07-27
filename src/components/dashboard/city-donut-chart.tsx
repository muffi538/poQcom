"use client";

import { CitySlice } from "@/lib/dashboard/po-control-filters";

// Same hand-rolled SVG technique as PriorityDonutChart (no chart
// library), sized/styled to match its "large" variant so the two donuts
// read as one consistent pair beside the KPI grid on Overview.
const PALETTE = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
const OTHER_COLOR = "#9ca3af";

const SIZE = 116;
const STROKE = 17;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CityDonutChart({
  slices,
  activeCity,
  onSelectCity,
}: {
  slices: CitySlice[];
  activeCity: string;
  onSelectCity: (city: string) => void;
}) {
  const total = slices.reduce((sum, s) => sum + s.count, 0);

  if (total === 0) {
    return (
      <div className="glass-card flex h-full w-full items-center justify-center rounded-card px-3 py-4 text-xs text-neutral-500">
        No Pending POs match the current filters.
      </div>
    );
  }

  let cumulative = 0;
  const segments = slices.map((s, i) => {
    const fraction = s.count / total;
    const dash = fraction * CIRCUMFERENCE;
    const offset = cumulative;
    cumulative += dash;
    return { ...s, fraction, dash, offset, color: s.city === "Other" ? OTHER_COLOR : PALETTE[i % PALETTE.length] };
  });

  return (
    <div className="glass-card flex h-full w-full items-center justify-center gap-6 rounded-card px-8 py-6">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-neutral-100 dark:stroke-neutral-800" />
          {segments.map((s) =>
            s.count === 0 ? null : (
              <circle
                key={s.city}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={s.color}
                strokeWidth={STROKE}
                strokeDasharray={`${s.dash} ${CIRCUMFERENCE - s.dash}`}
                strokeDashoffset={-s.offset}
                strokeLinecap="butt"
                className={s.city === "Other" ? "" : "cursor-pointer transition-opacity"}
                opacity={activeCity === "all" || activeCity === s.city ? 1 : 0.25}
                onClick={() => s.city !== "Other" && onSelectCity(s.city)}
              >
                <title>{`${s.city}: ${s.count} (${Math.round(s.fraction * 100)}%)`}</title>
              </circle>
            )
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold leading-none">{total}</span>
          <span className="mt-1 text-[11px] leading-none text-neutral-500">Pending</span>
        </div>
      </div>

      <div className="grid min-w-0 max-w-[280px] flex-1 grid-cols-2 gap-x-4 gap-y-2">
        {segments.map((s) => (
          <button
            key={s.city}
            onClick={() => s.city !== "Other" && onSelectCity(s.city)}
            disabled={s.city === "Other"}
            title={`${s.city}: ${s.count} (${Math.round(s.fraction * 100)}%)`}
            className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm transition-colors ${
              activeCity === s.city
                ? "bg-neutral-100 dark:bg-neutral-800"
                : s.city === "Other"
                  ? ""
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-900"
            }`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="min-w-0 flex-1 truncate font-medium">{s.city}</span>
            <span className="shrink-0 tabular-nums text-neutral-500">{s.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
