// Generic rule schema for the visual Rules Builder. Nothing in this file
// encodes a business decision (no thresholds, no scores, no "metro city"
// list) — it only defines the shape a rule takes so the UI, storage, and
// evaluator can agree on a format. Actual rules are data created by ops
// users at runtime, not code.

export type FieldType = "string" | "number" | "boolean" | "date" | "enum";

// The field catalog is what populates the "Condition" dropdown in the
// builder. It will be generated from the real sheet columns once the
// column mapping is confirmed (see Settings > Field Mapping).
export interface FieldDefinition {
  key: string; // e.g. "marketplace", "slaConsumedPercent"
  label: string; // e.g. "Marketplace"
  type: FieldType;
  enumOptions?: string[]; // for type "enum", e.g. marketplace names
  source: "sheet" | "derived"; // raw column vs. computed by the engine
}

export type ComparisonOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "is_not_empty"
  | "in"
  | "not_in";

export interface Condition {
  id: string;
  field: string; // FieldDefinition.key
  operator: ComparisonOperator;
  value: string | number | boolean | string[] | null;
}

export type GroupJoin = "AND" | "OR";

// A group can nest other groups, giving unlimited-depth condition trees.
export interface ConditionGroup {
  id: string;
  join: GroupJoin;
  children: Array<Condition | ConditionGroup>;
}

export function isConditionGroup(
  node: Condition | ConditionGroup
): node is ConditionGroup {
  return (node as ConditionGroup).join !== undefined;
}

export type ScoreMode = "accumulate" | "override";

export interface RuleAction {
  scoreMode: ScoreMode;
  scoreDelta: number | null; // null when this rule only sets level/flags, no score
  setPriorityLevel: "Critical" | "High" | "Medium" | "Low" | null;
  addFlags: string[];
  reason: string; // human-readable explanation shown in Explanation / Simulator
}

export type StopBehavior = "stop" | "continue";

export interface Rule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  order: number; // execution / display order, drag-to-reorder writes this
  groupId: string | null; // Rule Group this rule belongs to, if any
  scope: {
    marketplaces: string[] | "all";
  };
  conditions: ConditionGroup;
  action: RuleAction;
  onMatch: StopBehavior; // stop processing lower rules, or continue
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number; // bumped on every edit, backs Rule History
}

export interface RuleGroup {
  id: string;
  name: string;
  order: number;
}

// One row of Rule History — an immutable snapshot taken on every save,
// enable/disable, or delete, so changes can be audited and reverted.
export interface RuleHistoryEntry {
  id: string;
  ruleId: string;
  version: number;
  action: "created" | "edited" | "enabled" | "disabled" | "deleted" | "reordered";
  snapshot: Rule;
  changedBy: string;
  changedAt: string;
}

// A named, reusable starting point offered in "Rule Templates". Templates
// hold structure only (which fields/operators a rule like this tends to
// use) — never a pre-filled score, since scores aren't ours to assume.
export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  conditions: ConditionGroup;
  actionSkeleton: Partial<RuleAction>;
}
