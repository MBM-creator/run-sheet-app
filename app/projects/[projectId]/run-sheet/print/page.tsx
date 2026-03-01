import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateRunSheetToken } from "@/lib/auth/validate-token-server";
import { PrintView } from "./PrintView";

interface PageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function PrintPage({ params, searchParams }: PageProps) {
  const { projectId } = await params;
  const { token: tokenParam } = await searchParams;
  await validateRunSheetToken(tokenParam ?? null, projectId);

  const supabase = createServerSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, site_address")
    .eq("id", projectId)
    .single();
  if (!project) redirect("/invalid-link");

  const { data: runSheets } = await supabase
    .from("run_sheets")
    .select("id, version, status")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const runSheet =
    runSheets?.find((rs) => rs.status === "draft") ??
    runSheets?.find((rs) => rs.status === "in_review") ??
    runSheets?.find((rs) => rs.status === "approved_pending_lock") ??
    runSheets?.find((rs) => rs.status === "locked");

  let days: { day_number: number; calendar_date: string | null; outcomes_text: string | null; logistics_text: string | null }[] = [];
  if (runSheet) {
    const { data } = await supabase
      .from("run_sheet_days")
      .select("day_number, calendar_date, outcomes_text, logistics_text")
      .eq("run_sheet_id", runSheet.id)
      .order("day_number", { ascending: true });
    days = data ?? [];
  }

  return (
    <PrintView
      projectName={project.name}
      siteAddress={project.site_address}
      runSheet={runSheet ?? null}
      days={days}
    />
  );
}
