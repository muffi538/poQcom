import { PurchaseOrder, isPendingStatus, isExpiredStatus } from "@/types/purchase-order";
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
  expiringTomorrow: number;
  expiredPending: number; // isOverdue: past its own expiry date, still not Delivered
  pendingQty: number;
  pendingValue: number;
  avgDispatchTimeDays: number | null;
  avgAppointmentDelayDays: number | null;
  avgOperationalDelayDaysLate: number | null; // average lateness among the currently-overdue only
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// `pos` is expected to already exclude terminal statuses and "Low Value
// Cant Dispatch" (the caller filters those out before calling — see
// classifyStatus). Priority scoring, pending qty/value, expiring-today,
// and Operational Delay only run over Status = "Pending" (confirmed:
// only Pending goes through the priority chain) — Expired POs get their
// own count/section instead of being scored alongside Pending ones.
//
// SLA % consumed was retired (confirmed misleading) — Operational Delay
// (today vs. expiry date, for non-Delivered POs) is the replacement.
export function buildExecutiveSummary(
  pos: PurchaseOrder[],
  rules: Rule[],
  config: EngineConfig,
  today: Date = new Date()
): ExecutiveSummary {
  const pendingPos = pos.filter((po) => isPendingStatus(po.status));

  const dispatchTimes: number[] = [];
  const appointmentDelays: number[] = [];
  const operationalDelaysLate: number[] = [];

  let critical = 0,
    high = 0,
    medium = 0,
    low = 0,
    unscored = 0,
    expiringToday = 0,
    expiringTomorrow = 0,
    expiredPending = 0,
    pendingQty = 0,
    pendingValue = 0;

  for (const po of pendingPos) {
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
    if (timeline.daysRemaining === 1) expiringTomorrow++;
    if (timeline.isOverdue) {
      expiredPending++;
      if (timeline.operationalDelayDays !== null) operationalDelaysLate.push(timeline.operationalDelayDays);
    }

    pendingQty += po.pendingQty;
    if (po.poValue !== null && po.orderedQty > 0) {
      pendingValue += (po.pendingQty / po.orderedQty) * po.poValue;
    }
  }

  // Dispatch time and appointment delay are historical/informational, so
  // they look across every visible PO (Pending, Expired, Needs Review),
  // not just the ones currently in the Pending scoring chain.
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

  const expired = pos.filter((po) => isExpiredStatus(po.status)).length;

  return {
    totalActive: pendingPos.length,
    critical,
    high,
    medium,
    low,
    unscored,
    expired,
    expiringToday,
    expiringTomorrow,
    expiredPending,
    pendingQty,
    pendingValue,
    avgDispatchTimeDays: average(dispatchTimes),
    avgAppointmentDelayDays: average(appointmentDelays),
    avgOperationalDelayDaysLate: average(operationalDelaysLate),
  };
}
