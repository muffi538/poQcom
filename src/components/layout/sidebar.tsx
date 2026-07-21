"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  SlidersHorizontal,
  FlaskConical,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from "lucide-react";
import { MARKETPLACES } from "@/types/marketplace";
import { MARKETPLACE_THEMES } from "@/lib/theme/marketplace-colors";

const staticLinks = [{ href: "/", label: "Overview", icon: LayoutDashboard }];
const toolLinks = [
  { href: "/rules-builder", label: "Rules Builder", icon: SlidersHorizontal },
  { href: "/simulator", label: "Simulator", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavItem({
  href,
  label,
  active,
  collapsed,
  icon: Icon,
  dotColor,
}: {
  href: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  icon?: LucideIcon;
  dotColor?: string;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
      }`}
    >
      {Icon ? (
        <Icon size={17} strokeWidth={2} className="shrink-0" />
      ) : (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
      )}
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-frido-border bg-white transition-[width] duration-200 dark:border-white/10 dark:bg-neutral-950 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-frido-yellow text-sm font-black text-black">
          F
        </span>
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-sm font-semibold">Frido</div>
            <div className="text-xs text-neutral-500">Control Tower</div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2">
        {staticLinks.map((l) => (
          <NavItem key={l.href} {...l} active={pathname === l.href} collapsed={collapsed} />
        ))}

        {!collapsed && (
          <div className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Marketplaces
          </div>
        )}
        {MARKETPLACES.map((m) => {
          const href = `/marketplaces/${m.toLowerCase()}`;
          return (
            <NavItem
              key={href}
              href={href}
              label={m}
              active={pathname === href}
              collapsed={collapsed}
              dotColor={MARKETPLACE_THEMES[m]?.primary ?? "#999"}
            />
          );
        })}

        {!collapsed && (
          <div className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Tools
          </div>
        )}
        {toolLinks.map((l) => (
          <NavItem key={l.href} {...l} active={pathname === l.href} collapsed={collapsed} />
        ))}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="m-2 flex items-center justify-center gap-2 rounded-xl border border-frido-border py-2 text-xs text-neutral-500 transition-colors hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-neutral-900"
      >
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        {!collapsed && "Collapse"}
      </button>
    </aside>
  );
}
