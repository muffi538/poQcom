export function SlaBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const over = percent > 100;
  const color = over ? "#d03b3b" : percent >= 80 ? "#fab219" : "#0ca30c";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
      <span className="tabular-nums text-xs text-neutral-500">{percent.toFixed(0)}%</span>
    </div>
  );
}
