import { ShieldAlert } from "lucide-react";

// Reachable regardless of page permissions (the proxy skips the
// per-page check for this exact path) — it's the safe landing spot when
// a permission-denied redirect can't just go to "/" (a user with zero
// granted pages, including Overview, would otherwise redirect-loop).
export default function NoAccessPage() {
  return (
    <div className="flex h-full min-h-[70vh] flex-col items-center justify-center gap-2 text-center">
      <ShieldAlert size={28} className="text-neutral-400" />
      <h1 className="text-base font-semibold">Access denied</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        You don&apos;t have permission to view this page. Contact your admin if you think this is a
        mistake.
      </p>
    </div>
  );
}
