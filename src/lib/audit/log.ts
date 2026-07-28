import { supabase } from "@/lib/supabase";

// One shared audit trail (the pre-existing activity_logs table — see
// supabase/migrations/0001) for every security-relevant event: login
// attempts, admin actions, permission changes, sync/import triggers.
// Never pass a password or session token in `metadata` — this is a
// hard rule, not just a convention, since these rows are permanent and
// readable by anyone with database access.
export type AuditAction =
  | "auth.login_succeeded"
  | "auth.login_failed"
  | "auth.login_blocked" // rate-limited
  | "auth.logout"
  | "auth.password_changed"
  | "admin.user_created"
  | "admin.user_deleted"
  | "admin.user_enabled"
  | "admin.user_disabled"
  | "admin.password_reset"
  | "admin.permissions_changed"
  | "sync.triggered"
  | "sheet_connection.saved"
  | "sheet_connection.toggled"
  | "settings.auto_sync_changed";

export interface AuditLogParams {
  action: AuditAction;
  actorId?: string | null; // app_users.id — null for unauthenticated attempts (e.g. a failed login)
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

// Logging failures must never break the action being logged — a typo in
// a metadata field shouldn't turn a successful password reset into a
// user-facing 500. Swallow and let the caller carry on.
export async function logActivity(params: AuditLogParams): Promise<void> {
  try {
    const { error } = await supabase.from("activity_logs").insert({
      actor_id: params.actorId ?? null,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? null,
    });
    if (error) console.error(`[audit] failed to log "${params.action}":`, error.message);
  } catch (err) {
    console.error(`[audit] failed to log "${params.action}":`, err);
  }
}
