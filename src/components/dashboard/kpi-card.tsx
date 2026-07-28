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
  sub,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "critical" | "high" | "medium" | "low" | "accent";
  // Optional second line under the value (e.g. a PO count under a city
  // name) — omitted by every KPI that's a single number, so this adds no
  // visual weight to cards that don't pass it.
  sub?: string;
}) {
  const accent = TONE_ACCENT[tone] ?? TONE_ACCENT.default;
  return (
    <div
      className="glass-card flex h-full flex-col justify-center rounded-lg px-4 py-4"
      style={accent !== "transparent" ? { borderLeft: `5px solid ${accent}` } : undefined}
    >
      <div className="truncate text-[11px] font-semibold uppercase tracking-wide text-neutral-500" title={label}>
        {label}
      </div>
      <div
        // pb-1 gives descenders (g, y, p, q, j) room below the line box —
        // without it, `truncate`'s overflow-hidden clips them off at this
        // font-size/weight (confirmed: "Gurgaon" lost the bottom of its
        // "g"). leading-none stays, so this doesn't loosen the tight
        // number-stack look, just stops the clipping.
        className="mt-1 truncate pb-1 text-[34px] font-extrabold leading-none tabular-nums text-neutral-900 dark:text-neutral-50"
        title={String(value)}
      >
        {value}
      </div>
      {sub && <div className="mt-1 truncate text-xs font-medium text-neutral-500">{sub}</div>}
    </div>
  );
}
