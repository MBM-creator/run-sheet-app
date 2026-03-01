import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateRunSheetToken } from "@/lib/auth/validate-token-server";
import { RunSheetProvider } from "@/contexts/RunSheetContext";
import { ProposalsView } from "./ProposalsView";

interface PageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function ProposalsPage({ params, searchParams }: PageProps) {
  const { projectId } = await params;
  const { token: tokenParam } = await searchParams;
  const payload = await validateRunSheetToken(tokenParam ?? null, projectId);

  if (payload.role !== "owner") {
    redirect(`/projects/${projectId}/run-sheet?token=${encodeURIComponent(tokenParam ?? "")}`);
  }

  const supabase = createServerSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .single();
  if (!project) redirect("/invalid-link");

  const { data: runSheets } = await supabase
    .from("run_sheets")
    .select("id, version, status")
    .eq("project_id", projectId)
    .in("status", ["in_review", "approved_pending_lock"])
    .order("created_at", { ascending: false });
  const runSheet = runSheets?.[0];
  const runSheetId = runSheet?.id ?? null;

  let proposals: Awaited<ReturnType<typeof fetchProposals>> = [];
  if (runSheetId) {
    proposals = await fetchProposals(supabase, runSheetId);
  }

  const token = tokenParam!;
  return (
    <RunSheetProvider
      value={{
        project_id: payload.project_id,
        role: payload.role,
        expires_at: payload.expires_at,
        label: payload.label,
        token,
      }}
    >
      <ProposalsView
        projectId={projectId}
        projectName={project.name}
        runSheet={runSheet ?? null}
        proposals={proposals}
        token={token}
      />
    </RunSheetProvider>
  );
}

async function fetchProposals(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  runSheetId: string
) {
  const { data } = await supabase
    .from("run_sheet_proposals")
    .select("*")
    .eq("run_sheet_id", runSheetId)
    .order("created_at", { ascending: true });
  return data ?? [];
}
