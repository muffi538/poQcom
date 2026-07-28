import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/logout-action";
import { MarketplaceThemeScope } from "@/components/theme/marketplace-theme-scope";
import { ChangePasswordForm } from "./change-password-form";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <MarketplaceThemeScope marketplace={null}>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-neutral-500">Your account.</p>
        </div>

        <div className="glass-card rounded-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Account</h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Signed in as <span className="font-medium text-neutral-900 dark:text-neutral-100">{user.email}</span>
            {user.isAdmin && " (admin)"}
          </p>
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-frido-border px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <LogOut size={13} />
              Log out
            </button>
          </form>
        </div>

        <div className="glass-card rounded-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Change password</h2>
          <p className="mt-1 text-sm text-neutral-500">Requires your current password.</p>
          <div className="mt-3">
            <ChangePasswordForm />
          </div>
        </div>
      </div>
    </MarketplaceThemeScope>
  );
}
