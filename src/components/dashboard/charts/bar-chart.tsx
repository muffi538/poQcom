"use client";

import { useId, useState } from "react";

// A single horizontal bar chart, reused for every "magnitude by category"
// chart in the control tower (PO Value by Marketplace, Pending Qty by
// City, Operational Delay by Marketplace, Expiry Timeline). One series,
// one axis — per the dataviz method, magnitude gets a single hue unless
// category identity itself needs color (colorMap), in which case each
// category keeps the same hue everywhere it appears.
export interface BarDatum {
  label: string;
  value: number;
}

interface Props {
  title: string;
  data: BarDatum[];
  colorMap?: Record<string, { light: string; dark: string }>;
  defaultColor?: { light: string; dark: string };
  valueFormatter?: (n: number) => string;
}

const DEFAULT_HUE = { light: "#2a78d6", dark: "#3987e5" };

export function BarChart({ title, data, colorMap, defaultColor = DEFAULT_HUE, valueFormatter }: Props) {
  const uid = useId();
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const rowHeight = 28;
  const chartHeight = data.length * rowHeight + 8;
  const fmt = valueFormatter ?? ((n: number) => n.toLocaleString("en-IN"));

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-4 text-sm text-neutral-500">No data.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="text-sm font-semibold">{title}</h3>
      <svg
        viewBox={`0 0 400 ${chartHeight}`}
        className="mt-3 w-full"
        style={{ height: chartHeight }}
        role="img"
        aria-label={title}
      >
        {data.map((d, i) => {
          const y = i * rowHeight;
          const barMaxWidth = 260;
          const barWidth = Math.max(2, (d.value / max) * barMaxWidth);
          const color = colorMap?.[d.label] ?? defaultColor;
          const isHovered = hovered === i;
          return (
            <g key={d.label} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <text
                x={0}
                y={y + rowHeight / 2 + 4}
                className="fill-neutral-600 text-[11px] dark:fill-neutral-400"
              >
                {d.label.length > 16 ? `${d.label.slice(0, 15)}…` : d.label}
              </text>
              <rect
                x={110}
                y={y + 6}
                width={barWidth}
                height={16}
                rx={4}
                className="dark:hidden"
                fill={color.light}
                opacity={isHovered ? 1 : 0.85}
              />
              <rect
                x={110}
                y={y + 6}
                width={barWidth}
                height={16}
                rx={4}
                className="hidden dark:block"
                fill={color.dark}
                opacity={isHovered ? 1 : 0.85}
              />
              <text
                x={110 + barWidth + 6}
                y={y + rowHeight / 2 + 4}
                className="fill-neutral-800 text-[11px] font-medium dark:fill-neutral-200"
              >
                {fmt(d.value)}
              </text>
            </g>
          );
        })}
      </svg>
      <span className="sr-only">{`Chart id ${uid}`}</span>
    </div>
  );
}
