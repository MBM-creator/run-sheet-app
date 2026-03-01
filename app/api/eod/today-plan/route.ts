import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const projectId = url.searchParams.get("project_id");
  const dateStr = url.searchParams.get("date");
  if (!projectId || !dateStr) {
    return NextResponse.json(
      { error: "project_id and date query params are required" },
      { status: 400 }
    );
  }
  if (auth.payload.project_id !== projectId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServerSupabaseClient();

  const { data: locked } = await supabase
    .from("run_sheets")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "locked")
    .order("locked_at", { ascending: false })
    .limit(1)
    .single();

  if (!locked) {
    return NextResponse.json({
      run_sheet_id: null,
      run_sheet_day_id: null,
      outcomes_text: null,
      link: null,
    });
  }

  const { data: day } = await supabase
    .from("run_sheet_days")
    .select("id, outcomes_text, logistics_text, day_number, calendar_date")
    .eq("run_sheet_id", locked.id)
    .eq("calendar_date", dateStr)
    .limit(1)
    .single();

  if (!day) {
    return NextResponse.json({
      run_sheet_id: locked.id,
      run_sheet_day_id: null,
      outcomes_text: null,
      link: null,
    });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const link = `${baseUrl}/projects/${projectId}/run-sheet`;

  return NextResponse.json({
    run_sheet_id: locked.id,
    run_sheet_day_id: day.id,
    outcomes_text: day.outcomes_text,
    logistics_text: day.logistics_text,
    day_number: day.day_number,
    calendar_date: day.calendar_date,
    link,
  });
}
