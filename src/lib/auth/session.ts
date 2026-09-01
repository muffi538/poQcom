import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { supabase } from "@/lib/supabase";
import { SESSION_COOKIE } from "@/lib/auth/constants";

// Only ever imported from Server Components/Actions — never from
// middleware (next/headers isn't available there, see constants.ts) or
// a "use client" file — so the service-role Supabase client here stays
// server-side only, same boundary the rest of the app already relies on
// (see src/lib/supabase.ts).
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionUser {
  id: string;
  email: string;
  isAdmin: boolean;
  pageKeys: string[];
}

interface SessionRow {
  expires_at: string;
  app_users: {
    id: string;
    email: string;
    is_admin: boolean;
    is_enabled: boolean;
    user_page_permissions: { page_key: string }[];
  } | null;
}

// Opaque random token, not a signed JWT — revocation is just "delete the
// row" (or flip is_enabled), which every request re-checks, so a
// disabled account or a deleted user is locked out immediately instead
// of waiting for a token to expire.
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const { error } = await supabase.from("app_sessions").insert({ token, user_id: userId, expires_at: expiresAt.toISOString() });
  if (error) throw new Error(`Failed to create session: ${error.message}`);

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await supabase.from("app_sessions").delete().eq("token", token);
  jar.delete(SESSION_COOKIE);
}

// Sign-in is not required anywhere in this app (deliberate: the
// dashboard, Admin, and Rules Builder are all open to anyone with the
// link, no account needed). A real login still works if someone signs
// in explicitly — getSessionUser reflects that real session — but an
// anonymous visitor is treated as a full admin (PUBLIC_USER below)
// rather than being turned away, so every existing permission check
// (isAdmin, pageKeys, requireAdmin, requirePagePermission) still passes
// without each needing its own "no login required" special case.
const PUBLIC_USER: SessionUser = { id: "anonymous", email: "anonymous", isAdmin: true, pageKeys: [] };

export async function getSessionUser(): Promise<SessionUser> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return PUBLIC_USER;

  const { data } = await supabase
    .from("app_sessions")
    .select("expires_at, app_users(id, email, is_admin, is_enabled, user_page_permissions(page_key))")
    .eq("token", token)
    .maybeSingle<SessionRow>();

  if (!data || !data.app_users) return PUBLIC_USER;
  if (new Date(data.expires_at) < new Date() || !data.app_users.is_enabled) return PUBLIC_USER;

  return {
    id: data.app_users.id,
    email: data.app_users.email,
    isAdmin: data.app_users.is_admin,
    pageKeys: data.app_users.user_page_permissions.map((p) => p.page_key),
  };
}

// PUBLIC_USER is always isAdmin, so this never actually throws today —
// kept as the single choke point so re-requiring sign-in later (see
// PUBLIC_USER above) restores real enforcement here with no other
// changes needed.
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user.isAdmin) throw new Error("Admin access required.");
  return user;
}

// Defense-in-depth for Server Actions bound to a permission-gated page
// (e.g. Data Sync) — proxy.ts already blocks navigating to the page
// itself, but a Server Action is its own callable endpoint, so it
// re-checks the same permission independently rather than trusting that
// only an authorized user could ever have triggered it.
export async function requirePagePermission(pageKey: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user.isAdmin && !user.pageKeys.includes(pageKey)) throw new Error("You don't have permission to do that.");
  return user;
}
