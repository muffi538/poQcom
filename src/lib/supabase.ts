import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Singleton Supabase client — created once per process/bundle rather
// than per call site, so every caller shares the same underlying
// connection/auth state instead of each spinning up its own. Uses the
// public URL/anon key (safe to expose to the browser via NEXT_PUBLIC_*),
// not a service-role key, so this client is only as privileged as
// whatever Row Level Security policies allow.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env."
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
