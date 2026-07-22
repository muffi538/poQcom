import { PurchaseOrder, PoPriorityResult } from "@/types/purchase-order";
import { Rule } from "@/types/rules";
import { EngineConfig, levelForScore } from "@/lib/config/store";
import { computeTimeline } from "@/lib/po/derived";
import { buildEvalContext } from "./context";
import { runRules } from "./engine";
import { DemandIndex } from "@/lib/demand/rank";
import { computeDemandContribution } from "@/lib/demand/score-po";

const EMPTY_DEMAND_INDEX: DemandIndex = new Map();

function formatGmv(gmv: number): string {
  return `₹${Math.round(gmv).toLocaleString("en-IN")}`;
}

// The one place PO + Rules + Config + Demand Intelligence come together
// into a final priority result. Level is score-derived only (confirmed)
// — computed here from the combined accumulated score via
// levelForScore, never set by a rule. When nothing produced a signal —
// zero rules matched AND the PO's SKUs carry no demand data — the level
// is "Unscored" rather than an invented default (confirmed), so coverage
// gaps stay visible instead of silently reading as "Low".
export function computePoPriority(
  po: PurchaseOrder,
  rules: Rule[],
  config: EngineConfig,
  demandIndex: DemandIndex = EMPTY_DEMAND_INDEX,
  today: Date = new Date()
): PoPriorityResult {
  const timeline = computeTimeline(po, config, today);
  const ctx = buildEvalContext(po, timeline);
  const applicableRules = rules.filter(
    (r) => r.scope.marketplaces === "all" || r.scope.marketplaces.includes(po.marketplace)
  );
  const result = runRules(applicableRules, ctx);

  // Demand Intelligence: compares this PO's SKUs only against its own
  // marketplace's sales data (confirmed — never Zepto vs. Blinkit sales),
  // summing the tiered per-rank score across every SKU on the PO.
  const demand = computeDemandContribution(po, demandIndex);
  const totalScore = result.score + demand.score;
  const hasSignal = result.appliedRuleIds.length > 0 || demand.hits.length > 0;

  const sortedHits = demand.hits.slice().sort((a, b) => a.rank - b.rank);
  const demandExplanation = sortedHits.map(
    (hit) =>
      `${hit.sku} is ${po.marketplace}'s #${hit.rank} best-selling SKU by GMV (${formatGmv(hit.gmv)}) — demand priority +${hit.points}`
  );

  return {
    poId: po.id,
    score: totalScore,
    level: hasSignal ? levelForScore(totalScore, config.levelThresholds) : "Unscored",
    appliedRuleIds: result.appliedRuleIds,
    skippedRuleIds: result.skippedRuleIds,
    flags: demand.hits.some((h) => h.rank <= 5) ? [...result.flags, "High-Demand SKU"] : result.flags,
    confidence: result.confidence,
    explanation: [...result.explanation, ...demandExplanation],
    recommendedActions: result.recommendedActions,
    demandHits: sortedHits,
  };
}
