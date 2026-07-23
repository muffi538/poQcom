import { NextRequest, NextResponse } from "next/server";
import { runScheduledSync } from "@/lib/sync/scheduler";

// Hit on a fixed, coarse schedule (see vercel.json — every 5 minutes,
// the finest of the configurable intervals) by Vercel Cron or any
// external scheduler; runScheduledSync itself decides whether the
// configured auto-sync interval has actually elapsed, so this route can
// be pinged more often than the real sync cadence without doing
// anything on the ticks that aren't due.
//
// Protected by CRON_SECRET (set in .env / hosting provider's env vars) —
// checked against the Authorization header Vercel Cron sends
// automatically, or an external scheduler must send the same header.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const outcome = await runScheduledSync();
    return NextResponse.json(outcome);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ran: false, error: message }, { status: 500 });
  }
}
