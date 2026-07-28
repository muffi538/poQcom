"use server";

import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword, validatePasswordStrength } from "@/lib/auth/password";
import { logActivity } from "@/lib/audit/log";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string(),
});

export interface ChangePasswordState {
  error?: string;
  success?: boolean;
}

// Self-service — any signed-in user changes their own password, proving
// they know the current one first. Distinct from admin/actions.ts's
// setUserPasswordAction, which lets an admin reset *someone else's*
// password without knowing their current one.
export async function changeOwnPasswordAction(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const user = await getSessionUser();
  if (!user) return { error: "You've been signed out. Please log in again." };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) return { error: "Enter your current and new password." };
  const { currentPassword, newPassword } = parsed.data;

  const { data: row, error: fetchError } = await supabase
    .from("app_users")
    .select("password_hash")
    .eq("id", user.id)
    .single();
  if (fetchError || !row) return { error: "Something went wrong. Try again." };

  if (!verifyPassword(currentPassword, row.password_hash)) {
    return { error: "Current password is incorrect." };
  }

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) return { error: strengthError };

  const { error: updateError } = await supabase
    .from("app_users")
    .update({ password_hash: hashPassword(newPassword) })
    .eq("id", user.id);
  if (updateError) return { error: "Something went wrong. Try again." };

  await logActivity({ action: "auth.password_changed", actorId: user.id, entityType: "app_user", entityId: user.id });
  return { success: true };
}
