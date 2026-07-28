import Link from "next/link";
import { redirect } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth/session";
import { ALL_PAGES } from "@/lib/auth/pages";
import { AdminPanel, AdminUserRow } from "./admin-panel";

// Middleware already restricts /admin to is_admin accounts — this check
// is just defense-in-depth for the one Server Component that actually
// renders every user's email/password-reset controls.
export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || !user.isAdmin) redirect("/no-access");

  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, is_admin, is_enabled, created_at, user_page_permissions(page_key)")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load users: ${error.message}`);

  const users: AdminUserRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    email: row.email as string,
    isAdmin: row.is_admin as boolean,
    isEnabled: row.is_enabled as boolean,
    createdAt: row.created_at as string,
    pageKeys: (row.user_page_permissions as { page_key: string }[]).map((p) => p.page_key),
  }));

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="text-sm text-neutral-500">
            Create and manage logins. Only accounts added here can sign in — there&apos;s no
            self-signup.
          </p>
        </div>
        {/* Rules Builder lives here, not in the main sidebar — it's a
            backend/admin tool, not something regular users should ever
            see in the public dashboard nav. */}
        <Link
          href="/rules-builder"
          className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-800"
        >
          <SlidersHorizontal size={13} />
          Rules Builder
        </Link>
      </div>
      <AdminPanel users={users} allPages={ALL_PAGES} currentUserId={user.id} />
    </div>
  );
}
