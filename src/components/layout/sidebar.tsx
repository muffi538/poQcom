"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  LayoutDashboard,
  Settings,
  RefreshCw,
  ShieldCheck,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from "lucide-react";
import { MARKETPLACES, marketplaceSlug } from "@/types/marketplace";
import { MARKETPLACE_THEMES } from "@/lib/theme/marketplace-colors";
import { logoutAction } from "@/lib/auth/logout-action";

const staticLinks = [{ href: "/", pageKey: "overview", label: "Overview", icon: LayoutDashboard }];
// Rules Builder is intentionally not here — it's admin-only (see below),
// not a per-user togglable page, so it's never in this filtered list.
const toolLinks = [
  { href: "/data-sync", pageKey: "data-sync", label: "Data Sync", icon: RefreshCw },
  { href: "/settings", pageKey: "settings", label: "Settings", icon: Settings },
];

function formatRelativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Ticks its own relative-time text every 30s so "Last synced" stays
// current without a page reload — the sync timestamp itself only comes
// from the server (one fetch per navigation), this just re-renders the
// "X ago" phrasing against the clock.
function LastSyncedStatus({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-1.5 px-1 text-[11px] text-white/60 dark:text-neutral-500">
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
      </span>
      <span className="truncate">{lastSyncedAt ? `Synced ${formatRelativeTime(lastSyncedAt)}` : "Not synced yet"}</span>
    </div>
  );
}

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
          ? "bg-frido-sidebarActive text-white dark:bg-white dark:text-neutral-900"
          : "text-white/85 hover:bg-white/10 dark:text-neutral-400 dark:hover:bg-neutral-800"
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

// Sidebar width in both states — SIDEBAR_WIDTH_PX is the single source of
// truth AppShell reads to offset <main> by the same amount, since a truly
// `fixed` sidebar (required so it never moves and never scrolls with the
// page) is taken out of document flow and can't push main over on its own
// the way an in-flow flex sibling would.
export const SIDEBAR_WIDTH_PX = { expanded: 176, collapsed: 48 } as const;

export function Sidebar({
  isAdmin,
  allowedPages,
  email,
  lastSyncedAt,
  collapsed,
  onToggleCollapsed,
}: {
  isAdmin: boolean;
  allowedPages: string[];
  email: string;
  lastSyncedAt: string | null;
  collapsed: boolean;
  onToggleCollapsed: Dispatch<SetStateAction<boolean>>;
}) {
  const pathname = usePathname();
  // Admins bypass the per-page allow-list entirely (see src/proxy.ts) —
  // the Sidebar mirrors that so an admin never sees a page hidden from
  // them just because nobody granted their own account explicit access.
  const canSee = (key: string) => isAdmin || allowedPages.includes(key);
  const visibleMarketplaces = MARKETPLACES.filter((m) => canSee(marketplaceSlug(m)));

  return (
    <aside
      // No explicit height (h-dvh/h-screen) here on purpose: under the
      // page-wide `zoom` CSS trick (see globals.css), a viewport-unit
      // length computes against the zoomed coordinate space and ends up
      // visually shorter than the real viewport, leaving a blank strip
      // below a `position: fixed` box. `inset-y-0` (top:0; bottom:0)
      // stretches it to fill the viewport as a positioning constraint
      // instead, which isn't subject to the same mismatch.
      className={`fixed inset-y-0 left-0 z-10 flex shrink-0 flex-col border-r border-black/10 bg-frido-sidebar transition-[width] duration-200 dark:border-white/10 dark:bg-neutral-950 ${
        collapsed ? "w-12" : "w-44"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-frido-yellow text-xs font-black text-black">
          F
        </span>
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-white dark:text-neutral-100">Frido</div>
            <div className="text-[10px] text-white/70 dark:text-neutral-500">Control Tower</div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-1.5">
        {staticLinks
          .filter((l) => canSee(l.pageKey))
          .map(({ pageKey, ...l }) => (
            <NavItem key={l.href} {...l} active={pathname === l.href} collapsed={collapsed} />
          ))}

        {!collapsed && visibleMarketplaces.length > 0 && (
          <div className="px-2.5 pb-0.5 pt-3 text-[10px] font-semibold uppercase tracking-wide text-white/60 dark:text-neutral-400">
            Marketplaces
          </div>
        )}
        {visibleMarketplaces.map((m) => {
          const href = `/marketplaces/${marketplaceSlug(m)}`;
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

        {!collapsed && (toolLinks.some((l) => canSee(l.pageKey)) || isAdmin) && (
          <div className="px-2.5 pb-0.5 pt-3 text-[10px] font-semibold uppercase tracking-wide text-white/60 dark:text-neutral-400">
            Tools
          </div>
        )}
        {toolLinks
          .filter((l) => canSee(l.pageKey))
          .map(({ pageKey, ...l }) => (
            <NavItem key={l.href} {...l} active={pathname === l.href} collapsed={collapsed} />
          ))}
        {isAdmin && (
          <NavItem
            href="/admin"
            label="Admin"
            icon={ShieldCheck}
            active={pathname === "/admin"}
            collapsed={collapsed}
          />
        )}
      </nav>

      <div className="m-2 space-y-2">
        {!collapsed && <LastSyncedStatus lastSyncedAt={lastSyncedAt} />}
        {!collapsed && email && (
          <div className="truncate px-1 text-[11px] text-white/60 dark:text-neutral-500" title={email}>
            {email}
          </div>
        )}
        <form action={logoutAction}>
          <button
            type="submit"
            title={collapsed ? "Log out" : undefined}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-white/20 py-1.5 text-xs text-white/80 transition-colors hover:bg-white/10 dark:border-white/10 dark:text-neutral-500 dark:hover:bg-neutral-900"
          >
            <LogOut size={14} />
            {!collapsed && "Log out"}
          </button>
        </form>
        <button
          onClick={() => onToggleCollapsed((c) => !c)}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-white/20 py-1.5 text-xs text-white/80 transition-colors hover:bg-white/10 dark:border-white/10 dark:text-neutral-500 dark:hover:bg-neutral-900"
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
