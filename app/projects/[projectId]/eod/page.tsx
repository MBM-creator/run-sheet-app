import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateRunSheetToken } from "@/lib/auth/validate-token-server";
import { RunSheetProvider } from "@/contexts/RunSheetContext";
import { EODView } from "./EODView";

interface PageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function EODPage({ params, searchParams }: PageProps) {
  const { projectId } = await params;
  const { token: tokenParam } = await searchParams;
  const payload = await validateRunSheetToken(tokenParam ?? null, projectId);

  const supabase = createServerSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .single();
  if (!project) redirect("/invalid-link");

  const { data: openLevel2List } = await supabase
    .from("run_sheet_escalations")
    .select("id, level, reason, escalation_type")
    .eq("project_id", projectId)
    .eq("resolved", false)
    .gte("level", 2);
  const openLevel2Escalations = (openLevel2List ?? []) as {
    id: string;
    level: number;
    reason: string;
    escalation_type: string;
  }[];
  const openLevel2Count = openLevel2Escalations.length;

  const today = new Date().toISOString().slice(0, 10);
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
      <EODView
        projectId={projectId}
        projectName={project.name}
        token={token}
        initialDate={today}
        openLevel2Escalations={openLevel2Escalations}
        openLevel2Count={openLevel2Count}
      />
    </RunSheetProvider>
  );
}
