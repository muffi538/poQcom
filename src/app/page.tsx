import { KpiCard } from "@/components/dashboard/kpi-card";
import { AwaitingConfig } from "@/components/dashboard/awaiting-config";

const kpiLabels = [
  "Total Active PO",
  "Critical",
  "High",
  "Medium",
  "Low",
  "Expired",
  "Expiring Today",
  "Pending Qty",
  "Pending Value",
  "Avg Dispatch Time",
  "Avg Appointment Delay",
  "Avg SLA Consumption",
];

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Overview — All Marketplaces</h1>
        <p className="text-sm text-neutral-500">
          Executive summary across Zepto, Blinkit, Instamart, and BigBasket.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kpiLabels.map((label) => (
          <KpiCard key={label} label={label} value="—" />
        ))}
      </div>

      <AwaitingConfig
        title="Executive Summary"
        items={[
          "Google Sheet connected (see Settings)",
          "Column mapping confirmed for PO Raised / Expiry / Appointment / Dispatch dates",
          "At least one Priority Rule published in the Rules Builder",
        ]}
      />

      <AwaitingConfig
        title="Operations Control Tower"
        items={[
          "Dispatch-in-next-2-hours, Safe-to-postpone, SLA-risk, and bottleneck questions all read from the Priority Engine output — once rules exist, this section answers them automatically.",
        ]}
      />
    </div>
  );
}
