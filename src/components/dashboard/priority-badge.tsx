const LEVEL_STYLE: Record<string, { dot: string; classes: string; label: string }> = {
  Critical: {
    dot: "#d03b3b",
    classes: "bg-[#d03b3b]/10 text-[#9a2c2c] dark:bg-[#d03b3b]/15 dark:text-[#ff9d9d]",
    label: "Critical",
  },
  High: {
    dot: "#ec835a",
    classes: "bg-[#ec835a]/12 text-[#a1502e] dark:bg-[#ec835a]/18 dark:text-[#ffb08c]",
    label: "High",
  },
  Medium: {
    dot: "#fab219",
    classes: "bg-[#fab219]/15 text-[#8a5c00] dark:bg-[#fab219]/20 dark:text-[#ffd479]",
    label: "Medium",
  },
  Low: {
    dot: "#0ca30c",
    classes: "bg-[#0ca30c]/10 text-[#0b7a0b] dark:bg-[#0ca30c]/18 dark:text-[#6fdc6f]",
    label: "Low",
  },
  Unscored: {
    dot: "#898781",
    classes: "bg-neutral-400/10 text-neutral-600 dark:bg-neutral-400/15 dark:text-neutral-400",
    label: "Unscored",
  },
};

export function PriorityBadge({ level, compact }: { level: string; compact?: boolean }) {
  const style = LEVEL_STYLE[level] ?? LEVEL_STYLE.Unscored;
  if (compact) {
    return (
      <span
        className={`inline-flex max-w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${style.classes}`}
        title={style.label}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: style.dot }} />
        <span className="truncate">{style.label}</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold ${style.classes}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
      {style.label}
    </span>
  );
}
