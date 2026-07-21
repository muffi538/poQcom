import Link from "next/link";
import { MARKETPLACES } from "@/types/marketplace";

const links = [
  { href: "/", label: "Overview" },
  ...MARKETPLACES.map((m) => ({ href: `/marketplaces/${m.toLowerCase()}`, label: m })),
  { href: "/rules-builder", label: "Rules Builder" },
  { href: "/simulator", label: "Simulator" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-neutral-200 bg-white px-4 py-2 dark:border-neutral-800 dark:bg-neutral-950">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
