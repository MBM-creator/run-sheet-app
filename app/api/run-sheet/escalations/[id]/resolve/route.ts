import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MIN_RESOLUTION_NOTE_LENGTH = 20;
const MIN_RECOVERY_PLAN_LENGTH = 50;

/**
 * POST /api/run-sheet/escalations/[id]/resolve
 * Auth: owner only. Body: { resolution_note (required, min 20), recovery_plan? (required for level 3, min 50), action? }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, ["owner"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;
  const { id } = await params;

  let body: { resolution_note?: string; recovery_plan?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const resolutionNote = body.resolution_note?.trim() ?? "";
  if (resolutionNote.length < MIN_RESOLUTION_NOTE_LENGTH) {
    return NextResponse.json(
      { error: `resolution_note is required and must be at least ${MIN_RESOLUTION_NOTE_LENGTH} characters` },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();
  const { data: esc, error: fetchError } = await supabase
    .from("run_sheet_escalations")
    .select("id, project_id, level, escalation_type, metadata, resolved")
    .eq("id", id)
    .single();

  if (fetchError || !esc) {
    return NextResponse.json({ error: "Escalation not found" }, { status: 404 });
  }
  if (esc.project_id !== payload.project_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (esc.resolved) {
    return NextResponse.json({ error: "Already resolved" }, { status: 400 });
  }

  if (esc.level === 3) {
    const recoveryPlan = body.recovery_plan?.trim() ?? "";
    if (recoveryPlan.length < MIN_RECOVERY_PLAN_LENGTH) {
      return NextResponse.json(
        { error: `Level 3 escalations require recovery_plan of at least ${MIN_RECOVERY_PLAN_LENGTH} characters` },
        { status: 400 }
      );
    }
  }

  const meta = (esc.metadata as Record<string, unknown>) ?? {};
  const update: Record<string, unknown> = {
    resolved: true,
    resolved_by_label: payload.label ?? "owner",
    resolved_at: new Date().toISOString(),
    resolution_note: resolutionNote,
    metadata: { ...meta },
  };
  if (esc.level === 3 && body.recovery_plan?.trim()) {
    (update.metadata as Record<string, unknown>).recovery_plan = body.recovery_plan.trim();
  }
  if (body.action && (esc.escalation_type === "consecutive_misses" || esc.escalation_type === "execution_drift")) {
    (update.metadata as Record<string, unknown>).resolution_action = body.action;
  }

  const { data: updated, error: updateError } = await supabase
    .from("run_sheet_escalations")
    .update({
      resolved: update.resolved,
      resolved_by_label: update.resolved_by_label,
      resolved_at: update.resolved_at,
      resolution_note: update.resolution_note,
      metadata: update.metadata,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to resolve" },
      { status: 500 }
    );
  }
  return NextResponse.json(updated);
}
