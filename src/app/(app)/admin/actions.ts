"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/session";

export async function createUserAction(params: { email: string; password: string; pageKeys: string[] }): Promise<void> {
  await requireAdmin();
  const email = params.email.trim().toLowerCase();
  if (!email || !params.password) throw new Error("Email and password are required.");
  if (params.password.length < 6) throw new Error("Password must be at least 6 characters.");

  const { data: user, error } = await supabase
    .from("app_users")
    .insert({ email, password_hash: hashPassword(params.password) })
    .select("id")
    .single();
  if (error) {
    throw new Error(error.code === "23505" ? "A user with this email already exists." : error.message);
  }

  if (params.pageKeys.length > 0) {
    const { error: permError } = await supabase
      .from("user_page_permissions")
      .insert(params.pageKeys.map((page_key) => ({ user_id: user.id, page_key })));
    if (permError) throw new Error(permError.message);
  }
  revalidatePath("/admin");
}

export async function deleteUserAction(userId: string): Promise<void> {
  const admin = await requireAdmin();
  if (admin.id === userId) throw new Error("You can't delete your own account.");
  const { error } = await supabase.from("app_users").delete().eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function setUserEnabledAction(userId: string, isEnabled: boolean): Promise<void> {
  const admin = await requireAdmin();
  if (admin.id === userId && !isEnabled) throw new Error("You can't disable your own account.");
  const { error } = await supabase.from("app_users").update({ is_enabled: isEnabled }).eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function setUserPasswordAction(userId: string, newPassword: string): Promise<void> {
  await requireAdmin();
  if (!newPassword || newPassword.length < 6) throw new Error("Password must be at least 6 characters.");
  const { error } = await supabase.from("app_users").update({ password_hash: hashPassword(newPassword) }).eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function setUserPermissionsAction(userId: string, pageKeys: string[]): Promise<void> {
  await requireAdmin();
  const { error: delError } = await supabase.from("user_page_permissions").delete().eq("user_id", userId);
  if (delError) throw new Error(delError.message);
  if (pageKeys.length > 0) {
    const { error: insError } = await supabase
      .from("user_page_permissions")
      .insert(pageKeys.map((page_key) => ({ user_id: userId, page_key })));
    if (insError) throw new Error(insError.message);
  }
  revalidatePath("/admin");
}
