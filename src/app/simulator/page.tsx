import { AwaitingConfig } from "@/components/dashboard/awaiting-config";

export default function SimulatorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Rule Simulator</h1>
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
  );
}
