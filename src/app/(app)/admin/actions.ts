"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/session";
import { logActivity } from "@/lib/audit/log";
import { ALL_PAGES } from "@/lib/auth/pages";

const VALID_PAGE_KEYS = new Set(ALL_PAGES.map((p) => p.key));
const uuidSchema = z.string().uuid();
const pageKeysSchema = z
  .array(z.string())
  .refine((keys) => keys.every((k) => VALID_PAGE_KEYS.has(k)), "Unknown page key.");

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string(),
  pageKeys: pageKeysSchema,
});

// Returned instead of thrown: Next.js redacts thrown Server Action error
// messages in production (replaced with a generic "digest" message), so
// expected validation failures (weak password, duplicate email, ...) must
// come back as data or the client never sees why the action failed.
export interface ActionResult {
  error?: string;
}

export async function createUserAction(params: {
  email: string;
  password: string;
  pageKeys: string[];
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = createUserSchema.safeParse(params);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { email, password, pageKeys } = parsed.data;

  const strengthError = validatePasswordStrength(password);
  if (strengthError) return { error: strengthError };

  const { data: user, error } = await supabase
    .from("app_users")
    .insert({ email, password_hash: hashPassword(password) })
    .select("id")
    .single();
  if (error) {
    return { error: error.code === "23505" ? "A user with this email already exists." : error.message };
  }

  if (pageKeys.length > 0) {
    const { error: permError } = await supabase
      .from("user_page_permissions")
      .insert(pageKeys.map((page_key) => ({ user_id: user.id, page_key })));
    if (permError) return { error: permError.message };
  }
  await logActivity({
    action: "admin.user_created",
    actorId: admin.id,
    entityType: "app_user",
    entityId: user.id,
    metadata: { email, pageKeys },
  });
  revalidatePath("/admin");
  return {};
}

export async function deleteUserAction(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsedId = uuidSchema.safeParse(userId);
  if (!parsedId.success) return { error: "Invalid user id." };
  if (admin.id === userId) return { error: "You can't delete your own account." };

  const { error } = await supabase.from("app_users").delete().eq("id", userId);
  if (error) return { error: error.message };
  await logActivity({ action: "admin.user_deleted", actorId: admin.id, entityType: "app_user", entityId: userId });
  revalidatePath("/admin");
  return {};
}

export async function setUserEnabledAction(userId: string, isEnabled: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsedId = uuidSchema.safeParse(userId);
  if (!parsedId.success) return { error: "Invalid user id." };
  if (admin.id === userId && !isEnabled) return { error: "You can't disable your own account." };

  const { error } = await supabase.from("app_users").update({ is_enabled: isEnabled }).eq("id", userId);
  if (error) return { error: error.message };
  await logActivity({
    action: isEnabled ? "admin.user_enabled" : "admin.user_disabled",
    actorId: admin.id,
    entityType: "app_user",
    entityId: userId,
  });
  revalidatePath("/admin");
  return {};
}

export async function setUserPasswordAction(userId: string, newPassword: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsedId = uuidSchema.safeParse(userId);
  if (!parsedId.success) return { error: "Invalid user id." };

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) return { error: strengthError };

  const { error } = await supabase.from("app_users").update({ password_hash: hashPassword(newPassword) }).eq("id", userId);
  if (error) return { error: error.message };
  // Never log the password itself — only that a reset happened, by whom, for whom.
  await logActivity({ action: "admin.password_reset", actorId: admin.id, entityType: "app_user", entityId: userId });
  return {};
}

export async function setUserPermissionsAction(userId: string, pageKeys: string[]): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsedId = uuidSchema.safeParse(userId);
  if (!parsedId.success) return { error: "Invalid user id." };
  const parsedKeys = pageKeysSchema.safeParse(pageKeys);
  if (!parsedKeys.success) return { error: parsedKeys.error.issues[0]?.message ?? "Invalid page keys." };

  const { error: delError } = await supabase.from("user_page_permissions").delete().eq("user_id", userId);
  if (delError) return { error: delError.message };
  if (parsedKeys.data.length > 0) {
    const { error: insError } = await supabase
      .from("user_page_permissions")
      .insert(parsedKeys.data.map((page_key) => ({ user_id: userId, page_key })));
    if (insError) return { error: insError.message };
  }
  await logActivity({
    action: "admin.permissions_changed",
    actorId: admin.id,
    entityType: "app_user",
    entityId: userId,
    metadata: { pageKeys: parsedKeys.data },
  });
  revalidatePath("/admin");
  return {};
}
