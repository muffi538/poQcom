import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-only service-role client — every table's RLS denies the anon
// role by default (see supabase/migrations/0014_lock_down_rls.sql), so
// the app's own server code needs the service-role key to read/write
// anything at all. This file is never imported by a "use client"
// component (confirmed: the whole app only ever talks to Supabase from
// Server Components/Actions/proxy.ts) — SUPABASE_SERVICE_ROLE_KEY is
// NOT prefixed NEXT_PUBLIC_, so Next.js never inlines it into a
// browser bundle even if that changed by accident; it simply wouldn't
// resolve client-side.
//
// Authorization for what an individual logged-in user can see/do lives
// in the Next.js app layer (src/proxy.ts + src/lib/auth/*), not in
// Postgres RLS — this client is intentionally as privileged as the
// database allows, same as any other server-side ORM/admin connection.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (the service-role key, from Project Settings → API — never the anon key)."
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
