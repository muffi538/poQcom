"use client";

// Same hand-rolled SVG approach as charts/bar-chart.tsx (no chart
// library) — a ring built from stroke-dasharray arcs, one per priority
// level, using the exact same colors as PriorityBadge so this reads as
// the same taxonomy everywhere it appears.
const LEVELS = ["Critical", "High", "Medium", "Low"] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_COLOR: Record<Level, string> = {
  Critical: "#d03b3b",
  High: "#ec835a",
  Medium: "#fab219",
  Low: "#0ca30c",
};

// "compact" sits inline in a toolbar/table header (confirmed: shouldn't
// eat vertical space that could show more table rows) — used on
// marketplace pages. "large" sits beside the KPI grid on Overview, where
// it has a full 2-row-tall KPI block's worth of height to fill, so it
// needs to look like a real executive-dashboard chart, not an
// afterthought squeezed beside big numbers.
const VARIANTS = {
  compact: {
    size: 48,
    stroke: 8,
    wrapper: "w-fit gap-2 px-2.5 py-1",
    legendCols: "grid-cols-2",
    gridGap: "gap-x-2 gap-y-0",
    legendItem: "gap-1 px-1 py-0 text-[10px]",
    legendDot: "h-1.5 w-1.5",
    centerTotal: "text-[11px]",
    centerLabel: "mt-0.5 text-[6px]",
  },
  // Sits beside CityDonutChart, each taking half the page width — a 2x2
  // legend (vs. compact's cramped 2x2) uses that width instead of
  // stretching one column thin, and h-full + centered content means it
  // matches CityDonutChart's height exactly regardless of legend row
  // count differences between the two charts.
  large: {
    size: 116,
    stroke: 17,
    wrapper: "h-full w-full justify-center gap-6 px-8 py-6",
    legendCols: "grid-cols-2",
    gridGap: "gap-x-6 gap-y-2",
    legendItem: "w-full gap-2 whitespace-nowrap px-1.5 py-1 text-sm",
    legendDot: "h-2.5 w-2.5",
    centerTotal: "text-2xl",
    centerLabel: "mt-1 text-[11px]",
  },
  // The single donut beside a marketplace page's 2-row KPI grid — bigger
  // than "large" (which shares its width with a second donut on
  // Overview) since here it's the sole thing filling that whole column.
  xlarge: {
    size: 148,
    stroke: 21,
    wrapper: "h-full w-full justify-center gap-8 px-8 py-6",
    legendCols: "grid-cols-1",
    gridGap: "gap-y-3",
    legendItem: "w-full gap-2.5 whitespace-nowrap px-2 py-1.5 text-base",
    legendDot: "h-3.5 w-3.5",
    centerTotal: "text-4xl",
    centerLabel: "mt-1.5 text-sm",
  },
} as const;

export function PriorityDonutChart({
  counts,
  activeLevel,
  onSelectLevel,
  variant = "compact",
}: {
  counts: Record<Level, number>;
  activeLevel: string;
  onSelectLevel: (level: Level) => void;
  variant?: "compact" | "large" | "xlarge";
}) {
  const v = VARIANTS[variant];
  const radius = (v.size - v.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = LEVELS.reduce((sum, l) => sum + counts[l], 0);
  const stretches = variant === "large" || variant === "xlarge";

  if (total === 0) {
    return (
      <div className={`glass-card flex items-center justify-center rounded-card px-3 text-xs text-neutral-500 ${stretches ? "h-full w-full py-4" : "w-fit py-1"}`}>
        No Pending POs match the current filters.
      </div>
    );
  }

  let cumulative = 0;
  const segments = LEVELS.map((level) => {
    const value = counts[level];
    const fraction = value / total;
    const dash = fraction * circumference;
    const offset = cumulative;
    cumulative += dash;
    return { level, value, fraction, dash, offset };
  });

  return (
    <div className={`glass-card flex items-center rounded-card ${v.wrapper}`}>
      <div className="relative shrink-0" style={{ width: v.size, height: v.size }}>
        <svg width={v.size} height={v.size} viewBox={`0 0 ${v.size} ${v.size}`} className="-rotate-90">
          <circle cx={v.size / 2} cy={v.size / 2} r={radius} fill="none" strokeWidth={v.stroke} className="stroke-neutral-100 dark:stroke-neutral-800" />
          {segments.map((s) =>
            s.value === 0 ? null : (
              <circle
                key={s.level}
                cx={v.size / 2}
                cy={v.size / 2}
                r={radius}
                fill="none"
                stroke={LEVEL_COLOR[s.level]}
                strokeWidth={v.stroke}
                strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                strokeDashoffset={-s.offset}
                strokeLinecap="butt"
                className="cursor-pointer transition-opacity"
                opacity={activeLevel === "all" || activeLevel === s.level ? 1 : 0.25}
                onClick={() => onSelectLevel(s.level)}
              >
                <title>{`${s.level}: ${s.value} (${Math.round(s.fraction * 100)}%)`}</title>
              </circle>
            )
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold leading-none ${v.centerTotal}`}>{total}</span>
          <span className={`leading-none text-neutral-500 ${v.centerLabel}`}>Pending</span>
        </div>
      </div>

      <div className={`grid ${v.legendCols} ${v.gridGap}`}>
        {segments.map((s) => (
          <button
            key={s.level}
            onClick={() => onSelectLevel(s.level)}
            className={`flex items-center rounded text-left leading-tight transition-colors ${v.legendItem} ${
              activeLevel === s.level ? "bg-neutral-100 dark:bg-neutral-800" : "hover:bg-neutral-50 dark:hover:bg-neutral-900"
            }`}
          >
            <span className={`shrink-0 rounded-full ${v.legendDot}`} style={{ backgroundColor: LEVEL_COLOR[s.level] }} />
            <span className="font-medium">{s.level}</span>
            <span className="tabular-nums text-neutral-500">{s.value}</span>
            <span className="tabular-nums text-neutral-400">({Math.round(s.fraction * 100)}%)</span>
          </button>
        ))}
      </div>
    </div>
  );
}
