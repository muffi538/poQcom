import { DemandTier } from "@/lib/demand/sku-table";

const TIER_STYLE: Record<DemandTier, { dot: string; classes: string }> = {
  "Very High": { dot: "#1d4ed8", classes: "bg-blue-600/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  High: { dot: "#3b82f6", classes: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/12 dark:text-blue-300" },
  Medium: { dot: "#94a3b8", classes: "bg-neutral-400/10 text-neutral-600 dark:bg-neutral-400/15 dark:text-neutral-400" },
  Low: { dot: "#cbd5e1", classes: "bg-neutral-300/10 text-neutral-500 dark:bg-neutral-500/10 dark:text-neutral-500" },
};

export function DemandTierBadge({ tier }: { tier: DemandTier }) {
  const style = TIER_STYLE[tier];
  return (
    <span className={`inline-flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${style.classes}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: style.dot }} />
      {tier}
    </span>
  );
}
