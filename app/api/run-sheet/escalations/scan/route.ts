import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { runEscalationsScan } from "@/lib/run-sheet/escalations-scanner";

/**
 * POST /api/run-sheet/escalations/scan
 * Auth: (1) Cron: header x-cron-secret === CRON_SECRET; (2) Manual: owner token (scans only that project).
 * Returns { created, byType, resolved, summary }.
 */
export async function POST(request: NextRequest) {
  const cronSecret =
    request.headers.get("x-cron-secret") ??
    new URL(request.url).searchParams.get("cron_secret");
  const expectedCron = process.env.CRON_SECRET;

  if (expectedCron && cronSecret === expectedCron) {
    const supabase = createServerSupabaseClient();
    const result = await runEscalationsScan(supabase, {});
    return NextResponse.json({
      ...result,
      summary: `Created ${result.created}, resolved ${result.resolved}`,
    });
  }

  const auth = await requireAuth(request, ["owner"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  const supabase = createServerSupabaseClient();
  const result = await runEscalationsScan(supabase, { projectId: payload.project_id });
  return NextResponse.json({
    ...result,
    summary: `Created ${result.created}, resolved ${result.resolved}`,
  });
}
