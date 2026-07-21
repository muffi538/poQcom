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
    <div className="glass-card w-[118px] shrink-0 rounded-lg px-2 py-1.5 shadow-sm">
      <div className="flex items-center justify-between gap-1">
        <div className="truncate text-[10px] font-medium text-neutral-500" title={label}>
          {label}
        </div>
        {Icon && (
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${style.bg} ${style.fg}`}>
            <Icon size={12} strokeWidth={2.25} />
          </span>
        )}
      </div>
      <div className="mt-0.5 text-lg font-semibold leading-tight tabular-nums">{value}</div>
    </div>
  );
}
