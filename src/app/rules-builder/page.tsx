import { listRules } from "@/lib/rules/storage";

const toolbarActions = [
  "New Rule",
  "New Group",
  "Import Rules",
  "Export Rules",
  "Rule Templates",
  "Rule History",
];

export default async function RulesBuilderPage() {
  const rules = await listRules();

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

      <div className="flex flex-wrap gap-2">
        {toolbarActions.map((action) => (
          <button
            key={action}
            disabled
            title="Wired up once the condition field catalog (real sheet columns) and scoring model are confirmed"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-400 dark:border-neutral-700"
          >
            {action}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        {rules.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-500">
            No rules yet. The condition field catalog, scoring model, and override/accumulate
            behavior all need to be confirmed before rules can be created — see the open
            questions.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium">{rule.name}</span>
                <span className="text-xs text-neutral-500">{rule.enabled ? "Enabled" : "Disabled"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
