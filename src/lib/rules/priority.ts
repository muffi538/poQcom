import { PurchaseOrder, PoPriorityResult } from "@/types/purchase-order";
import { Rule } from "@/types/rules";
import { EngineConfig, levelForScore } from "@/lib/config/store";
import { computeTimeline } from "@/lib/po/derived";
import { buildEvalContext } from "./context";
import { runRules } from "./engine";

// The one place PO + Rules + Config come together into a final priority
// result. Level is score-derived only (confirmed) — computed here from
// the engine's accumulated score via levelForScore, never set by a rule.
// When zero rules match, the level is "Unscored" rather than an invented
// default (confirmed) so coverage gaps in the rule set stay visible.
export function computePoPriority(
  po: PurchaseOrder,
  rules: Rule[],
  config: EngineConfig,
  today: Date = new Date()
): PoPriorityResult {
  const timeline = computeTimeline(po, config, today);
  const ctx = buildEvalContext(po, timeline);
  const applicableRules = rules.filter(
    (r) => r.scope.marketplaces === "all" || r.scope.marketplaces.includes(po.marketplace)
  );
  const result = runRules(applicableRules, ctx);

  return {
    poId: po.id,
    score: result.score,
    level: result.appliedRuleIds.length > 0 ? levelForScore(result.score, config.levelThresholds) : "Unscored",
    appliedRuleIds: result.appliedRuleIds,
    skippedRuleIds: result.skippedRuleIds,
    flags: result.flags,
    confidence: result.confidence,
    explanation: result.explanation,
  };
}
