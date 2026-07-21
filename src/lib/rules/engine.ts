import {
  Condition,
  ConditionGroup,
  Rule,
  isConditionGroup,
} from "@/types/rules";

// Generic evaluation context: whatever fields a PO exposes, keyed by the
// same `field` strings used in Condition.field. Deliberately untyped beyond
// this so it works for both raw sheet columns and derived fields (SLA %,
// appointment delay, etc.) without the engine caring which is which.
export type EvalContext = Record<string, unknown>;

// Everything the mechanical rule engine can produce for one PO. Priority
// Level is deliberately not part of this — it's derived afterward, purely
// from `score` via the configurable thresholds (see levelForScore in
// src/lib/config/store.ts), never set directly by a rule.
export interface RuleRunResult {
  score: number;
  appliedRuleIds: string[];
  skippedRuleIds: string[];
  flags: string[];
  confidence: number;
  explanation: string[];
}

function toNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function evaluateCondition(condition: Condition, ctx: EvalContext): boolean {
  const actual = ctx[condition.field];
  const { operator, value } = condition;

  switch (operator) {
    case "is_empty":
      return actual === null || actual === undefined || actual === "";
    case "is_not_empty":
      return !(actual === null || actual === undefined || actual === "");
    case "equals":
      return actual === value;
    case "not_equals":
      return actual !== value;
    case "contains":
      return typeof actual === "string" && typeof value === "string"
        ? actual.toLowerCase().includes(value.toLowerCase())
        : false;
    case "not_contains":
      return typeof actual === "string" && typeof value === "string"
        ? !actual.toLowerCase().includes(value.toLowerCase())
        : true;
    case "in":
      return Array.isArray(value) ? value.includes(String(actual)) : false;
    case "not_in":
      return Array.isArray(value) ? !value.includes(String(actual)) : true;
    case "greater_than":
    case "greater_than_or_equal":
    case "less_than":
    case "less_than_or_equal": {
      const a = toNumber(actual);
      const b = toNumber(value);
      if (a === null || b === null) return false;
      if (operator === "greater_than") return a > b;
      if (operator === "greater_than_or_equal") return a >= b;
      if (operator === "less_than") return a < b;
      return a <= b;
    }
    default:
      return false;
  }
}

export function evaluateGroup(group: ConditionGroup, ctx: EvalContext): boolean {
  const results = group.children.map((node) =>
    isConditionGroup(node) ? evaluateGroup(node, ctx) : evaluateCondition(node, ctx)
  );
  if (results.length === 0) return true;
  return group.join === "AND" ? results.every(Boolean) : results.some(Boolean);
}

// Runs an ordered, enabled rule set against one PO's evaluation context.
// Pure mechanics only: no rule's score or flag is assumed here — every
// number in the output comes from the Rule objects passed in. Scores
// accumulate across matching rules by default; a rule can set
// scoreMode: "override" to reset the running score, and onMatch: "stop"
// to short-circuit lower-priority rules (both confirmed behaviors).
export function runRules(rules: Rule[], ctx: EvalContext): RuleRunResult {
  const ordered = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => a.order - b.order);

  let score = 0;
  const flags = new Set<string>();
  const applied: string[] = [];
  const skipped: string[] = [];
  const explanation: string[] = [];

  for (const rule of ordered) {
    const matches = evaluateGroup(rule.conditions, ctx);
    if (!matches) {
      skipped.push(rule.id);
      continue;
    }

    applied.push(rule.id);
    explanation.push(rule.action.reason || rule.name);
    rule.action.addFlags.forEach((f) => flags.add(f));

    if (rule.action.scoreDelta !== null) {
      score =
        rule.action.scoreMode === "override" ? rule.action.scoreDelta : score + rule.action.scoreDelta;
    }

    if (rule.onMatch === "stop") break;
  }

  return {
    score,
    appliedRuleIds: applied,
    skippedRuleIds: skipped,
    flags: Array.from(flags),
    confidence: ordered.length > 0 ? applied.length / ordered.length : 0,
    explanation,
  };
}
