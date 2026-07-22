"use client";

import { useEffect, useId, useState } from "react";

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
  const uid = useId().replace(/[:]/g, "");
  const [hovered, setHovered] = useState<number | null>(null);
  const [grown, setGrown] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.value));
  const rowHeight = 30;
  const chartHeight = data.length * rowHeight + 8;
  const fmt = valueFormatter ?? ((n: number) => n.toLocaleString("en-IN"));

  useEffect(() => {
    const t = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  if (data.length === 0) {
    return (
      <div className="glass-card rounded-card p-3">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        <p className="mt-4 text-sm text-neutral-500">No data.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-card p-3">
      <h3 className="text-[13px] font-semibold">{title}</h3>
      <svg
        viewBox={`0 0 400 ${chartHeight}`}
        className="mt-3 w-full"
        style={{ height: chartHeight }}
        role="img"
        aria-label={title}
      >
        <defs>
          {data.map((d, i) => {
            const color = colorMap?.[d.label] ?? defaultColor;
            return (
              <linearGradient key={d.label} id={`${uid}-grad-${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={color.light} stopOpacity={0.55} />
                <stop offset="100%" stopColor={color.light} stopOpacity={1} />
              </linearGradient>
            );
          })}
        </defs>
        {data.map((d, i) => {
          const y = i * rowHeight;
          const barMaxWidth = 250;
          const barWidth = Math.max(2, (d.value / max) * barMaxWidth);
          const color = colorMap?.[d.label] ?? defaultColor;
          const isHovered = hovered === i;
          return (
            <g key={d.label} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <rect x={110} y={y + 6} width={barMaxWidth} height={16} rx={4} className="fill-neutral-100 dark:fill-neutral-800/60" />
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
                width={grown ? barWidth : 0}
                height={16}
                rx={4}
                className="dark:hidden transition-[width] duration-700 ease-out"
                fill={`url(#${uid}-grad-${i})`}
                opacity={isHovered ? 1 : 0.92}
              />
              <rect
                x={110}
                y={y + 6}
                width={grown ? barWidth : 0}
                height={16}
                rx={4}
                className="hidden dark:block transition-[width] duration-700 ease-out"
                fill={color.dark}
                opacity={isHovered ? 1 : 0.92}
              />
              <text
                x={110 + barWidth + 6}
                y={y + rowHeight / 2 + 4}
                className={`text-[11px] font-medium transition-opacity dark:fill-neutral-200 fill-neutral-800 ${
                  grown ? "opacity-100" : "opacity-0"
                }`}
              >
                {fmt(d.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
