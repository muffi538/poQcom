import { headers } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { getLastSyncedAt } from "@/lib/sync/last-synced";

// Every real page lives under this route group so it shares one guard:
// src/proxy.ts already verified the session and (for non-admins) the
// page-level permission before this ever renders, and forwarded the
// result via request headers — read here once instead of querying
// Supabase a second time just to decide what the Sidebar should show.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const isAdmin = h.get("x-user-admin") === "1";
  const allowedPages = (h.get("x-user-pages") ?? "").split(",").filter(Boolean);
  const email = h.get("x-user-email") ?? "";
  const lastSyncedAt = await getLastSyncedAt();

  return (
    <AppShell isAdmin={isAdmin} allowedPages={allowedPages} email={email} lastSyncedAt={lastSyncedAt}>
      {children}
    </AppShell>
  );
}
