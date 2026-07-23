import { supabase } from "@/lib/supabase";
import { Rule, RuleGroup } from "@/types/rules";
import { SEED_RULES } from "./seed-rules";

// Persistence for the Rules Builder — the normalized priority_rules /
// priority_rule_groups / priority_rule_marketplaces schema (see
// supabase/migrations/0001_operations_dashboard_schema.sql), replacing
// both the earlier JSON-file placeholder AND the short-lived
// rules/rule_groups/rule_history tables from the first Supabase pass.
// rule_history is gone entirely — every rule change now goes through
// logRuleChange() into activity_logs instead, one audit trail for the
// whole app rather than a rules-specific one.
const PRIORITY_RULES_TABLE = "priority_rules";
const PRIORITY_RULE_GROUPS_TABLE = "priority_rule_groups";
const PRIORITY_RULE_MARKETPLACES_TABLE = "priority_rule_marketplaces";
const MARKETPLACES_TABLE = "marketplaces";
const ACTIVITY_LOGS_TABLE = "activity_logs";

interface PriorityRuleRow {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  display_order: number;
  group_id: string | null;
  applies_to_all_marketplaces: boolean;
  conditions: Rule["conditions"];
  on_match: Rule["onMatch"];
  score_mode: Rule["action"]["scoreMode"];
  score_delta: number | null;
  add_flags: string[] | null;
  reason: string | null;
  recommended_action: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  version: number;
}

// Rule.scope.marketplaces works in terms of marketplace NAMES ("Zepto",
// "Blinkit", ...) — that's what computePoPriority filters rules against
// (`scope.marketplaces.includes(po.marketplace)`). The DB stores the
// per-marketplace override as a UUID in priority_rule_marketplaces, so
// every read/write through this file translates between the two via the
// marketplaces table — callers of listRules()/saveRules() never see a
// marketplace UUID.
async function loadMarketplaceNameMaps(): Promise<{
  idToName: Map<string, string>;
  nameToId: Map<string, string>;
}> {
  const { data, error } = await supabase.from(MARKETPLACES_TABLE).select("id, name");
  if (error) throw new Error(`Failed to load marketplaces from Supabase: ${error.message}`);
  const idToName = new Map<string, string>();
  const nameToId = new Map<string, string>();
  for (const row of data ?? []) {
    idToName.set(row.id, row.name);
    nameToId.set(row.name, row.id);
  }
  return { idToName, nameToId };
}

function rowToRule(row: PriorityRuleRow, scopedMarketplaceNames: string[] | null): Rule {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    enabled: row.enabled,
    order: row.display_order,
    groupId: row.group_id,
    // scopedMarketplaceNames is null when this rule has no per-marketplace
    // exceptions at all — "all" stays the literal string in that (common)
    // case rather than materializing every marketplace name for nothing.
    scope: { marketplaces: row.applies_to_all_marketplaces ? scopedMarketplaceNames ?? "all" : scopedMarketplaceNames ?? [] },
    conditions: row.conditions,
    action: {
      scoreMode: row.score_mode,
      scoreDelta: row.score_delta,
      addFlags: row.add_flags ?? [],
      reason: row.reason ?? "",
      recommendedAction: row.recommended_action ?? "",
    },
    onMatch: row.on_match,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // created_by (DB) is a uuid FK into auth.users — there's no auth yet,
    // so it's always null today. Rule.createdBy is a free-text display
    // label, not something that round-trips through that column.
    createdBy: row.created_by ?? "system",
    version: row.version,
  };
}

// Falls back to the confirmed starter rules (src/lib/rules/seed-rules.ts)
// until ops saves their own rules through the (forthcoming) interactive
// Rules Builder — at that point the table becomes the real source of
// truth and the seed no longer applies.
export async function listRules(): Promise<Rule[]> {
  const { data, error } = await supabase
    .from(PRIORITY_RULES_TABLE)
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw new Error(`Failed to load rules from Supabase: ${error.message}`);
  if (!data || data.length === 0) return SEED_RULES;

  const rows = data as PriorityRuleRow[];
  const ruleIds = rows.map((r) => r.id);

  // One query for every rule's marketplace exceptions/overrides — cheaper
  // than a per-rule round trip, and correct whether a rule applies to all
  // marketplaces (exceptions = explicitly disabled rows) or only some
  // (inclusions = explicitly enabled rows).
  const { data: scopeRows, error: scopeError } = await supabase
    .from(PRIORITY_RULE_MARKETPLACES_TABLE)
    .select("priority_rule_id, marketplace_id, enabled")
    .in("priority_rule_id", ruleIds.length > 0 ? ruleIds : ["00000000-0000-0000-0000-000000000000"]);
  if (scopeError) throw new Error(`Failed to load rule marketplace scope: ${scopeError.message}`);

  const scopeByRuleId = new Map<string, { marketplaceId: string; enabled: boolean }[]>();
  for (const row of scopeRows ?? []) {
    const list = scopeByRuleId.get(row.priority_rule_id) ?? [];
    list.push({ marketplaceId: row.marketplace_id, enabled: row.enabled });
    scopeByRuleId.set(row.priority_rule_id, list);
  }

  const needsNameLookup = (scopeRows ?? []).length > 0;
  const idToName = needsNameLookup ? (await loadMarketplaceNameMaps()).idToName : new Map<string, string>();

  return rows.map((row) => {
    const scope = scopeByRuleId.get(row.id);
    if (!scope || scope.length === 0) return rowToRule(row, null);
    const names = row.applies_to_all_marketplaces
      ? scope.filter((s) => !s.enabled).map((s) => idToName.get(s.marketplaceId)).filter((n): n is string => Boolean(n))
      : scope.filter((s) => s.enabled).map((s) => idToName.get(s.marketplaceId)).filter((n): n is string => Boolean(n));
    if (row.applies_to_all_marketplaces && names.length === 0) return rowToRule(row, null); // no real exceptions — plain "all"
    if (row.applies_to_all_marketplaces) {
      // "All marketplaces except <names>" — materialize as the explicit
      // complement so the existing `scope.marketplaces.includes(...)`
      // filter in computePoPriority needs no changes to understand it.
      const allNames = Array.from(idToName.values());
      return rowToRule(row, allNames.filter((n) => !names.includes(n)));
    }
    return rowToRule(row, names);
  });
}

