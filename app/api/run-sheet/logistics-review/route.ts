import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/run-sheet/logistics-review
 * Auth: owner or supervisor. Body: { project_id, week_start_date } (YYYY-MM-DD, Monday).
 * Inserts weekly_logistics_reviews and resolves open weekly_logistics_not_confirmed escalations for that project/week.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["owner", "supervisor"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  let body: { project_id: string; week_start_date: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.project_id || !body.week_start_date) {
    return NextResponse.json(
      { error: "project_id and week_start_date are required" },
      { status: 400 }
    );
  }
  if (payload.project_id !== body.project_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServerSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", body.project_id)
    .single();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { error: insertError } = await supabase.from("weekly_logistics_reviews").upsert(
    {
      project_id: body.project_id,
      week_start_date: body.week_start_date,
      confirmed_at: new Date().toISOString(),
      confirmed_by_label: payload.label ?? "user",
    },
    { onConflict: "project_id,week_start_date" }
  );
  if (insertError) {
    return NextResponse.json(
      { error: insertError.message ?? "Failed to save review" },
      { status: 500 }
    );
  }

  const { data: openWeekly } = await supabase
    .from("run_sheet_escalations")
    .select("id, metadata")
    .eq("project_id", body.project_id)
    .eq("escalation_type", "weekly_logistics_not_confirmed")
    .eq("resolved", false);
  const toResolve = (openWeekly ?? []).filter(
    (e) => (e.metadata as { week_start?: string } | null)?.week_start === body.week_start_date
  );
  for (const row of toResolve) {
    await supabase
      .from("run_sheet_escalations")
      .update({
        resolved: true,
        resolved_by_label: payload.label ?? "user",
        resolved_at: new Date().toISOString(),
        resolution_note: "Weekly logistics check completed",
      })
      .eq("id", row.id);
  }

  return NextResponse.json({ ok: true, week_start_date: body.week_start_date });
}
