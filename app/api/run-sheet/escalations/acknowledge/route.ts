import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MIN_NOTE_LENGTH = 20;

/**
 * POST /api/run-sheet/escalations/acknowledge
 * Auth: supervisor or owner. Body: { project_id, escalation_ids: string[], note }.
 * Appends last_acknowledged_by, last_acknowledged_at, last_acknowledgement_note to each escalation's metadata. Does NOT resolve.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["owner", "supervisor"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  let body: { project_id: string; escalation_ids: string[]; note: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.project_id || !Array.isArray(body.escalation_ids)) {
    return NextResponse.json(
      { error: "project_id and escalation_ids (array) are required" },
      { status: 400 }
    );
  }
  const note = body.note?.trim() ?? "";
  if (note.length < MIN_NOTE_LENGTH) {
    return NextResponse.json(
      { error: `note is required and must be at least ${MIN_NOTE_LENGTH} characters` },
      { status: 400 }
    );
  }
  if (payload.project_id !== body.project_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();
  const label = payload.label ?? "user";

  for (const id of body.escalation_ids) {
    const { data: esc, error: fetchError } = await supabase
      .from("run_sheet_escalations")
      .select("id, project_id, metadata")
      .eq("id", id)
      .single();

    if (fetchError || !esc || esc.project_id !== body.project_id) continue;

    const meta = (esc.metadata as Record<string, unknown>) ?? {};
    const updatedMeta = {
      ...meta,
      last_acknowledged_by: label,
      last_acknowledged_at: now,
      last_acknowledgement_note: note,
    };

    await supabase
      .from("run_sheet_escalations")
      .update({ metadata: updatedMeta })
      .eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
