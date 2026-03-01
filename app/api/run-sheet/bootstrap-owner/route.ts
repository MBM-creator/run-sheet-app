import { NextRequest, NextResponse } from "next/server";
import { signToken } from "@/lib/auth/token";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateExpiresInDays } from "@/lib/auth/expires-validation";

/**
 * DEV-ONLY: mint the first owner link for a project (chicken/egg bootstrap).
 * In production this endpoint returns 404. Requires x-bootstrap-key header matching
 * RUN_SHEET_BOOTSTRAP_KEY. Do not enable in production.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const key = request.headers.get("x-bootstrap-key");
  const expected = process.env.RUN_SHEET_BOOTSTRAP_KEY;
  if (!expected || !key || key !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { project_id: string; label?: string; expires_in_days?: number };
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

  const expiresValidation = validateExpiresInDays(body.expires_in_days);
  if (!expiresValidation.ok) {
    return NextResponse.json(
      { error: expiresValidation.error },
      { status: expiresValidation.status }
    );
  }
  const expiresInDays = expiresValidation.expiresInDays;

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
    role: "owner",
    expires_at: expiresAt.toISOString(),
    label: body.label,
    token_version: tokenVersion,
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const path = `/projects/${body.project_id}/run-sheet`;
  const url = `${baseUrl}${path}?token=${encodeURIComponent(token)}`;

  return NextResponse.json({ url, expires_at: expiresAt.toISOString() });
}
