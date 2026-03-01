import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDefaultCutoffISO } from "@/lib/cutoff-rules";
import type { CutoffCategory } from "@/lib/types";
import { validateOutcomes } from "@/lib/validation/outcomes";
import { getOutcomesError } from "@/lib/validation/outcomes";
import { validateLogistics } from "@/lib/validation/logistics";
import { getLogisticsError } from "@/lib/validation/logistics";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, ["owner"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;
  const { id: dayId } = await params;

  let body: {
    outcomes_text?: string;
    logistics_text?: string;
    calendar_date?: string;
    cutoff_datetime?: string | null;
    cutoff_category?: CutoffCategory | null;
    cutoff_rule_applied?: boolean;
    cutoff_override_reason?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data: day, error: dayError } = await supabase
    .from("run_sheet_days")
    .select("id, run_sheet_id, calendar_date, cutoff_category, cutoff_datetime")
    .eq("id", dayId)
    .single();

  if (dayError || !day) {
    return NextResponse.json({ error: "Run sheet day not found" }, { status: 404 });
  }

  const { data: runSheet, error: rsError } = await supabase
    .from("run_sheets")
    .select("id, project_id, status")
    .eq("id", day.run_sheet_id)
    .single();

  if (rsError || !runSheet) {
    return NextResponse.json({ error: "Run sheet not found" }, { status: 404 });
  }
  if (runSheet.project_id !== payload.project_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (runSheet.status === "locked") {
    return NextResponse.json(
      { error: "Run sheet is locked; create a new version to edit" },
      { status: 400 }
    );
  }

  if (body.outcomes_text !== undefined) {
    const err = getOutcomesError(body.outcomes_text);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }
  if (body.logistics_text !== undefined) {
    const err = getLogisticsError(body.logistics_text);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  const calendarDate = body.calendar_date ?? day.calendar_date;
  const category = body.cutoff_category ?? day.cutoff_category;
  const requestedCutoff = body.cutoff_datetime;

  if (
    category &&
    category !== "other" &&
    calendarDate &&
    requestedCutoff !== undefined
  ) {
    const defaultCutoff = getDefaultCutoffISO(calendarDate, category);
    if (defaultCutoff) {
      const requestedNorm = requestedCutoff ? new Date(requestedCutoff).toISOString() : null;
      const differs =
        requestedNorm !== defaultCutoff &&
        (requestedNorm?.slice(0, 10) !== defaultCutoff.slice(0, 10) ||
          requestedNorm === null);
      if (differs && (!body.cutoff_override_reason || !body.cutoff_override_reason.trim())) {
        return NextResponse.json(
          {
            error:
              "Cut-off datetime differs from default for this category; cutoff_override_reason is required",
          },
          { status: 400 }
        );
      }
    }
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.outcomes_text !== undefined) update.outcomes_text = body.outcomes_text;
  if (body.logistics_text !== undefined) update.logistics_text = body.logistics_text;
  if (body.calendar_date !== undefined) update.calendar_date = body.calendar_date || null;
  if (body.cutoff_datetime !== undefined) update.cutoff_datetime = body.cutoff_datetime || null;
  if (body.cutoff_category !== undefined) update.cutoff_category = body.cutoff_category || null;
  if (body.cutoff_rule_applied !== undefined) update.cutoff_rule_applied = body.cutoff_rule_applied;
  if (body.cutoff_override_reason !== undefined)
    update.cutoff_override_reason = body.cutoff_override_reason?.trim() || null;

  const { data: updated, error: updateError } = await supabase
    .from("run_sheet_days")
    .update(update)
    .eq("id", dayId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to update day" },
      { status: 500 }
    );
  }
  return NextResponse.json(updated);
}
