import { PurchaseOrder, DemandSkuHit, isPendingStatus } from "@/types/purchase-order";
import { Rule } from "@/types/rules";
import { EngineConfig, levelForScore } from "@/lib/config/engine-config";
import { computeTimeline } from "@/lib/po/derived";
import { computePoPriority } from "@/lib/rules/priority";
import { DemandIndex } from "@/lib/demand/rank";

const EMPTY_DEMAND_INDEX: DemandIndex = new Map();

// City Workload bonus (confirmed, Priority Flow step 6): the single city
// with the most POs in this batch gets a flat +5 — a simple relative
// signal that one location is carrying disproportionate load, not a
// tiered ranking. Ties broken by first-encountered city (stable, not
// meaningful — a real tie here is rare and not worth a second rule).
const CITY_WORKLOAD_BONUS = 5;

// One row of the ranked PO table — a PurchaseOrder flattened together with
// its computed timeline and priority result, in the exact shape the
// control-tower table/sections/charts need. Priority fields (score, level,
// rulesTriggered, recommendedAction) are real, not invented: they come
// straight out of the rule engine, so with zero rules published they
// legitimately show 0 / "Unscored" / [] / null rather than a guessed value.
export interface PoRow {
  po: PurchaseOrder;
  rank: number; // 1-indexed, assigned after sorting by score desc; 0 when unscored
  score: number;
  level: "Critical" | "High" | "Medium" | "Low" | "Unscored";
  daysRemaining: number;
  operationalDelayDays: number | null; // today − expiry; positive = days late
  isOverdue: boolean;
  hasDataError: boolean;
  appointmentDelayDays: number | null;
  appointmentScheduledTooLate: boolean;
  isMetroCity: boolean;
  cityWorkloadBonus: boolean; // this PO's city has the most POs in this batch (+5, confirmed)
  demandHits: DemandSkuHit[]; // this PO's SKUs that are top-selling in its marketplace's sales data, best rank first
  flags: string[];
  rulesTriggered: string[]; // rule names, not just ids
  recommendedAction: string | null;
  explanation: string[];
}

export function buildPoRows(
  pos: PurchaseOrder[],
  rules: Rule[],
  config: EngineConfig,
  demandIndex: DemandIndex = EMPTY_DEMAND_INDEX,
  today: Date = new Date()
): PoRow[] {
  const rulesById = new Map(rules.map((r) => [r.id, r]));

  // Top-1 city by PO count in this batch (confirmed scope: whatever batch
  // is passed in — the full pending set for the ranked table, or a
  // per-marketplace slice on marketplace pages).
  const cityCounts = new Map<string, number>();
  for (const po of pos) {
    cityCounts.set(po.city, (cityCounts.get(po.city) ?? 0) + 1);
  }
  let topCity: string | null = null;
  let topCount = 0;
  for (const [city, count] of cityCounts) {
    if (count > topCount) {
      topCity = city;
      topCount = count;
    }
  }

  const unranked = pos.map((po) => {
    const timeline = computeTimeline(po, config, today);
    const priority = computePoPriority(po, rules, config, demandIndex, today);

    // City Workload bonus only applies alongside real priority scoring —
    // computePoPriority already refuses to score anything but Pending,
    // but without this guard a Delivered/Cancelled/Closed PO sitting in
    // its batch's top city would still pick up the +5 bonus on its own
    // and get levelForScore'd into a real (non-Unscored) level, quietly
    // reopening the same "non-Pending PO shows a priority" bug this gate
    // exists to close.
    const isPending = isPendingStatus(po.status);
    const isTopCity = isPending && topCity !== null && po.city === topCity;
    const hadSignal = priority.level !== "Unscored";
    const score = priority.score + (isTopCity ? CITY_WORKLOAD_BONUS : 0);
    const level =
      isPending && (hadSignal || isTopCity) ? levelForScore(score, config.levelThresholds) : "Unscored";

    return {
      po,
      rank: 0,
      score,
      level,
      daysRemaining: timeline.daysRemaining,
      operationalDelayDays: timeline.operationalDelayDays,
      isOverdue: timeline.isOverdue,
      hasDataError: timeline.hasDataError,
      appointmentDelayDays: timeline.appointmentDelayDays,
      appointmentScheduledTooLate: timeline.appointmentScheduledTooLate,
      isMetroCity: timeline.isMetroCity,
      cityWorkloadBonus: isTopCity,
      demandHits: priority.demandHits,
      flags: priority.flags,
      rulesTriggered: priority.appliedRuleIds.map((id) => rulesById.get(id)?.name ?? id),
      recommendedAction: priority.recommendedActions[0] ?? null,
      explanation: priority.explanation,
    } satisfies PoRow;
  });

  // Sort by score, then the confirmed tiebreak order: PO Value, then
  // Pending Qty, then Marketplace (alphabetical — no order was specified
  // beyond "marketplace tiebreak", so this is a deterministic default).
  const sorted = [...unranked].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aValue = a.po.poValue ?? 0;
    const bValue = b.po.poValue ?? 0;
    if (bValue !== aValue) return bValue - aValue;
    if (b.po.pendingQty !== a.po.pendingQty) return b.po.pendingQty - a.po.pendingQty;
    return a.po.marketplace.localeCompare(b.po.marketplace);
  });
  let rank = 0;
  for (const row of sorted) {
    if (row.score > 0 || row.level !== "Unscored") {
      rank += 1;
      row.rank = rank;
    }
  }

  return unranked;
}
