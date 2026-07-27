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

// Compact by design (confirmed: the donut shouldn't eat vertical space
// that could show more table rows) — a 2x2 stat grid sits beside it
// rather than a tall stacked legend, and the card is sized to its
// content (not a full-width bar) so it doesn't leave dead whitespace.
const SIZE = 48;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function PriorityDonutChart({
  counts,
  activeLevel,
  onSelectLevel,
}: {
  counts: Record<Level, number>;
  activeLevel: string;
  onSelectLevel: (level: Level) => void;
}) {
  const total = LEVELS.reduce((sum, l) => sum + counts[l], 0);

  if (total === 0) {
    return (
      <div className="glass-card flex w-fit items-center justify-center rounded-card px-3 py-1 text-xs text-neutral-500">
        No Pending POs match the current filters.
      </div>
    );
  }

  let cumulative = 0;
  const segments = LEVELS.map((level) => {
    const value = counts[level];
    const fraction = value / total;
    const dash = fraction * CIRCUMFERENCE;
    const offset = cumulative;
    cumulative += dash;
    return { level, value, fraction, dash, offset };
  });

  return (
    <div className="glass-card flex w-fit items-center gap-2 rounded-card px-2.5 py-1">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-neutral-100 dark:stroke-neutral-800" />
          {segments.map((s) =>
            s.value === 0 ? null : (
              <circle
                key={s.level}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={LEVEL_COLOR[s.level]}
                strokeWidth={STROKE}
                strokeDasharray={`${s.dash} ${CIRCUMFERENCE - s.dash}`}
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
          <span className="text-[11px] font-bold leading-none">{total}</span>
          <span className="mt-0.5 text-[6px] leading-none text-neutral-500">Pending</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-0">
        {segments.map((s) => (
          <button
            key={s.level}
            onClick={() => onSelectLevel(s.level)}
            className={`flex items-center gap-1 rounded px-1 py-0 text-left text-[10px] leading-tight transition-colors ${
              activeLevel === s.level ? "bg-neutral-100 dark:bg-neutral-800" : "hover:bg-neutral-50 dark:hover:bg-neutral-900"
            }`}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: LEVEL_COLOR[s.level] }} />
            <span className="font-medium">{s.level}</span>
            <span className="tabular-nums text-neutral-500">{s.value}</span>
            <span className="tabular-nums text-neutral-400">({Math.round(s.fraction * 100)}%)</span>
          </button>
        ))}
      </div>
    </div>
  );
}
