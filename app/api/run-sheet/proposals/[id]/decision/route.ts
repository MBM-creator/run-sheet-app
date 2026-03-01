import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, ["owner"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;
  const { id: proposalId } = await params;

  let body: {
    decision: "accept" | "reject" | "edit_accept";
    decision_note?: string;
    edited_value?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.decision) {
    return NextResponse.json(
      { error: "decision (accept | reject | edit_accept) is required" },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();

  const { data: proposal, error: propError } = await supabase
    .from("run_sheet_proposals")
    .select("id, run_sheet_id, run_sheet_day_id, field, proposed_value, status")
    .eq("id", proposalId)
    .single();

  if (propError || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  if (proposal.status !== "pending") {
    return NextResponse.json(
      { error: "Proposal already decided" },
      { status: 400 }
    );
  }

  const { data: runSheet } = await supabase
    .from("run_sheets")
    .select("id, project_id")
    .eq("id", proposal.run_sheet_id)
    .single();

  if (!runSheet || runSheet.project_id !== payload.project_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const valueToApply =
    body.decision === "edit_accept" && body.edited_value != null
      ? body.edited_value
      : proposal.proposed_value;

  if (
    (body.decision === "accept" || body.decision === "edit_accept") &&
    proposal.run_sheet_day_id &&
    valueToApply
  ) {
    const field = proposal.field as string;
    let update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (field === "outcomes") update.outcomes_text = valueToApply;
    else if (field === "logistics") update.logistics_text = valueToApply;
    else if (field === "date") update.calendar_date = valueToApply;
    else if (field === "cutoff") {
      try {
        const parsed = JSON.parse(valueToApply) as {
          cutoff_datetime?: string | null;
          cutoff_category?: string | null;
        };
        if (parsed.cutoff_datetime !== undefined)
          update.cutoff_datetime = parsed.cutoff_datetime;
        if (parsed.cutoff_category !== undefined)
          update.cutoff_category = parsed.cutoff_category;
      } catch {
        // ignore invalid JSON
      }
    }
    if (Object.keys(update).length > 1) {
      await supabase
        .from("run_sheet_days")
        .update(update)
        .eq("id", proposal.run_sheet_day_id);
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("run_sheet_proposals")
    .update({
      status: body.decision === "reject" ? "rejected" : "accepted",
      decided_by: payload.label ?? "owner",
      decided_at: new Date().toISOString(),
      decision_note: body.decision_note?.trim() || null,
    })
    .eq("id", proposalId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to update proposal" },
      { status: 500 }
    );
  }
  return NextResponse.json(updated);
}
