"use client";

import { PoRow } from "@/lib/dashboard/po-rows";
import {
  expiryTimeline,
  poValueByMarketplace,
  pendingQtyByCity,
  operationalDelayByMarketplace,
} from "@/lib/dashboard/charts-data";
import { BarChart } from "./charts/bar-chart";
import { MARKETPLACE_THEMES, FRIDO_THEME } from "@/lib/theme/marketplace-colors";

// Same brand identity color per marketplace as everywhere else (sidebar
// dots, marketplace badges) — one hue per marketplace, consistent across
// every chart that breaks a number down "by marketplace".
const MARKETPLACE_COLORS: Record<string, { light: string; dark: string }> = Object.fromEntries(
  Object.entries(MARKETPLACE_THEMES).map(([name, theme]) => [name, { light: theme.primary, dark: theme.primary }])
);

// `accentHex` lets a single-marketplace page recolor the plain-magnitude
// charts (Expiry Timeline, Pending Qty by City) to that marketplace's
// brand color instead of the Frido-yellow default used on Overview.
export function PoCharts({ rows, accentHex }: { rows: PoRow[]; accentHex?: string }) {
  const singleHue = { light: accentHex ?? FRIDO_THEME.primary, dark: accentHex ?? FRIDO_THEME.primary };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <BarChart title="Expiry Timeline" data={expiryTimeline(rows)} defaultColor={singleHue} />
      <BarChart
        title="PO Value by Marketplace"
        data={poValueByMarketplace(rows)}
        colorMap={MARKETPLACE_COLORS}
        valueFormatter={(n) => `₹${Math.round(n).toLocaleString("en-IN")}`}
      />
      <BarChart title="Pending Qty by City (top 10)" data={pendingQtyByCity(rows)} defaultColor={singleHue} />
      <BarChart
        title="Avg Days Late by Marketplace (overdue POs only)"
        data={operationalDelayByMarketplace(rows)}
        colorMap={MARKETPLACE_COLORS}
        valueFormatter={(n) => `${n}d`}
      />
    </div>
  );
}
