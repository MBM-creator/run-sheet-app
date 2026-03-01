import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Owner only. Increments projects.token_version for the project, invalidating
 * all existing signed links. New links minted after this will work.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["owner"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  let body: { project_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.project_id) {
    return NextResponse.json(
      { error: "project_id is required" },
      { status: 400 }
    );
  }
  if (payload.project_id !== body.project_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServerSupabaseClient();
  const { data: project, error: fetchError } = await supabase
    .from("projects")
    .select("id, token_version")
    .eq("id", body.project_id)
    .single();

  if (fetchError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const current = (project as { token_version?: number }).token_version ?? 1;
  const nextVersion = current + 1;

  const { error: updateError } = await supabase
    .from("projects")
    .update({ token_version: nextVersion })
    .eq("id", body.project_id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to revoke" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    project_id: body.project_id,
    token_version: nextVersion,
    message: "All existing links for this project are now invalid. Mint new links via access-link.",
  });
}
