import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["owner", "supervisor"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  let body: {
    project_id: string;
    run_sheet_day_id: string;
    status: "complete" | "partial" | "missed";
    reason?: "weather" | "variation" | "other";
    explanation?: string;
    recovery_plan?: string;
    actual_notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.project_id || !body.run_sheet_day_id || !body.status) {
    return NextResponse.json(
      { error: "project_id, run_sheet_day_id, and status are required" },
      { status: 400 }
    );
  }
  if (payload.project_id !== body.project_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.status !== "complete") {
    if (!body.recovery_plan || !body.recovery_plan.trim()) {
      return NextResponse.json(
        { error: "recovery_plan is required when status is not complete" },
        { status: 400 }
      );
    }
  }
  if (body.reason === "other") {
    if (!body.explanation || !body.explanation.trim()) {
      return NextResponse.json(
        { error: "explanation is required when reason is other" },
        { status: 400 }
      );
    }
  }

  const supabase = createServerSupabaseClient();

  const { data: day } = await supabase
    .from("run_sheet_days")
    .select("id, run_sheet_id")
    .eq("id", body.run_sheet_day_id)
    .single();
  if (!day) {
    return NextResponse.json(
      { error: "Run sheet day not found" },
      { status: 404 }
    );
  }

  const { data: runSheet } = await supabase
    .from("run_sheets")
    .select("id, project_id")
    .eq("id", day.run_sheet_id)
    .single();
  if (!runSheet || runSheet.project_id !== body.project_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: row, error } = await supabase
    .from("daily_execution")
    .insert({
      project_id: body.project_id,
      run_sheet_day_id: body.run_sheet_day_id,
      status: body.status,
      reason: body.reason ?? null,
      explanation: body.explanation?.trim() ?? null,
      recovery_plan: body.recovery_plan?.trim() ?? null,
      actual_notes: body.actual_notes?.trim() ?? null,
      submitted_by_label: payload.label ?? "User",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to submit" },
      { status: 500 }
    );
  }
  return NextResponse.json(row);
}
