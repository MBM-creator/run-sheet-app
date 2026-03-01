import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateRunSheetToken } from "@/lib/auth/validate-token-server";
import { RunSheetProvider } from "@/contexts/RunSheetContext";
import { RunSheetView } from "./RunSheetView";

interface PageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function RunSheetPage({ params, searchParams }: PageProps) {
  const { projectId } = await params;
  const { token: tokenParam } = await searchParams;
  const payload = await validateRunSheetToken(tokenParam ?? null, projectId);

  const supabase = createServerSupabaseClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, site_address, start_date")
    .eq("id", projectId)
    .single();

  if (!project) redirect("/invalid-link");

  const { data: runSheets } = await supabase
    .from("run_sheets")
    .select("id, version, status, supervisor_confirmed_at, hours_agreed, hours_used")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const runSheet =
    runSheets?.find((rs) => rs.status === "draft") ??
    runSheets?.find((rs) => rs.status === "in_review") ??
    runSheets?.find((rs) => rs.status === "approved_pending_lock") ??
    runSheets?.find((rs) => rs.status === "locked");
  const runSheetId = runSheet?.id ?? null;

  let days: Awaited<ReturnType<typeof loadDays>> = [];
  let pendingByDay: Record<string, number> = {};
  let cutoffs: Awaited<ReturnType<typeof loadCutoffs>> = [];

  if (runSheetId) {
    days = await loadDays(supabase, runSheetId);
    pendingByDay = await loadPendingByDay(supabase, runSheetId);
    cutoffs = await loadCutoffs(supabase, runSheetId);
  }
  const openEscalations = await loadOpenEscalations(supabase, projectId);
  const escalationCountLevel2Plus = openEscalations.filter((e) => e.level >= 2).length;
  const escalationsByDayId: Record<string, EscalationRow[]> = {};
  for (const e of openEscalations) {
    if (e.run_sheet_day_id) {
      if (!escalationsByDayId[e.run_sheet_day_id]) escalationsByDayId[e.run_sheet_day_id] = [];
      escalationsByDayId[e.run_sheet_day_id].push(e);
    }
  }
  const weekStartDate = getWeekStartDate(new Date());
  const hasWeeklyLogisticsReview = await loadHasWeeklyLogisticsReview(supabase, projectId, weekStartDate);
  const resolvedThisWeek = await loadResolvedThisWeek(supabase, projectId, weekStartDate);

  const today = new Date().toISOString().slice(0, 10);
  const totalDays = days.length;
  const currentDay =
    totalDays > 0
      ? (() => {
          const match = days.find((d) => d.calendar_date === today);
          if (match) return match.day_number;
          const past = days.filter((d) => d.calendar_date && d.calendar_date <= today);
          if (past.length > 0) {
            const last = past[past.length - 1];
            return last.day_number;
          }
          return days[0].day_number;
        })()
      : null;

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
      <RunSheetView
        projectId={projectId}
        projectName={project.name}
        siteAddress={project.site_address}
        projectStartDate={(project as { start_date?: string | null }).start_date ?? null}
        runSheet={runSheet ? { id: runSheet.id, version: runSheet.version, status: runSheet.status, supervisor_confirmed_at: runSheet.supervisor_confirmed_at, hours_agreed: (runSheet as { hours_agreed?: number | null }).hours_agreed ?? null, hours_used: (runSheet as { hours_used?: number | null }).hours_used ?? null } : null}
        days={days}
        pendingByDay={pendingByDay}
        cutoffs={cutoffs}
        token={token}
        openEscalations={openEscalations}
        escalationCountLevel2Plus={escalationCountLevel2Plus}
        escalationsByDayId={escalationsByDayId}
        weekStartDate={weekStartDate}
        hasWeeklyLogisticsReview={hasWeeklyLogisticsReview}
        resolvedThisWeek={resolvedThisWeek}
        currentDay={currentDay}
        totalDays={totalDays}
      />
    </RunSheetProvider>
  );
}

async function loadDays(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  runSheetId: string
) {
  const { data } = await supabase
    .from("run_sheet_days")
    .select("id, day_number, calendar_date, outcomes_text, logistics_text, cutoff_datetime, cutoff_category, cutoff_override_reason, cutoff_confirmed_at, cutoff_confirmed_by_label, cutoff_confirm_note, escalation_state, planned_labour_hours")
    .eq("run_sheet_id", runSheetId)
    .order("day_number", { ascending: true });
  return data ?? [];
}

