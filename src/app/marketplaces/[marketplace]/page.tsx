import { notFound } from "next/navigation";
import { MARKETPLACES } from "@/types/marketplace";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AwaitingConfig } from "@/components/dashboard/awaiting-config";

export function generateStaticParams() {
  return MARKETPLACES.map((m) => ({ marketplace: m.toLowerCase() }));
}

const kpiLabels = ["Pending Orders", "Pending Qty", "Avg Delay", "Avg Appointment Time", "SLA %", "Risk"];

export default async function MarketplacePage({
  params,
}: {
  params: Promise<{ marketplace: string }>;
}) {
  const { marketplace: marketplaceParam } = await params;
  const marketplace = MARKETPLACES.find(
    (m) => m.toLowerCase() === marketplaceParam.toLowerCase()
  );
  if (!marketplace) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{marketplace}</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpiLabels.map((label) => (
          <KpiCard key={label} label={label} value="—" />
        ))}
      </div>

      <AwaitingConfig
        title={`${marketplace} PO table`}
        items={[
          `Sheet range for ${marketplace} configured in .env or Settings`,
          "Column mapping confirmed",
          "Priority rules scoped to this marketplace (or \"all\") published",
        ]}
      />
    </div>
  );
}
