// A KPI tile shows exactly one number: a big bold value, a small muted
// label, nothing else (confirmed design brief — no icon, no fabricated
// trend without real historical data to back it). Tone renders as a thin
// left-border accent instead of an icon badge, so criticality is still
// visible at a glance without adding visual weight.
const TONE_ACCENT: Record<string, string> = {
  default: "transparent",
  critical: "#d03b3b",
  high: "#ec835a",
  medium: "#fab219",
  low: "#0ca30c",
  accent: "var(--mp-primary)",
};

export function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "critical" | "high" | "medium" | "low" | "accent";
}) {
  const accent = TONE_ACCENT[tone] ?? TONE_ACCENT.default;
  return (
    <div
      className="glass-card min-w-[150px] flex-1 shrink-0 rounded-md px-3.5 py-3"
      style={accent !== "transparent" ? { borderLeft: `4px solid ${accent}` } : undefined}
    >
      <div className="truncate text-[11px] font-semibold uppercase tracking-wide text-neutral-500" title={label}>
        {label}
      </div>
      <div
        className="mt-1 truncate text-[36px] font-extrabold leading-none tabular-nums text-neutral-900 dark:text-neutral-50"
        title={String(value)}
      >
        {value}
      </div>
    </div>
  );
}
