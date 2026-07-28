import { PurchaseOrder, isPendingStatus } from "@/types/purchase-order";
import { Rule } from "@/types/rules";
import { EngineConfig } from "@/lib/config/engine-config";
import { computeTimeline } from "@/lib/po/derived";
import { computePoPriority } from "@/lib/rules/priority";
import { daysBetween } from "@/lib/po/dates";
import { DemandIndex } from "@/lib/demand/rank";

const EMPTY_DEMAND_INDEX: DemandIndex = new Map();

export interface ExecutiveSummary {
  totalActive: number;
  critical: number;
  high: number;
  expiringWithin10Days: number;
  expiredPending: number; // isOverdue: past its own expiry date, still not Delivered
  pendingQty: number;
  pendingValue: number;
  avgDispatchTimeDays: number | null;
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
  demandIndex: DemandIndex = EMPTY_DEMAND_INDEX,
  today: Date = new Date()
): ExecutiveSummary {
  const pendingPos = pos.filter((po) => isPendingStatus(po.status));

  const dispatchTimes: number[] = [];
  const operationalDelaysLate: number[] = [];

  let critical = 0,
    high = 0,
    expiringWithin10Days = 0,
    expiredPending = 0,
    pendingQty = 0,
    pendingValue = 0;

  for (const po of pendingPos) {
    const timeline = computeTimeline(po, config, today);
    const priority = computePoPriority(po, rules, config, demandIndex, today);

    switch (priority.level) {
      case "Critical":
        critical++;
        break;
      case "High":
        high++;
        break;
      default:
        break;
    }

    if (timeline.hasExpiryDate && timeline.daysRemaining >= 0 && timeline.daysRemaining < 10) expiringWithin10Days++;
    if (timeline.isOverdue) {
      expiredPending++;
      if (timeline.operationalDelayDays !== null) operationalDelaysLate.push(timeline.operationalDelayDays);
    }

    pendingQty += po.pendingQty;
    if (po.poValue !== null && po.orderedQty > 0) {
      pendingValue += (po.pendingQty / po.orderedQty) * po.poValue;
    }
  }

  // Dispatch time is historical/informational, so it looks across every
  // visible PO (Pending, Expired, Dispatched, Delivered, Needs Review) —
  // Dispatched/Delivered are the ones that actually carry a real Dispatch
  // Date, so including them here (instead of excluding them from the
  // dashboard entirely) is what gives this average real data to work with.
  for (const po of pos) {
    if (po.dispatchDate) {
      const dispatchTime = daysBetween(po.poRaisedDate, po.dispatchDate);
      if (Number.isFinite(dispatchTime)) dispatchTimes.push(dispatchTime);
    }
  }

  return {
    totalActive: pendingPos.length,
    critical,
    high,
    expiringWithin10Days,
    expiredPending,
    pendingQty,
    pendingValue,
    avgDispatchTimeDays: average(dispatchTimes),
    avgOperationalDelayDaysLate: average(operationalDelaysLate),
  };
}
