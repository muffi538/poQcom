"use client";

import { PoRow } from "@/lib/dashboard/po-rows";
import {
  expiryTimeline,
  poValueByMarketplace,
  pendingQtyByCity,
  operationalDelayByMarketplace,
} from "@/lib/dashboard/charts-data";
import { BarChart } from "./charts/bar-chart";

// Fixed hue per marketplace (categorical slots 1/2/3 from the palette),
// same mapping wherever a marketplace-colored chart appears so identity
// stays consistent across the dashboard.
const MARKETPLACE_COLORS: Record<string, { light: string; dark: string }> = {
  Zepto: { light: "#2a78d6", dark: "#3987e5" }, // slot 1 blue
  Blinkit: { light: "#eb6834", dark: "#d95926" }, // slot 2 orange
  Instamart: { light: "#1baf7a", dark: "#199e70" }, // slot 3 aqua
};

export function PoCharts({ rows }: { rows: PoRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <BarChart title="Expiry Timeline" data={expiryTimeline(rows)} />
      <BarChart
        title="PO Value by Marketplace"
        data={poValueByMarketplace(rows)}
        colorMap={MARKETPLACE_COLORS}
        valueFormatter={(n) => `₹${Math.round(n).toLocaleString("en-IN")}`}
      />
      <BarChart title="Pending Qty by City (top 10)" data={pendingQtyByCity(rows)} />
      <BarChart
        title="Avg Operational Delay by Marketplace (days)"
        data={operationalDelayByMarketplace(rows)}
        colorMap={MARKETPLACE_COLORS}
        valueFormatter={(n) => `${n}d`}
      />
    </div>
  );
}
