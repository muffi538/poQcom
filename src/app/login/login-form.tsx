"use client";

import { useActionState } from "react";
import { loginAction, LoginState } from "./actions";

const initialState: LoginState = {};

const inputClasses =
  "w-full rounded-lg border border-frido-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-neutral-500";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">Email</label>
        <input name="email" type="email" required autoFocus className={inputClasses} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">Password</label>
        <input name="password" type="password" required className={inputClasses} />
      </div>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
