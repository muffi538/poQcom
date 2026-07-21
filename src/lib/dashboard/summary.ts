import { PurchaseOrder, isTerminalStatus } from "@/types/purchase-order";
import { Rule } from "@/types/rules";
import { EngineConfig } from "@/lib/config/store";
import { computeTimeline } from "@/lib/po/derived";
import { computePoPriority } from "@/lib/rules/priority";
import { daysBetween } from "@/lib/po/dates";

export interface ExecutiveSummary {
  totalActive: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  unscored: number;
  expired: number;
  expiringToday: number;
  pendingQty: number;
  pendingValue: number;
  avgDispatchTimeDays: number | null;
  avgAppointmentDelayDays: number | null;
  avgSlaConsumedPercent: number | null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function buildExecutiveSummary(
  pos: PurchaseOrder[],
  rules: Rule[],
  config: EngineConfig,
  today: Date = new Date()
): ExecutiveSummary {
  // Priority, pending-qty/value, and SLA%25 are about what's still
  // outstanding, so they're computed over active (non-terminal) POs only.
  // Avg Dispatch Time and Avg Appointment Delay look backward at whatever
  // POs actually have those dates, active or not, so they're computed
  // over the full set.
  const activePos = pos.filter((po) => !isTerminalStatus(po.status));

  const dispatchTimes: number[] = [];
  const appointmentDelays: number[] = [];
  const slaConsumed: number[] = [];

  let critical = 0,
    high = 0,
    medium = 0,
    low = 0,
    unscored = 0,
    expiringToday = 0,
    pendingQty = 0,
    pendingValue = 0;

  for (const po of activePos) {
    const timeline = computeTimeline(po, config, today);
    const priority = computePoPriority(po, rules, config, today);

    switch (priority.level) {
      case "Critical":
        critical++;
        break;
      case "High":
        high++;
        break;
      case "Medium":
        medium++;
        break;
      case "Low":
        low++;
        break;
      default:
        unscored++;
    }

    if (timeline.daysRemaining === 0) expiringToday++;

    pendingQty += po.pendingQty;
    if (po.poValue !== null && po.orderedQty > 0) {
      pendingValue += (po.pendingQty / po.orderedQty) * po.poValue;
    }

    slaConsumed.push(timeline.slaConsumedPercent);
  }

  for (const po of pos) {
    if (po.dispatchDate) {
      const dispatchTime = daysBetween(po.poRaisedDate, po.dispatchDate);
      if (Number.isFinite(dispatchTime)) dispatchTimes.push(dispatchTime);
    }
    if (po.appointmentDate) {
      const timeline = computeTimeline(po, config, today);
      if (timeline.appointmentDelayDays !== null) {
        appointmentDelays.push(timeline.appointmentDelayDays);
      }
    }
  }

  const expired = pos.filter((po) => po.status.trim().toLowerCase() === "expired").length;

  return {
    totalActive: activePos.length,
    critical,
    high,
    medium,
    low,
    unscored,
    expired,
    expiringToday,
    pendingQty,
    pendingValue,
    avgDispatchTimeDays: average(dispatchTimes),
    avgAppointmentDelayDays: average(appointmentDelays),
    avgSlaConsumedPercent: average(slaConsumed),
  };
}
