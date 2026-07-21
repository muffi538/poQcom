import { AwaitingConfig } from "@/components/dashboard/awaiting-config";
import { MarketplaceThemeScope } from "@/components/theme/marketplace-theme-scope";

export default function SimulatorPage() {
  return (
    <MarketplaceThemeScope marketplace={null}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rule Simulator</h1>
          <p className="text-sm text-neutral-500">
            Build a hypothetical PO, run it through the current rule set, and see exactly which
            rules fired, which were skipped, and why.
          </p>
        </div>
        <AwaitingConfig
          title="Simulator"
          items={[
            "At least one rule published in the Rules Builder",
            "Field catalog confirmed, so the hypothetical-PO form knows which fields to offer",
          ]}
        />
      </div>
    </MarketplaceThemeScope>
  );
}
