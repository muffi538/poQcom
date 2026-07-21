import { listRules } from "@/lib/rules/storage";
import { Condition, ConditionGroup, isConditionGroup, Rule } from "@/types/rules";

const toolbarActions = [
  "New Rule",
  "New Group",
  "Import Rules",
  "Export Rules",
  "Rule Templates",
  "Rule History",
];

const OPERATOR_SYMBOL: Record<string, string> = {
  equals: "=",
  not_equals: "≠",
  greater_than: ">",
  greater_than_or_equal: "≥",
  less_than: "<",
  less_than_or_equal: "≤",
  contains: "contains",
  not_contains: "doesn't contain",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  in: "in",
  not_in: "not in",
};

function describeCondition(c: Condition): string {
  const symbol = OPERATOR_SYMBOL[c.operator] ?? c.operator;
  return c.value === null || c.value === undefined
    ? `${c.field} ${symbol}`
    : `${c.field} ${symbol} ${JSON.stringify(c.value)}`;
}

function describeGroup(group: ConditionGroup): string {
  return group.children
    .map((child) => (isConditionGroup(child) ? `(${describeGroup(child)})` : describeCondition(child)))
    .join(` ${group.join} `);
}

function describeRule(rule: Rule): string {
  return `IF ${describeGroup(rule.conditions)} THEN ${
    rule.action.scoreMode === "override" ? "set score to" : "score"
  } ${rule.action.scoreDelta !== null ? `${rule.action.scoreDelta >= 0 ? "+" : ""}${rule.action.scoreDelta}` : "unchanged"}${
    rule.onMatch === "stop" ? ", stop" : ""
  }`;
}

export default async function RulesBuilderPage() {
  const rules = await listRules();
  const sorted = [...rules].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Rules Builder</h1>
          <p className="text-sm text-neutral-500">
            Visual, no-code priority rules. Drag to reorder — top rule runs first.
          </p>
        </div>
      </div>

      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        These starter rules were confirmed rule-by-rule and are live in the engine (see Overview/
        marketplace pages for real scores). The drag-and-drop editor below is still a shell — for
        now, edit <code>src/lib/rules/seed-rules.ts</code> or <code>.data/rules.json</code>
        directly. Create/Import/Export etc. activate once that editor is built.
      </div>

      <div className="flex flex-wrap gap-2">
        {toolbarActions.map((action) => (
          <button
            key={action}
            disabled
            title="Interactive condition/action editor not built yet"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-400 dark:border-neutral-700"
          >
            {action}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        {sorted.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-500">No rules yet.</div>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {sorted.map((rule) => (
              <li key={rule.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {rule.order}. {rule.name}
                  </span>
                  <span
                    className={`text-xs ${rule.enabled ? "text-green-600" : "text-neutral-400"}`}
                  >
                    {rule.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-neutral-500">{describeRule(rule)}</p>
                <p className="mt-1 text-xs text-neutral-500">{rule.description}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
