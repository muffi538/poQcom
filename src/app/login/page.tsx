import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-card w-full max-w-sm rounded-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-frido-yellow text-sm font-black text-black">
            F
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Frido Control Tower</div>
            <div className="text-[11px] text-neutral-500">Sign in to continue</div>
          </div>
        </div>
        <LoginForm next={next ?? "/"} />
      </div>
    </div>
  );
}
