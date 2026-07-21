// Operational Delay = today − expiry date, for any non-Delivered PO with
// a real expiry date (confirmed, replaces SLA % consumed entirely).
// Positive = late, 0 = due today, negative = days remaining, null =
// unknown (Delivered PO or blank/unparseable expiry date).
export function formatOperationalDelay(days: number | null): string {
  if (days === null) return "Unknown";
  if (days > 0) return `${days} Day${days === 1 ? "" : "s"} Late`;
  if (days === 0) return "Due Today";
  return `${-days} Day${-days === 1 ? "" : "s"} Remaining`;
}

export function operationalDelayColor(days: number | null): string {
  if (days === null) return "#898781";
  if (days > 0) return "#d03b3b";
  if (days <= 2) return "#fab219";
  return "#0ca30c";
}

export function OperationalDelayBadge({ days }: { days: number | null }) {
  const color = operationalDelayColor(days);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {formatOperationalDelay(days)}
    </span>
  );
}
