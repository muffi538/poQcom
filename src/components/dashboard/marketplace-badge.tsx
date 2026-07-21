import { themeFor } from "@/lib/theme/marketplace-colors";

export function MarketplaceBadge({ marketplace, compact }: { marketplace: string; compact?: boolean }) {
  const theme = themeFor(marketplace);
  if (compact) {
    return (
      <span className="inline-flex max-w-full items-center gap-1 truncate text-[11px] font-medium" title={marketplace}>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: theme.primary }} />
        <span className="truncate">{marketplace}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-black/[0.03] px-2.5 py-1 text-xs font-medium dark:border-white/10 dark:bg-white/5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: theme.primary }} />
      {marketplace}
    </span>
  );
}
