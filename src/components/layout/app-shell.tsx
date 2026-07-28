"use client";

import { useState } from "react";
import { Sidebar, SIDEBAR_WIDTH_PX } from "@/components/layout/sidebar";

// Owns the collapsed/expanded state so both the fixed Sidebar and <main>'s
// left offset stay in sync — a `position: fixed` sidebar sits outside
// document flow (required so it never scrolls and never moves), so
// nothing pushes main over automatically the way an in-flow flex sibling
// would; this offset has to be set explicitly, from the same state.
export function AppShell({
  isAdmin,
  allowedPages,
  email,
  lastSyncedAt,
  children,
}: {
  isAdmin: boolean;
  allowedPages: string[];
  email: string;
  lastSyncedAt: string | null;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? SIDEBAR_WIDTH_PX.collapsed : SIDEBAR_WIDTH_PX.expanded;

  return (
    <div className="min-h-screen">
      <Sidebar
        isAdmin={isAdmin}
        allowedPages={allowedPages}
        email={email}
        lastSyncedAt={lastSyncedAt}
        collapsed={collapsed}
        onToggleCollapsed={setCollapsed}
      />
      <main
        className="min-w-0 px-3 py-3 transition-[margin-left] duration-200"
        style={{ marginLeft: sidebarWidth }}
      >
        {children}
      </main>
    </div>
  );
}
