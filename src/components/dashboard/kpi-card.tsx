import type { LucideIcon } from "lucide-react";

const TONE_STYLE: Record<string, { bg: string; fg: string }> = {
  default: { bg: "bg-neutral-100 dark:bg-neutral-800", fg: "text-neutral-600 dark:text-neutral-300" },
  critical: { bg: "bg-[#d03b3b]/10", fg: "text-[#d03b3b]" },
  high: { bg: "bg-[#ec835a]/10", fg: "text-[#ec835a]" },
  medium: { bg: "bg-[#fab219]/15", fg: "text-[#a86a00]" },
  low: { bg: "bg-[#0ca30c]/10", fg: "text-[#0ca30c]" },
  accent: { bg: "bg-[var(--mp-primary)]/15", fg: "text-[var(--mp-accent)]" },
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: "default" | "critical" | "high" | "medium" | "low" | "accent";
}) {
  const style = TONE_STYLE[tone] ?? TONE_STYLE.default;
  return (
    <div className="glass-card card-elevate rounded-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
        {Icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.bg} ${style.fg}`}>
            <Icon size={16} strokeWidth={2.25} />
          </span>
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
