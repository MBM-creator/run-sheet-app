import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./token";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TokenPayload } from "@/lib/types";

export type Role = TokenPayload["role"];

/**
 * Parse token from query (?token=...) or Authorization header (Bearer <token>).
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken) return queryToken;

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);

  return null;
}

/**
 * Verify token and optionally require one of the given roles.
 * Enforces: signature (RUN_SHEET_SIGNING_SECRET), expires_at, project_id/role presence,
 * role when allowedRoles set, and token_version match with projects.token_version when present.
 * Returns { payload } or { error: NextResponse }.
 */
export async function requireAuth(
  request: NextRequest,
  allowedRoles?: Role[]
): Promise<{ payload: TokenPayload } | { error: NextResponse }> {
  const token = getTokenFromRequest(request);
  if (!token) {
    return { error: NextResponse.json({ error: "Missing token" }, { status: 401 }) };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return { error: NextResponse.json({ error: "Invalid or expired token" }, { status: 401 }) };
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
    return { error: NextResponse.json({ error: "Insufficient role" }, { status: 403 }) };
  }

  const supabase = createServerSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("token_version")
    .eq("id", payload.project_id)
    .single();
  const currentVersion = (project as { token_version?: number } | null)?.token_version ?? 1;
  const tokenVersion = payload.token_version ?? 1;
  if (tokenVersion !== currentVersion) {
    return {
      error: NextResponse.json({ error: "Token has been revoked" }, { status: 401 }),
    };
  }

  return { payload };
}
