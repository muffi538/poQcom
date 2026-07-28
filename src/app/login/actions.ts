"use server";

import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) return { error: "Enter your email and password." };

  const { data: user } = await supabase
    .from("app_users")
    .select("id, password_hash, is_enabled")
    .eq("email", email)
    .maybeSingle();

  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: "Invalid email or password." };
  }
  if (!user.is_enabled) {
    return { error: "This account has been disabled. Contact your admin." };
  }

  await createSession(user.id);
  redirect(next.startsWith("/") ? next : "/");
}
