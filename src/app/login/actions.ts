"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { isLoginRateLimited, recordLoginAttempt } from "@/lib/auth/rate-limit";
import { logActivity } from "@/lib/audit/log";

export interface LoginState {
  error?: string;
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  next: z.string().default("/"),
});

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const { email, password, next } = parsed.data;

  // Checked before touching the password at all — a lockout can't be
  // bypassed by finally guessing right, and this can't be used to probe
  // whether an email exists (same generic message either way).
  if (await isLoginRateLimited(email)) {
    await logActivity({ action: "auth.login_blocked", metadata: { email } });
    return { error: "Too many failed attempts. Try again in a few minutes." };
  }

  const { data: user } = await supabase
    .from("app_users")
    .select("id, password_hash, is_enabled")
    .eq("email", email)
    .maybeSingle();

  const passwordOk = user ? verifyPassword(password, user.password_hash) : false;

  if (!user || !passwordOk) {
    await recordLoginAttempt(email, false);
    await logActivity({ action: "auth.login_failed", metadata: { email } });
    return { error: "Invalid email or password." };
  }
  if (!user.is_enabled) {
    await recordLoginAttempt(email, false);
    await logActivity({ action: "auth.login_failed", actorId: user.id, metadata: { email, reason: "disabled" } });
    return { error: "This account has been disabled. Contact your admin." };
  }

  await recordLoginAttempt(email, true);
  await logActivity({ action: "auth.login_succeeded", actorId: user.id, metadata: { email } });
  await createSession(user.id);
  redirect(next.startsWith("/") ? next : "/");
}
