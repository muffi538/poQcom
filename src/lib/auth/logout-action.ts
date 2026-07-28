"use server";

import { redirect } from "next/navigation";
import { getSessionUser, destroySession } from "@/lib/auth/session";
import { logActivity } from "@/lib/audit/log";

export async function logoutAction() {
  const user = await getSessionUser();
  await destroySession();
  if (user) await logActivity({ action: "auth.logout", actorId: user.id });
  redirect("/login");
}
