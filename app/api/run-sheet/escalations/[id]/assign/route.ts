import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/run-sheet/escalations/[id]/assign
 * Auth: owner. Body: { assign_to_label, note? }. Stored in metadata.assigned_to, metadata.assignment_note.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, ["owner"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;
  const { id } = await params;

  let body: { assign_to_label: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.assign_to_label?.trim()) {
    return NextResponse.json(
      { error: "assign_to_label is required" },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();
  const { data: esc, error: fetchError } = await supabase
    .from("run_sheet_escalations")
    .select("id, project_id, metadata")
    .eq("id", id)
    .single();

  if (fetchError || !esc) {
    return NextResponse.json({ error: "Escalation not found" }, { status: 404 });
  }
  if (esc.project_id !== payload.project_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const meta = (esc.metadata as Record<string, unknown>) ?? {};
  const updatedMeta = {
    ...meta,
    assigned_to: body.assign_to_label.trim(),
    assignment_note: body.note?.trim() ?? null,
  };

  const { data: updated, error: updateError } = await supabase
    .from("run_sheet_escalations")
    .update({ metadata: updatedMeta })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to assign" },
      { status: 500 }
    );
  }
  return NextResponse.json(updated);
}
