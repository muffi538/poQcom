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
import { ThemeToggle } from "@/components/theme/theme-toggle";

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
      className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
      }`}
    >
      {Icon ? (
        <Icon size={15} strokeWidth={2} className="shrink-0" />
      ) : (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
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
        collapsed ? "w-12" : "w-44"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-frido-yellow text-xs font-black text-black">
          F
        </span>
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-[13px] font-semibold">Frido</div>
            <div className="text-[10px] text-neutral-500">Control Tower</div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-1.5">
        {staticLinks.map((l) => (
          <NavItem key={l.href} {...l} active={pathname === l.href} collapsed={collapsed} />
        ))}

        {!collapsed && (
          <div className="px-2.5 pb-0.5 pt-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
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
          <div className="px-2.5 pb-0.5 pt-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            Tools
          </div>
        )}
        {toolLinks.map((l) => (
          <NavItem key={l.href} {...l} active={pathname === l.href} collapsed={collapsed} />
        ))}
      </nav>

      <div className="m-2 space-y-2">
        <ThemeToggle collapsed={collapsed} />
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-frido-border py-2 text-xs text-neutral-500 transition-colors hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-neutral-900"
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
