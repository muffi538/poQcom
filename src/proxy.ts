import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolvePageKey } from "@/lib/auth/pages";
import { SESSION_COOKIE } from "@/lib/auth/constants";

// The single choke point for "is this request allowed at all" — runs
// before every page render (matcher below excludes static assets, the
// cron API route, and /login itself). Two things gate a request:
//   1. A valid, non-expired session for an enabled user (else -> /login).
//   2. That user's page-permission allow-list, when the path resolves to
//      a gated page key (else -> /no-access). Admins bypass this check
//      entirely and are the only ones allowed onto /admin or
//      /rules-builder — Rules Builder isn't a togglable per-user page
//      (see pages.ts), it's admin-only, full stop.
// Runs on the Edge runtime — no Node crypto here, just a Supabase REST
// lookup (fetch-based, edge-safe) and cookie/redirect logic. Password
// hashing/session-token generation happen only in Server Actions
// (Node runtime), never in middleware.
export const config = {
  matcher: ["/((?!_next/|api/|favicon.ico).*)"],
};

interface MiddlewareSessionRow {
  expires_at: string;
  app_users: {
    id: string;
    email: string;
    is_admin: boolean;
    is_enabled: boolean;
    user_page_permissions: { page_key: string }[];
  } | null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return redirectToLogin(request);

  const { data } = await supabase
    .from("app_sessions")
    .select("expires_at, app_users(id, email, is_admin, is_enabled, user_page_permissions(page_key))")
    .eq("token", token)
    .maybeSingle<MiddlewareSessionRow>();

  const user = data?.app_users;
  if (!data || !user || new Date(data.expires_at) < new Date() || !user.is_enabled) {
    return redirectToLogin(request, true);
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/rules-builder")) {
    if (!user.is_admin) return NextResponse.redirect(new URL("/no-access", request.url));
  } else if (pathname !== "/no-access" && !user.is_admin) {
    const pageKey = resolvePageKey(pathname);
    const allowed = user.user_page_permissions.some((p) => p.page_key === pageKey);
    if (pageKey && !allowed) return NextResponse.redirect(new URL("/no-access", request.url));
  }

  // Forwarded as request headers (not response headers) so Server
  // Components downstream — (app)/layout.tsx, the Sidebar — can read the
  // already-fetched user context via next/headers instead of querying
  // Supabase a second time on every render.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-email", user.email);
  requestHeaders.set("x-user-admin", user.is_admin ? "1" : "0");
  requestHeaders.set("x-user-pages", user.user_page_permissions.map((p) => p.page_key).join(","));
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function redirectToLogin(request: NextRequest, clearCookie = false) {
  const url = new URL("/login", request.url);
  if (request.nextUrl.pathname !== "/") url.searchParams.set("next", request.nextUrl.pathname);
  const response = NextResponse.redirect(url);
  if (clearCookie) response.cookies.delete(SESSION_COOKIE);
  return response;
}
