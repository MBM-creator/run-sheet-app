import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Unconfirm cut-off for a run_sheet_day. Owner only.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["owner"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  let body: { project_id: string; run_sheet_day_id: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.project_id || !body.run_sheet_day_id) {
    return NextResponse.json(
      { error: "project_id and run_sheet_day_id are required" },
      { status: 400 }
    );
  }
  if (payload.project_id !== body.project_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServerSupabaseClient();

  const { data: day, error: dayError } = await supabase
    .from("run_sheet_days")
    .select("id, run_sheet_id")
    .eq("id", body.run_sheet_day_id)
    .single();

  if (dayError || !day) {
    return NextResponse.json({ error: "Run sheet day not found" }, { status: 404 });
  }

  const { data: runSheet } = await supabase
    .from("run_sheets")
    .select("id, project_id")
    .eq("id", day.run_sheet_id)
    .single();

  if (!runSheet || runSheet.project_id !== body.project_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("run_sheet_days")
    .update({
      cutoff_confirmed_at: null,
      cutoff_confirmed_by_label: null,
      cutoff_confirm_note: body.reason?.trim() ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.run_sheet_day_id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to unconfirm" },
      { status: 500 }
    );
  }
  return NextResponse.json(updated);
}
