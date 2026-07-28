import { MARKETPLACES, marketplaceSlug } from "@/types/marketplace";

// The full set of togglable pages an admin can grant/revoke per user —
// deliberately just "Overview + one entry per marketplace + tools", no
// roles/hierarchy. Driven by the same MARKETPLACES list the rest of the
// app uses (marketplace-agnostic: a 7th marketplace shows up here with
// no code change, same as everywhere else it's referenced).
export interface PageDef {
  key: string;
  label: string;
  group: "main" | "marketplace" | "tools";
}

export const STATIC_PAGES: PageDef[] = [{ key: "overview", label: "Overview", group: "main" }];

export const MARKETPLACE_PAGES: PageDef[] = MARKETPLACES.map((m) => ({
  key: marketplaceSlug(m),
  label: m,
  group: "marketplace",
}));

export const TOOL_PAGES: PageDef[] = [
  { key: "rules-builder", label: "Rules Builder", group: "tools" },
  { key: "data-sync", label: "Data Sync", group: "tools" },
  { key: "settings", label: "Settings", group: "tools" },
];

export const ALL_PAGES: PageDef[] = [...STATIC_PAGES, ...MARKETPLACE_PAGES, ...TOOL_PAGES];

// Maps a request path to the page key that gates it, or null for paths
// that aren't behind the per-page permission check (/admin is gated on
// is_admin instead; /login and /no-access are always reachable once
// logged in).
export function resolvePageKey(pathname: string): string | null {
  if (pathname === "/") return "overview";
  const marketplaceMatch = pathname.match(/^\/marketplaces\/([^/]+)/);
  if (marketplaceMatch) return marketplaceMatch[1];
  if (pathname.startsWith("/rules-builder")) return "rules-builder";
  if (pathname.startsWith("/data-sync")) return "data-sync";
  if (pathname.startsWith("/settings")) return "settings";
  return null;
}
