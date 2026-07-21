import { themeFor } from "@/lib/theme/marketplace-colors";

export function MarketplaceBadge({ marketplace }: { marketplace: string }) {
  const theme = themeFor(marketplace);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-black/[0.03] px-2.5 py-1 text-xs font-medium dark:border-white/10 dark:bg-white/5"
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: theme.primary }} />
      {marketplace}
    </span>
  );
}
