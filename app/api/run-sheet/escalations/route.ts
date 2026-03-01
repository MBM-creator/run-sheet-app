import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/run-sheet/escalations?project_id=...&open_only=true
 * Auth: owner or supervisor; restricted to payload.project_id (must match query project_id).
 * Returns open escalations for the project with run_sheet_day details.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["owner", "supervisor"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  const url = new URL(request.url);
  const projectId = url.searchParams.get("project_id");
  const openOnly = url.searchParams.get("open_only") !== "false";

  if (!projectId) {
    return NextResponse.json(
      { error: "project_id query is required" },
      { status: 400 }
    );
  }
  if (payload.project_id !== projectId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("run_sheet_escalations")
    .select(`
      id,
      project_id,
      run_sheet_id,
      run_sheet_day_id,
      escalation_type,
      level,
      reason,
      metadata,
      created_by_label,
      created_at,
      resolved,
      resolved_by_label,
      resolved_at,
      resolution_note
    `)
    .eq("project_id", projectId)
    .order("level", { ascending: false })
    .order("created_at", { ascending: true });

  if (openOnly) query = query.eq("resolved", false);

  const { data: escalations, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to fetch escalations" },
      { status: 500 }
    );
  }

  const dayIds = [...new Set((escalations ?? []).map((e) => e.run_sheet_day_id).filter(Boolean))] as string[];
  let days: Record<string, { day_number: number; calendar_date: string | null; outcomes_text: string | null; cutoff_datetime: string | null; cutoff_confirmed_at: string | null }> = {};
  if (dayIds.length > 0) {
    const { data: dayRows } = await supabase
      .from("run_sheet_days")
      .select("id, day_number, calendar_date, outcomes_text, cutoff_datetime, cutoff_confirmed_at")
      .in("id", dayIds);
    for (const d of dayRows ?? []) {
      days[d.id] = d;
    }
  }

  const withDays = (escalations ?? []).map((e) => ({
    ...e,
    run_sheet_day: e.run_sheet_day_id ? days[e.run_sheet_day_id] ?? null : null,
  }));

  return NextResponse.json(withDays);
}
