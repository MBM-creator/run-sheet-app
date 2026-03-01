import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { signToken } from "@/lib/auth/token";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateExpiresInDays } from "@/lib/auth/expires-validation";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["owner"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  let body: { project_id: string; role: "owner" | "supervisor" | "crew"; label?: string; expires_in_days?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.project_id || !body.role) {
    return NextResponse.json(
      { error: "project_id and role are required" },
      { status: 400 }
    );
  }

  const expiresValidation = validateExpiresInDays(body.expires_in_days);
  if (!expiresValidation.ok) {
    return NextResponse.json(
      { error: expiresValidation.error },
      { status: expiresValidation.status }
    );
  }
  const expiresInDays = expiresValidation.expiresInDays;

  if (payload.project_id !== body.project_id) {
    return NextResponse.json(
      { error: "You can only create links for your own project" },
      { status: 403 }
    );
  }

  const supabase = createServerSupabaseClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, token_version")
    .eq("id", body.project_id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const tokenVersion = (project as { token_version?: number }).token_version ?? 1;
  const token = signToken({
    project_id: body.project_id,
    role: body.role,
    expires_at: expiresAt.toISOString(),
    label: body.label,
    token_version: tokenVersion,
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    request.nextUrl.origin;
  const path = `/projects/${body.project_id}/run-sheet`;
  const url = `${baseUrl}${path}?token=${encodeURIComponent(token)}`;

  return NextResponse.json({ url, expires_at: expiresAt.toISOString() });
}
