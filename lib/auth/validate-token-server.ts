import { redirect } from "next/navigation";
import { verifyToken } from "./token";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TokenPayload } from "@/lib/types";

/**
 * Verify token, project match, and token_version. Returns payload or redirects to invalid-link.
 * Use in server components (run-sheet and eod pages).
 */
export async function validateRunSheetToken(
  token: string | null,
  projectId: string
): Promise<TokenPayload> {
  if (!token) redirect("/invalid-link");
  const payload = verifyToken(token);
  if (!payload) redirect("/invalid-link");
  if (payload.project_id !== projectId) redirect("/invalid-link");
  const supabase = createServerSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("token_version")
    .eq("id", projectId)
    .single();
  const currentVersion = (project as { token_version?: number } | null)?.token_version ?? 1;
  const tokenVersion = payload.token_version ?? 1;
  if (tokenVersion !== currentVersion) redirect("/invalid-link");
  return payload;
}
