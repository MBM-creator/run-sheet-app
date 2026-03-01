import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/run-sheet/escalations/[id]/snooze
 * Auth: owner only. Body: { duration_hours?: number } (default 2).
 * Sets metadata.snoozed_until so the mid-week modal does not show until then.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, ["owner"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;
  const { id } = await params;

  let body: { duration_hours?: number } = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    // ignore
  }
  const durationHours = body.duration_hours ?? 2;
  const until = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

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
  const updatedMeta = { ...meta, snoozed_until: until };

  const { data: updated, error: updateError } = await supabase
    .from("run_sheet_escalations")
    .update({ metadata: updatedMeta })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to snooze" },
      { status: 500 }
    );
  }
  return NextResponse.json(updated);
}
