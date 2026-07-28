"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, KeyRound, Loader2 } from "lucide-react";
import { PageDef } from "@/lib/auth/pages";
import {
  createUserAction,
  deleteUserAction,
  setUserEnabledAction,
  setUserPasswordAction,
  setUserPermissionsAction,
} from "./actions";

export interface AdminUserRow {
  id: string;
  email: string;
  isAdmin: boolean;
  isEnabled: boolean;
  createdAt: string;
  pageKeys: string[];
}

const inputClasses =
  "w-full rounded-lg border border-frido-border bg-white px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-neutral-500";

function groupPages(pages: PageDef[]) {
  return {
    main: pages.filter((p) => p.group === "main"),
    marketplace: pages.filter((p) => p.group === "marketplace"),
    tools: pages.filter((p) => p.group === "tools"),
  };
}

function PermissionGrid({
  allPages,
  selected,
  onToggle,
  disabled,
}: {
  allPages: PageDef[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  disabled?: boolean;
}) {
  const groups = groupPages(allPages);
  return (
    <div className="grid grid-cols-3 gap-4">
      {(["main", "marketplace", "tools"] as const).map((groupKey) =>
        groups[groupKey].length === 0 ? null : (
          <div key={groupKey} className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              {groupKey === "main" ? "Main" : groupKey === "marketplace" ? "Marketplaces" : "Tools"}
            </div>
            {groups[groupKey].map((page) => (
              <label key={page.key} className="flex items-center gap-1.5 text-xs text-neutral-700">
                <input
                  type="checkbox"
                  checked={selected.has(page.key)}
                  disabled={disabled}
                  onChange={() => onToggle(page.key)}
                  className="h-3.5 w-3.5"
                />
                {page.label}
              </label>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function AddUserForm({ allPages }: { allPages: PageDef[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pageKeys, setPageKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = (key: string) =>
    setPageKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const submit = () => {
    setError(null);
    startTransition(async () => {
      try {
        await createUserAction({ email, password, pageKeys: Array.from(pageKeys) });
        setEmail("");
        setPassword("");
        setPageKeys(new Set());
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create user.");
      }
    });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-800"
      >
        + Add User
      </button>
    );
  }

  return (
    <div className="glass-card space-y-3 rounded-card p-4">
      <h3 className="text-xs font-semibold">Add User</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputClasses} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Temporary password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="text" className={inputClasses} />
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-neutral-600">Page access</div>
        <PermissionGrid allPages={allPages} selected={pageKeys} onToggle={toggle} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending || !email || !password}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending && <Loader2 size={12} className="animate-spin" />}
          Create
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg border border-frido-border px-3 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function UserRow({ user, allPages, isSelf }: { user: AdminUserRow; allPages: PageDef[]; isSelf: boolean }) {
  const router = useRouter();
  const [pageKeys, setPageKeys] = useState<Set<string>>(new Set(user.pageKeys));
  const [expanded, setExpanded] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runAction = (fn: () => Promise<void>, successMessage?: string) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await fn();
        if (successMessage) setMessage(successMessage);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  };

  const togglePermission = (key: string) => {
    const next = new Set(pageKeys);
    next.has(key) ? next.delete(key) : next.add(key);
    setPageKeys(next);
    runAction(() => setUserPermissionsAction(user.id, Array.from(next)));
  };

  return (
    <div className="glass-card rounded-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="min-w-0 flex-1 text-left"
          title={user.isAdmin ? "Admin accounts always have full access" : "Click to edit page access"}
        >
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{user.email}</span>
            {user.isAdmin && (
              <span className="shrink-0 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                ADMIN
              </span>
            )}
            {!user.isEnabled && (
              <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                DISABLED
              </span>
            )}
          </div>
          {!user.isAdmin && (
            <div className="text-[11px] text-neutral-500">
              {pageKeys.size === 0 ? "No page access granted" : `${pageKeys.size} page${pageKeys.size === 1 ? "" : "s"} allowed`}
            </div>
          )}
        </button>

        {!user.isAdmin && (
          <button
            onClick={() => runAction(() => setUserEnabledAction(user.id, !user.isEnabled))}
            disabled={pending || (isSelf && user.isEnabled)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
              user.isEnabled
                ? "border-frido-border text-neutral-600 hover:bg-neutral-50"
                : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
            }`}
          >
            {user.isEnabled ? "Disable" : "Enable"}
          </button>
        )}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="rounded-lg border border-frido-border px-2.5 py-1 text-xs text-neutral-600 transition-colors hover:bg-neutral-50"
        >
          {expanded ? "Close" : "Manage"}
        </button>
        {!user.isAdmin && (
          <button
            onClick={() => {
              if (confirm(`Delete ${user.email}? This cannot be undone.`)) runAction(() => deleteUserAction(user.id));
            }}
            disabled={pending}
            className="rounded-lg border border-red-200 p-1.5 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            title="Delete user"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {message && <p className="mt-2 text-xs text-green-700">{message}</p>}

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-frido-border pt-3">
          {!user.isAdmin && (
            <div>
              <div className="mb-1 text-xs font-medium text-neutral-600">Page access</div>
              <PermissionGrid allPages={allPages} selected={pageKeys} onToggle={togglePermission} disabled={pending} />
            </div>
          )}
          <div>
            <div className="mb-1 text-xs font-medium text-neutral-600">Set / reset password</div>
            <div className="flex gap-2">
              <input
                value={passwordDraft}
                onChange={(e) => setPasswordDraft(e.target.value)}
                type="text"
                placeholder="New password"
                className={`${inputClasses} max-w-xs`}
              />
              <button
                onClick={() =>
                  runAction(async () => {
                    await setUserPasswordAction(user.id, passwordDraft);
                    setPasswordDraft("");
                  }, "Password updated.")
                }
                disabled={pending || passwordDraft.length < 6}
                className="flex items-center gap-1.5 rounded-lg border border-frido-border px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
              >
                <KeyRound size={12} />
                Set password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminPanel({
  users,
  allPages,
  currentUserId,
}: {
  users: AdminUserRow[];
  allPages: PageDef[];
  currentUserId: string;
}) {
  return (
    <div className="space-y-3">
      <AddUserForm allPages={allPages} />
      <div className="space-y-2">
        {users.map((u) => (
          <UserRow key={u.id} user={u} allPages={allPages} isSelf={u.id === currentUserId} />
        ))}
      </div>
    </div>
  );
}
