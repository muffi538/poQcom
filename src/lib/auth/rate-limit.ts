import { supabase } from "@/lib/supabase";

// 5 failed attempts per email within 15 minutes blocks further tries
// for the rest of that window — deliberately checked BEFORE verifying
// the submitted password, so a lockout can't be bypassed by finally
// guessing right (the check doesn't care if this attempt would have
// succeeded).
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export async function isLoginRateLimited(email: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .eq("success", false)
    .gte("created_at", since);
  if (error) {
    // Fail open on a rate-limit infrastructure error — an outage here
    // shouldn't lock every user out of the app, and the login itself
    // still requires a correct password regardless.
    console.error("[rate-limit] failed to check login attempts:", error.message);
    return false;
  }
  return (count ?? 0) >= MAX_FAILED_ATTEMPTS;
}

export async function recordLoginAttempt(email: string, success: boolean): Promise<void> {
  const { error } = await supabase.from("login_attempts").insert({ email, success });
  if (error) console.error("[rate-limit] failed to record login attempt:", error.message);
}
