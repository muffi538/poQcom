import { PlusCircle, FolderPlus, Upload, Download, LayoutTemplate, History } from "lucide-react";
import { listRules } from "@/lib/rules/storage";
import { Condition, ConditionGroup, isConditionGroup, Rule } from "@/types/rules";
import { MarketplaceThemeScope } from "@/components/theme/marketplace-theme-scope";

const toolbarActions = [
  { label: "New Rule", icon: PlusCircle },
  { label: "New Group", icon: FolderPlus },
  { label: "Import Rules", icon: Upload },
  { label: "Export Rules", icon: Download },
  { label: "Rule Templates", icon: LayoutTemplate },
  { label: "Rule History", icon: History },
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
    <MarketplaceThemeScope marketplace={null}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rules Builder</h1>
          <p className="text-sm text-neutral-500">
            Visual, no-code priority rules. Drag to reorder — top rule runs first.
          </p>
        </div>

        <div className="animate-fade-in rounded-2xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          These starter rules were confirmed rule-by-rule and are live in the engine (see Overview/
          marketplace pages for real scores). The drag-and-drop editor below is still a shell — for
          now, edit <code>src/lib/rules/seed-rules.ts</code> or <code>.data/rules.json</code>{" "}
          directly. Create/Import/Export etc. activate once that editor is built.
        </div>

        <div className="flex flex-wrap gap-2">
          {toolbarActions.map(({ label, icon: Icon }) => (
            <button
              key={label}
              disabled
              title="Interactive condition/action editor not built yet"
              className="glass-card flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-neutral-400 shadow-sm"
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="glass-card rounded-card shadow-sm">
          {sorted.length === 0 ? (
            <div className="p-8 text-center text-sm text-neutral-500">No rules yet.</div>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-white/5">
              {sorted.map((rule) => (
                <li key={rule.id} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--mp-primary)]/15 text-[10px] font-bold text-[var(--mp-accent)]">
                        {rule.order}
                      </span>
                      {rule.name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        rule.enabled
                          ? "bg-[#0ca30c]/10 text-[#0b7a0b] dark:bg-[#0ca30c]/15 dark:text-[#6fdc6f]"
                          : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"
                      }`}
                    >
                      {rule.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <p className="mt-1.5 rounded-lg bg-neutral-50 px-3 py-1.5 font-mono text-xs text-neutral-600 dark:bg-neutral-800/40 dark:text-neutral-400">
                    {describeRule(rule)}
                  </p>
                  <p className="mt-1.5 text-xs text-neutral-500">{rule.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </MarketplaceThemeScope>
  );
}
