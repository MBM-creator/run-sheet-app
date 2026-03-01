import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseAndValidateCsv } from "@/lib/run-sheet/import-csv";
import { scheduleTasks } from "@/lib/run-sheet/schedule-tasks";
import { validateOutcomes } from "@/lib/validation/outcomes";

function getNextMondayISO(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["owner"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  let projectId: string;
  let startDateForm: string | null = null;
  let csvText: string;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectIdForm = formData.get("project_id") as string | null;
    startDateForm = formData.get("start_date") as string | null;

    if (!projectIdForm?.trim()) {
      return NextResponse.json(
        { error: "project_id is required" },
        { status: 400 }
      );
    }
    projectId = projectIdForm.trim();

    if (payload.project_id !== projectId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "file is required (CSV)" },
        { status: 400 }
      );
    }
    csvText = await file.text();
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid form data or file" },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, start_date")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let startDate: string =
    startDateForm?.trim() ||
    (project as { start_date?: string | null }).start_date ||
    getNextMondayISO();

  const parseResult = parseAndValidateCsv(csvText);
  if (!parseResult.valid) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parseResult.errors,
      },
      { status: 400 }
    );
  }

  const scheduledDays = scheduleTasks(parseResult.rows, startDate);

  for (const day of scheduledDays) {
    if (!validateOutcomes(day.outcomes_text)) {
      return NextResponse.json(
        {
          error: "Generated outcomes failed validation",
          details: [{ row: 0, field: "outcomes_text", message: "Day " + day.day_number + " outcomes missing measurable anchor." }],
        },
        { status: 400 }
      );
    }
  }

  const { data: existingVersions } = await supabase
    .from("run_sheets")
    .select("version")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion = existingVersions?.length
    ? (existingVersions[0] as { version: number }).version + 1
    : 1;

  const { data: runSheet, error: insertRsError } = await supabase
    .from("run_sheets")
    .insert({
      project_id: projectId,
      version: nextVersion,
      status: "draft",
      created_by: payload.label ?? "owner",
    })
    .select("id, version")
    .single();

  if (insertRsError || !runSheet) {
    return NextResponse.json(
      { error: insertRsError?.message ?? "Failed to create run sheet" },
      { status: 500 }
    );
  }

  const dayInserts = scheduledDays.map((d) => ({
    run_sheet_id: runSheet.id,
    day_number: d.day_number,
    calendar_date: d.calendar_date,
    outcomes_text: d.outcomes_text,
    logistics_text: d.logistics_text,
    cutoff_datetime: d.cutoff_datetime,
    cutoff_category: d.cutoff_category,
    cutoff_rule_applied: d.cutoff_rule_applied,
    planned_labour_hours: d.plannedLabourHours,
  }));

  const { error: insertDaysError } = await supabase
    .from("run_sheet_days")
    .insert(dayInserts);

  if (insertDaysError) {
    return NextResponse.json(
      { error: insertDaysError.message ?? "Failed to create run sheet days" },
      { status: 500 }
    );
  }

  const redirectUrl = `/projects/${projectId}/run-sheet`;
  return NextResponse.json({
    run_sheet_id: runSheet.id,
    version: runSheet.version,
    redirect_url: redirectUrl,
  });
}
