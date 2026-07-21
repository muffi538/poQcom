const LEVEL_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  Critical: { bg: "#d03b3b", fg: "#ffffff", label: "Critical" },
  High: { bg: "#ec835a", fg: "#1a1a19", label: "High" },
  Medium: { bg: "#fab219", fg: "#1a1a19", label: "Medium" },
  Low: { bg: "#0ca30c", fg: "#ffffff", label: "Low" },
  Unscored: { bg: "#898781", fg: "#ffffff", label: "Unscored" },
};

export function PriorityBadge({ level }: { level: string }) {
  const style = LEVEL_STYLE[level] ?? LEVEL_STYLE.Unscored;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {style.label}
    </span>
  );
}
