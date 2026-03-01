import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["supervisor"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  let body: { run_sheet_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.run_sheet_id) {
    return NextResponse.json(
      { error: "run_sheet_id is required" },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();

  const { data: runSheet, error: fetchError } = await supabase
    .from("run_sheets")
    .select("id, project_id, status")
    .eq("id", body.run_sheet_id)
    .single();

  if (fetchError || !runSheet) {
    return NextResponse.json({ error: "Run sheet not found" }, { status: 404 });
  }
  if (runSheet.project_id !== payload.project_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (runSheet.status !== "approved_pending_lock") {
    return NextResponse.json(
      { error: "Run sheet must be in approved_pending_lock status" },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("run_sheets")
    .update({
      supervisor_confirmed_at: new Date().toISOString(),
      supervisor_confirmed_by_label: payload.label ?? "Supervisor",
    })
    .eq("id", body.run_sheet_id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to confirm" },
      { status: 500 }
    );
  }
  return NextResponse.json(updated);
}
