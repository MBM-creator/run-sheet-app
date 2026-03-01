import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["owner"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  let body: { project_id: string; seed_days_from_start?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.project_id) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }
  if (payload.project_id !== body.project_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServerSupabaseClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, start_date")
    .eq("id", body.project_id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: runSheet, error: insertError } = await supabase
    .from("run_sheets")
    .insert({
      project_id: body.project_id,
      version: 1,
      status: "draft",
      created_by: payload.label ?? "owner",
    })
    .select("id, version, status")
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message ?? "Failed to create run sheet" },
      { status: 500 }
    );
  }

  if (body.seed_days_from_start && project.start_date) {
    const start = new Date(project.start_date);
    const daysToSeed = 7;
    const dayInserts = Array.from({ length: daysToSeed }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return {
        run_sheet_id: runSheet!.id,
        day_number: i + 1,
        calendar_date: d.toISOString().slice(0, 10),
      };
    });
    await supabase.from("run_sheet_days").insert(dayInserts);
  }

  return NextResponse.json(runSheet);
}
