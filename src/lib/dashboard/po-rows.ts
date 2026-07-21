import { PurchaseOrder } from "@/types/purchase-order";
import { Rule } from "@/types/rules";
import { EngineConfig } from "@/lib/config/store";
import { computeTimeline } from "@/lib/po/derived";
import { computePoPriority } from "@/lib/rules/priority";

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
  flags: string[];
  rulesTriggered: string[]; // rule names, not just ids
  recommendedAction: string | null;
  explanation: string[];
}

export function buildPoRows(
  pos: PurchaseOrder[],
  rules: Rule[],
  config: EngineConfig,
  today: Date = new Date()
): PoRow[] {
  const rulesById = new Map(rules.map((r) => [r.id, r]));

  const unranked = pos.map((po) => {
    const timeline = computeTimeline(po, config, today);
    const priority = computePoPriority(po, rules, config, today);

    return {
      po,
      rank: 0,
      score: priority.score,
      level: priority.level,
      daysRemaining: timeline.daysRemaining,
      operationalDelayDays: timeline.operationalDelayDays,
      isOverdue: timeline.isOverdue,
      hasDataError: timeline.hasDataError,
      appointmentDelayDays: timeline.appointmentDelayDays,
      appointmentScheduledTooLate: timeline.appointmentScheduledTooLate,
      isMetroCity: timeline.isMetroCity,
      flags: priority.flags,
      rulesTriggered: priority.appliedRuleIds.map((id) => rulesById.get(id)?.name ?? id),
      recommendedAction: priority.recommendedActions[0] ?? null,
      explanation: priority.explanation,
    } satisfies PoRow;
  });

  const sorted = [...unranked].sort((a, b) => b.score - a.score);
  let rank = 0;
  for (const row of sorted) {
    if (row.score > 0 || row.level !== "Unscored") {
      rank += 1;
      row.rank = rank;
    }
  }

  return unranked;
}
