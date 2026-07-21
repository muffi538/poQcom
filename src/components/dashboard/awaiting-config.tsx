export function AwaitingConfig({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">
        This view is scaffolded but intentionally not wired to real numbers yet. It needs:
      </p>
      <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