async function loadPendingByDay(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  runSheetId: string
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("run_sheet_proposals")
    .select("run_sheet_day_id")
    .eq("run_sheet_id", runSheetId)
    .eq("status", "pending");
  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = row.run_sheet_day_id ?? "sheet";
    map[key] = (map[key] ?? 0) + 1;
  }
  return map;
}

export type CutoffStatus = "confirmed" | "overdue" | "due";

async function loadCutoffs(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  runSheetId: string
) {
  const now = new Date();
  const in7 = new Date(now);
  in7.setDate(in7.getDate() + 7);
  const { data: days } = await supabase
    .from("run_sheet_days")
    .select("id, day_number, calendar_date, cutoff_datetime, cutoff_category, cutoff_confirmed_at, cutoff_confirmed_by_label, cutoff_confirm_note, escalation_state, planned_labour_hours")
    .eq("run_sheet_id", runSheetId)
    .not("cutoff_datetime", "is", null);
  const list: {
    id: string;
    day_number: number;
    calendar_date: string | null;
    cutoff_datetime: string;
    cutoff_category: string | null;
    cutoff_confirmed_at: string | null;
    cutoff_confirmed_by_label: string | null;
    cutoff_confirm_note: string | null;
    escalation_state: string | null;
    status: CutoffStatus;
  }[] = [];
  for (const d of days ?? []) {
    if (!d.cutoff_datetime) continue;
    const dt = new Date(d.cutoff_datetime);
    const confirmedAt = (d as { cutoff_confirmed_at?: string | null }).cutoff_confirmed_at ?? null;
    const status: CutoffStatus =
      confirmedAt != null
        ? "confirmed"
        : dt < now
          ? "overdue"
          : "due";
    const include =
      confirmedAt != null ||
      dt < now ||
      (dt >= now && dt <= in7);
    if (!include) continue;
    list.push({
      id: d.id,
      day_number: d.day_number,
      calendar_date: d.calendar_date,
      cutoff_datetime: d.cutoff_datetime,
      cutoff_category: d.cutoff_category,
      cutoff_confirmed_at: confirmedAt,
      cutoff_confirmed_by_label: (d as { cutoff_confirmed_by_label?: string | null }).cutoff_confirmed_by_label ?? null,
      cutoff_confirm_note: (d as { cutoff_confirm_note?: string | null }).cutoff_confirm_note ?? null,
      escalation_state: (d as { escalation_state?: string | null }).escalation_state ?? null,
      status,
    });
  }
  list.sort((a, b) => {
    const order = { overdue: 0, due: 1, confirmed: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return new Date(a.cutoff_datetime).getTime() - new Date(b.cutoff_datetime).getTime();
  });
  return list;
}

export interface EscalationRow {
  id: string;
  project_id: string;
  run_sheet_id: string;
  run_sheet_day_id: string | null;
  escalation_type: string;
  level: number;
  reason: string;
  metadata: Record<string, unknown> | null;
  created_by_label: string | null;
  created_at: string;
  resolved: boolean;
  resolved_by_label: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
}

function getWeekStartDate(d: Date): string {
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setUTCDate(diff);
  return monday.toISOString().slice(0, 10);
}

async function loadHasWeeklyLogisticsReview(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  projectId: string,
  weekStartDate: string
): Promise<boolean> {
  const { data } = await supabase
    .from("weekly_logistics_reviews")
    .select("id")
    .eq("project_id", projectId)
    .eq("week_start_date", weekStartDate)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function loadOpenEscalations(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  projectId: string
): Promise<EscalationRow[]> {
  const { data } = await supabase
    .from("run_sheet_escalations")
    .select("id, project_id, run_sheet_id, run_sheet_day_id, escalation_type, level, reason, metadata, created_by_label, created_at, resolved, resolved_by_label, resolved_at, resolution_note")
    .eq("project_id", projectId)
    .eq("resolved", false)
    .order("level", { ascending: false })
    .order("created_at", { ascending: true });
  return (data ?? []) as EscalationRow[];
}

async function loadResolvedThisWeek(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  projectId: string,
  weekStartDate: string
): Promise<number> {
  const { data } = await supabase
    .from("run_sheet_escalations")
    .select("id")
    .eq("project_id", projectId)
    .eq("resolved", true)
    .gte("resolved_at", weekStartDate);
  return data?.length ?? 0;
}
