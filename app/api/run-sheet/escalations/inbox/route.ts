import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/run-sheet/escalations/inbox?label=...
 * Auth: owner. Returns open escalations for projects the owner has access to
 * where assigned_to = label OR assigned_to is null (unassigned).
 * Query "label" is the owner's label (e.g. from token); can be passed for UI or use payload.label.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["owner"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  const url = new URL(request.url);
  const labelParam = url.searchParams.get("label");
  const label = (labelParam ?? payload.label ?? "").trim();

  const supabase = createServerSupabaseClient();
  const { data: escalations, error } = await supabase
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
    .eq("project_id", payload.project_id)
    .eq("resolved", false)
    .order("level", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to fetch inbox" },
      { status: 500 }
    );
  }

  const filtered = (escalations ?? []).filter((e) => {
    const meta = (e.metadata as { assigned_to?: string } | null) ?? {};
    const assignedTo = meta.assigned_to;
    return !assignedTo || assignedTo === label;
  });

  const dayIds = [...new Set(filtered.map((e) => e.run_sheet_day_id).filter(Boolean))] as string[];
  let days: Record<string, { day_number: number; calendar_date: string | null }> = {};
  if (dayIds.length > 0) {
    const { data: dayRows } = await supabase
      .from("run_sheet_days")
      .select("id, day_number, calendar_date")
      .in("id", dayIds);
    for (const d of dayRows ?? []) {
      days[d.id] = d;
    }
  }

  const withDays = filtered.map((e) => ({
    ...e,
    run_sheet_day: e.run_sheet_day_id ? days[e.run_sheet_day_id] ?? null : null,
  }));

  return NextResponse.json(withDays);
}
