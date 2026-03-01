import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * PATCH /api/run-sheet/hours
 * Body: { run_sheet_id: string; hours_used?: number; hours_agreed?: number }
 * Auth: Bearer <run-sheet token> (owner or supervisor). Another app can use a long-lived token to push hours_used.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request, ["owner", "supervisor"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  let body: { run_sheet_id: string; hours_used?: number; hours_agreed?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.run_sheet_id) {
    return NextResponse.json(
      { error: "run_sheet_id is required" },
      { status: 400 }
    );
  }
  if (body.hours_used !== undefined) {
    const n = Number(body.hours_used);
    if (Number.isNaN(n) || n < 0) {
      return NextResponse.json(
        { error: "hours_used must be a non-negative number" },
        { status: 400 }
      );
    }
  }
  if (body.hours_agreed !== undefined) {
    const n = Number(body.hours_agreed);
    if (Number.isNaN(n) || n < 0) {
      return NextResponse.json(
        { error: "hours_agreed must be a non-negative number" },
        { status: 400 }
      );
    }
  }
  if (body.hours_used === undefined && body.hours_agreed === undefined) {
    return NextResponse.json(
      { error: "At least one of hours_used or hours_agreed is required" },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();

  const { data: runSheet, error: fetchError } = await supabase
    .from("run_sheets")
    .select("id, project_id")
    .eq("id", body.run_sheet_id)
    .single();

  if (fetchError || !runSheet) {
    return NextResponse.json({ error: "Run sheet not found" }, { status: 404 });
  }
  if (runSheet.project_id !== payload.project_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update: Record<string, unknown> = {};
  if (body.hours_used !== undefined) update.hours_used = body.hours_used;
  if (body.hours_agreed !== undefined) update.hours_agreed = body.hours_agreed;

  const { data: updated, error: updateError } = await supabase
    .from("run_sheets")
    .update(update)
    .eq("id", body.run_sheet_id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to update hours" },
      { status: 500 }
    );
  }
  return NextResponse.json(updated);
}
