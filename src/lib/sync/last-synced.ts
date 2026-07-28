import { supabase } from "@/lib/supabase";

// Most recent successful sync across every job type (PO/sales/dispatch)
// — a single "when was data last refreshed" timestamp for the sidebar,
// not scoped to any one marketplace or workbook.
export async function getLastSyncedAt(): Promise<string | null> {
  const { data } = await supabase
    .from("sync_jobs")
    .select("completed_at")
    .eq("status", "success")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.completed_at as string | undefined) ?? null;
}