export async function saveRules(rules: Rule[]): Promise<void> {
  const { nameToId } = await loadMarketplaceNameMaps();

  // Whole-table replace (matches the previous JSON-file/rules-table
  // semantics: the saved array is the complete, authoritative list).
  const { error: deleteScopeError } = await supabase
    .from(PRIORITY_RULE_MARKETPLACES_TABLE)
    .delete()
    .neq("priority_rule_id", "00000000-0000-0000-0000-000000000000");
  if (deleteScopeError) throw new Error(`Failed to clear rule marketplace scope: ${deleteScopeError.message}`);

  const { error: deleteError } = await supabase.from(PRIORITY_RULES_TABLE).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteError) throw new Error(`Failed to clear rules in Supabase: ${deleteError.message}`);
  if (rules.length === 0) return;

  const rows = rules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    description: rule.description,
    enabled: rule.enabled,
    display_order: rule.order,
    group_id: rule.groupId,
    applies_to_all_marketplaces: rule.scope.marketplaces === "all",
    conditions: rule.conditions,
    on_match: rule.onMatch,
    score_mode: rule.action.scoreMode,
    score_delta: rule.action.scoreDelta,
    add_flags: rule.action.addFlags,
    reason: rule.action.reason,
    recommended_action: rule.action.recommendedAction,
    version: rule.version,
    // created_by intentionally omitted (left null) — no auth.users row
    // exists to reference; Rule.createdBy is a free-text label with
    // nowhere safe to live in a uuid FK column until real auth exists.
  }));
  const { error: insertError } = await supabase.from(PRIORITY_RULES_TABLE).insert(rows);
  if (insertError) throw new Error(`Failed to save rules to Supabase: ${insertError.message}`);

  // Only rules scoped to a specific subset need explicit rows — "all,
  // with exceptions" isn't expressible from the current Rule type (it
  // only has "all" | string[]), so a future Rules Builder enhancement
  // that wants to disable one rule for one marketplace while leaving it
  // "all" everywhere else can use this same table without a migration —
  // saveRules just doesn't produce that shape today.
  const scopeRows: { priority_rule_id: string; marketplace_id: string; enabled: boolean }[] = [];
  for (const rule of rules) {
    if (rule.scope.marketplaces === "all") continue;
    for (const name of rule.scope.marketplaces) {
      const id = nameToId.get(name);
      if (id) scopeRows.push({ priority_rule_id: rule.id, marketplace_id: id, enabled: true });
    }
  }
  if (scopeRows.length > 0) {
    const { error } = await supabase.from(PRIORITY_RULE_MARKETPLACES_TABLE).insert(scopeRows);
    if (error) throw new Error(`Failed to save rule marketplace scope to Supabase: ${error.message}`);
  }
}

export async function listRuleGroups(): Promise<RuleGroup[]> {
  const { data, error } = await supabase
    .from(PRIORITY_RULE_GROUPS_TABLE)
    .select("id, name, display_order")
    .order("display_order", { ascending: true });
  if (error) throw new Error(`Failed to load rule groups from Supabase: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, order: row.display_order }));
}

export async function saveRuleGroups(groups: RuleGroup[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from(PRIORITY_RULE_GROUPS_TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteError) throw new Error(`Failed to clear rule groups in Supabase: ${deleteError.message}`);
  if (groups.length === 0) return;
  const { error: insertError } = await supabase
    .from(PRIORITY_RULE_GROUPS_TABLE)
    .insert(groups.map((group) => ({ id: group.id, name: group.name, display_order: group.order })));
  if (insertError) throw new Error(`Failed to save rule groups to Supabase: ${insertError.message}`);
}

export type RuleChangeAction =
  | "rule.created"
  | "rule.updated"
  | "rule.deleted"
  | "rule.enabled"
  | "rule.disabled"
  | "rule.weight_changed"
  | "rule.reordered";

// Replaces the old rule_history table — every rule change is now one
// activity_logs row (entity_type "priority_rule"), the same audit trail
// the rest of the app uses (sync triggers, PO overrides, settings edits).
export async function logRuleChange(params: {
  ruleId: string;
  action: RuleChangeAction;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from(ACTIVITY_LOGS_TABLE).insert({
    action: params.action,
    entity_type: "priority_rule",
    entity_id: params.ruleId,
    metadata: params.metadata ?? null,
  });
  if (error) throw new Error(`Failed to log rule change to Supabase: ${error.message}`);
}
