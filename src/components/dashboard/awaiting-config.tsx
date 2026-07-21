import { Inbox } from "lucide-react";

export function AwaitingConfig({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="glass-card animate-fade-in rounded-card border-dashed p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
        <Inbox size={22} strokeWidth={1.75} />
      </span>
      <h2 className="mt-3 text-base font-semibold">{title}</h2>
      <ul className="mx-auto mt-3 max-w-md list-inside list-disc space-y-1 text-left text-sm text-neutral-500">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
