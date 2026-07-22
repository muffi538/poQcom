"use client";

import { useState } from "react";
import { TopSkuTableResult } from "@/lib/demand/sku-table";
import { DemandIntelligence } from "./demand-intelligence";
import { themeFor } from "@/lib/theme/marketplace-colors";

// Overview pools all three marketplaces, but Demand Intelligence ranking
// is inherently per-marketplace (confirmed: never compare Zepto POs
// against Blinkit sales) — so this is a tab switcher over one
// DemandIntelligence panel at a time, not three stacked copies.
export function DemandIntelligenceTabs({
  marketplaces,
  data,
}: {
  marketplaces: string[];
  data: Record<string, TopSkuTableResult>;
}) {
  const [active, setActive] = useState(marketplaces[0]);
  const theme = themeFor(active);
  const activeData = data[active];

  return (
    <div className="space-y-2" style={{ "--mp-primary": theme.primary, "--mp-accent": theme.accent } as React.CSSProperties}>
      <div className="flex flex-wrap gap-1.5">
        {marketplaces.map((m) => {
          const mTheme = themeFor(m);
          return (
            <button
              key={m}
              onClick={() => setActive(m)}
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                active === m
                  ? "border-transparent text-white"
                  : "border-frido-border text-neutral-500 hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-neutral-900"
              }`}
              style={active === m ? { backgroundColor: mTheme.primary } : undefined}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: active === m ? "#fff" : mTheme.primary }} />
              {m}
            </button>
          );
        })}
      </div>
      {activeData && <DemandIntelligence marketplace={active} data={activeData} />}
    </div>
  );
}
