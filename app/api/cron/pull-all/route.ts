import { NextResponse } from "next/server";
import { pullAllActiveSources } from "@/lib/supabase/cron-repo";

export const runtime = "nodejs";
// Allow up to 5 minutes for the full pull (Vercel Pro can extend further).
export const maxDuration = 300;

/**
 * Vercel Cron entry point. Runs on the schedule defined in vercel.json.
 *
 * Auth: Vercel Cron sets an Authorization header equal to "Bearer <CRON_SECRET>"
 * if CRON_SECRET is configured. We verify here so only Vercel Cron (or anyone
 * with the secret) can trigger ingestion. Manual testing: hit this route with
 * curl -H "Authorization: Bearer <secret>".
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, reason: "CRON_SECRET not configured on the server." },
      { status: 500 },
    );
  }
  const provided = req.headers.get("authorization");
  if (provided !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const results = await pullAllActiveSources();
    const totalAdded = results.reduce((sum, r) => sum + r.added, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    return NextResponse.json({
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      sourcesProcessed: results.length,
      totalAdded,
      totalSkipped,
      results,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        startedAt,
        finishedAt: new Date().toISOString(),
        reason: e instanceof Error ? e.message : "unknown error",
      },
      { status: 500 },
    );
  }
}
