import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { SESSION_COOKIE } from "@/lib/auth/constants";

// Sign-in is not required anywhere in this app (deliberate — see
// PUBLIC_USER in src/lib/auth/session.ts, the matching change on the
// Server Action side). A request with no session, or an expired/invalid
// one, is no longer redirected to /login — it's treated as a full admin
// (PUBLIC_ADMIN_HEADERS below), same as every other permission check in
// the app now does. A request that DOES carry a valid session still gets
// that real user's actual permissions, so a real login keeps working
// exactly as before; nothing here stops someone from still using one.
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

const PUBLIC_ADMIN_HEADERS: Record<string, string> = { "x-user-email": "anonymous", "x-user-admin": "1", "x-user-pages": "" };

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/login") return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.next({ request: { headers: withHeaders(request, PUBLIC_ADMIN_HEADERS) } });

  const { data } = await supabase
    .from("app_sessions")
    .select("expires_at, app_users(id, email, is_admin, is_enabled, user_page_permissions(page_key))")
    .eq("token", token)
    .maybeSingle<MiddlewareSessionRow>();

  const user = data?.app_users;
  if (!data || !user || new Date(data.expires_at) < new Date() || !user.is_enabled) {
    return NextResponse.next({ request: { headers: withHeaders(request, PUBLIC_ADMIN_HEADERS) } });
  }

  // Forwarded as request headers (not response headers) so Server
  // Components downstream — (app)/layout.tsx, the Sidebar — can read the
  // already-fetched user context via next/headers instead of querying
  // Supabase a second time on every render.
  return NextResponse.next({
    request: {
      headers: withHeaders(request, {
        "x-user-email": user.email,
        "x-user-admin": user.is_admin ? "1" : "0",
        "x-user-pages": user.user_page_permissions.map((p) => p.page_key).join(","),
      }),
    },
  });
}

function withHeaders(request: NextRequest, headers: Record<string, string>): Headers {
  const requestHeaders = new Headers(request.headers);
  for (const [key, value] of Object.entries(headers)) requestHeaders.set(key, value);
  return requestHeaders;
}
