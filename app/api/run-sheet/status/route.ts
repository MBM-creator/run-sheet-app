import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { RunSheetStatus } from "@/lib/types";
import { validateOutcomes } from "@/lib/validation/outcomes";
import { validateLogistics } from "@/lib/validation/logistics";

const VALID_TRANSITIONS: Record<RunSheetStatus, RunSheetStatus[] | null> = {
  draft: ["in_review"],
  in_review: ["approved_pending_lock"],
  approved_pending_lock: ["locked"],
  locked: null,
};

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request, ["owner"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  let body: { run_sheet_id: string; status: RunSheetStatus };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.run_sheet_id || !body.status) {
    return NextResponse.json(
      { error: "run_sheet_id and status are required" },
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

  const current = runSheet.status as RunSheetStatus;
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed || !allowed.includes(body.status)) {
    return NextResponse.json(
      { error: `Cannot transition from ${current} to ${body.status}` },
      { status: 400 }
    );
  }

  if (current === "in_review" && body.status === "approved_pending_lock") {
    const { count } = await supabase
      .from("run_sheet_proposals")
      .select("id", { count: "exact", head: true })
      .eq("run_sheet_id", body.run_sheet_id)
      .eq("status", "pending");
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "Cannot approve: there are pending proposals" },
        { status: 400 }
      );
    }
    const { data: days } = await supabase
      .from("run_sheet_days")
      .select("outcomes_text, logistics_text")
      .eq("run_sheet_id", body.run_sheet_id);
    for (const day of days ?? []) {
      if (!validateOutcomes(day.outcomes_text)) {
        return NextResponse.json(
          { error: "All days must have valid outcomes before approving" },
          { status: 400 }
        );
      }
      if (!validateLogistics(day.logistics_text)) {
        return NextResponse.json(
          { error: "All days must have valid logistics before approving" },
          { status: 400 }
        );
      }
    }
  }

  if (current === "approved_pending_lock" && body.status === "locked") {
    const { data: rs } = await supabase
      .from("run_sheets")
      .select("supervisor_confirmed_at")
      .eq("id", body.run_sheet_id)
      .single();
    if (!rs?.supervisor_confirmed_at) {
      return NextResponse.json(
        { error: "Supervisor must confirm before locking" },
        { status: 400 }
      );
    }
  }

  const update: Record<string, unknown> = { status: body.status };
  if (body.status === "locked") {
    update.locked_at = new Date().toISOString();
    update.locked_by = payload.label ?? "owner";
  }

  const { data: updated, error: updateError } = await supabase
    .from("run_sheets")
    .update(update)
    .eq("id", body.run_sheet_id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to update status" },
      { status: 500 }
    );
  }
  return NextResponse.json(updated);
}
