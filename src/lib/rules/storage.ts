import { supabase } from "@/lib/supabase";
import { Rule, RuleGroup, RuleHistoryEntry } from "@/types/rules";
import { SEED_RULES } from "./seed-rules";

// Persistence for the Rules Builder — Supabase (rules/rule_groups/
// rule_history tables in the project's public schema), replacing the
// earlier placeholder JSON-file storage. Each row stores one whole
// Rule/RuleGroup/RuleHistoryEntry as JSONB rather than normalizing into
// columns — these are recursive/nested shapes (Rule.conditions is a
// condition tree) that don't map cleanly onto relational columns, and
// the app already treats the whole object as the unit of read/write.
const RULES_TABLE = "rules";
const GROUPS_TABLE = "rule_groups";
const HISTORY_TABLE = "rule_history";

// Falls back to the confirmed starter rules (src/lib/rules/seed-rules.ts)
// until ops saves their own rules through the (forthcoming) interactive
// Rules Builder — at that point the table becomes the real source of
// truth and the seed no longer applies.
export async function listRules(): Promise<Rule[]> {
  const { data, error } = await supabase.from(RULES_TABLE).select("data");
  if (error) throw new Error(`Failed to load rules from Supabase: ${error.message}`);
  if (!data || data.length === 0) return SEED_RULES;
  return data.map((row) => row.data as Rule);
}

export async function saveRules(rules: Rule[]): Promise<void> {
  // Whole-table replace (matches the previous JSON-file semantics: the
  // saved array is the complete, authoritative list) — delete every
  // existing row, then insert the new set. Not run inside a DB
  // transaction (the supabase-js client doesn't expose one for this),
  // so a mid-write failure could leave the table briefly empty; the
  // caller only invokes this from the Rules Builder's own save action,
  // not on every page load, which keeps that window small.
  const { error: deleteError } = await supabase.from(RULES_TABLE).delete().neq("id", "");
  if (deleteError) throw new Error(`Failed to clear rules in Supabase: ${deleteError.message}`);
  if (rules.length === 0) return;
  const { error: insertError } = await supabase
    .from(RULES_TABLE)
    .insert(rules.map((rule) => ({ id: rule.id, data: rule })));
  if (insertError) throw new Error(`Failed to save rules to Supabase: ${insertError.message}`);
}

export async function listRuleGroups(): Promise<RuleGroup[]> {
  const { data, error } = await supabase.from(GROUPS_TABLE).select("data");
  if (error) throw new Error(`Failed to load rule groups from Supabase: ${error.message}`);
  if (!data) return [];
  return data.map((row) => row.data as RuleGroup);
}

export async function saveRuleGroups(groups: RuleGroup[]): Promise<void> {
  const { error: deleteError } = await supabase.from(GROUPS_TABLE).delete().neq("id", "");
  if (deleteError) throw new Error(`Failed to clear rule groups in Supabase: ${deleteError.message}`);
  if (groups.length === 0) return;
  const { error: insertError } = await supabase
    .from(GROUPS_TABLE)
    .insert(groups.map((group) => ({ id: group.id, data: group })));
  if (insertError) throw new Error(`Failed to save rule groups to Supabase: ${insertError.message}`);
}

export async function listRuleHistory(): Promise<RuleHistoryEntry[]> {
  const { data, error } = await supabase.from(HISTORY_TABLE).select("data").order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load rule history from Supabase: ${error.message}`);
  if (!data) return [];
  return data.map((row) => row.data as RuleHistoryEntry);
}

// Append-only, unlike saveRules/saveRuleGroups — history is a growing
// log, not a replaceable snapshot, so this just inserts the one new row.
export async function appendRuleHistory(entry: RuleHistoryEntry): Promise<void> {
  const { error } = await supabase.from(HISTORY_TABLE).insert({ id: entry.id, data: entry });
  if (error) throw new Error(`Failed to append rule history entry to Supabase: ${error.message}`);
}
