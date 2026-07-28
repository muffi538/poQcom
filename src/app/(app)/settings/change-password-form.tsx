"use client";

import { useActionState } from "react";
import { changeOwnPasswordAction, ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = {};

const inputClasses =
  "w-full rounded-lg border border-frido-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-neutral-500";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changeOwnPasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-3" key={state.success ? "done" : "form"}>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">Current password</label>
        <input name="currentPassword" type="password" required className={inputClasses} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">New password</label>
        <input name="newPassword" type="password" required className={inputClasses} />
        <p className="mt-1 text-[11px] text-neutral-400">At least 10 characters, 3 of: lowercase/uppercase/numbers/symbols.</p>
      </div>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="text-xs text-green-700">Password updated.</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
      >
        {pending ? "Updating…" : "Change password"}
      </button>
    </form>
  );
}
