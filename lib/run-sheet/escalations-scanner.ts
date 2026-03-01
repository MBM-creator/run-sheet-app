import type { SupabaseClient } from "@supabase/supabase-js";

export interface ScanScope {
  projectId?: string;
}

export interface ScanResult {
  created: number;
  byType: Record<string, number>;
  resolved: number;
}

const SYSTEM_LABEL = "system";

function getWeekStart(d: Date): string {
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setUTCDate(diff);
  return monday.toISOString().slice(0, 10);
}

export async function runEscalationsScan(
  supabase: SupabaseClient,
  scope: ScanScope
): Promise<ScanResult> {
  const result: ScanResult = { created: 0, byType: {}, resolved: 0 };
  const now = new Date();

  const projectFilter = scope.projectId
    ? { project_id: scope.projectId }
    : {};

  const { data: projects } = await supabase
    .from("projects")
    .select("id")
    .match(projectFilter);
  const projectIds = (projects ?? []).map((p) => p.id);
  if (projectIds.length === 0) return result;

  const { data: runSheets } = await supabase
    .from("run_sheets")
    .select("id, project_id")
    .in("project_id", projectIds);
  const runSheetById = new Map((runSheets ?? []).map((r) => [r.id, r]));

  const runSheetIds = (runSheets ?? []).map((r) => r.id);
  if (runSheetIds.length === 0) return result;

  const { data: openEscalations } = await supabase
    .from("run_sheet_escalations")
    .select("id, run_sheet_day_id, project_id, level, escalation_type, metadata")
    .eq("resolved", false)
    .in("project_id", projectIds);

  const openByDayId = new Map<string, { level: number }[]>();
  const openMidweekByProject = new Set<string>();
  const openConsecutiveByProject = new Set<string>();
  const openWeeklyLogisticsByProject = new Map<string, { id: string; level: number }>();
  for (const e of openEscalations ?? []) {
    if (e.run_sheet_day_id) {
      const list = openByDayId.get(e.run_sheet_day_id) ?? [];
      list.push({ level: e.level });
      openByDayId.set(e.run_sheet_day_id, list);
    }
    if (e.escalation_type === "midweek_review") openMidweekByProject.add(e.project_id);
    if (e.escalation_type === "consecutive_misses") openConsecutiveByProject.add(e.project_id);
    if (e.escalation_type === "weekly_logistics_not_confirmed") {
      const meta = (e.metadata as { week_start?: string } | null) ?? {};
      const key = `${e.project_id}:${meta.week_start ?? ""}`;
      openWeeklyLogisticsByProject.set(key, { id: e.id, level: e.level });
    }
  }

  const createdThisRunByDay = new Map<string, number>();

  const maxLevelForDay = (dayId: string): number => {
    const list = openByDayId.get(dayId) ?? [];
    const fromDb = list.length === 0 ? 0 : Math.max(...list.map((x) => x.level));
    const fromRun = createdThisRunByDay.get(dayId) ?? 0;
    return Math.max(fromDb, fromRun);
  };

  const hasOpenCutoffMissedForDay = (dayId: string): boolean =>
    createdThisRunByDay.has(dayId) ||
    (openEscalations ?? []).some(
      (e) => e.run_sheet_day_id === dayId && e.escalation_type === "cutoff_missed"
    );

  const { data: daysWithCutoff } = await supabase
    .from("run_sheet_days")
    .select("id, run_sheet_id, day_number, calendar_date, cutoff_datetime, cutoff_category, cutoff_confirmed_at, escalation_state")
    .in("run_sheet_id", runSheetIds)
    .not("cutoff_datetime", "is", null);

  const nowMs = now.getTime();
  const day24 = 24 * 60 * 60 * 1000;
  const day72 = 72 * 60 * 60 * 1000;

  for (const day of daysWithCutoff ?? []) {
    const cutoffAt = new Date(day.cutoff_datetime).getTime();
    const confirmed = !!day.cutoff_confirmed_at;

    if (confirmed) {
      const existing = (openEscalations ?? []).filter(
        (e) => e.run_sheet_day_id === day.id && e.escalation_type === "cutoff_missed"
      );
      for (const esc of existing) {
        await supabase
          .from("run_sheet_escalations")
          .update({
            resolved: true,
            resolved_by_label: SYSTEM_LABEL,
            resolved_at: now.toISOString(),
            resolution_note: "Cut-off confirmed",
          })
          .eq("id", esc.id);
        result.resolved += 1;
      }
      const otherOpen = (openEscalations ?? []).filter(
        (e) => e.run_sheet_day_id === day.id && e.escalation_type !== "cutoff_missed"
      );
      const maxLevel = otherOpen.length === 0 ? 0 : Math.max(...otherOpen.map((e) => e.level));
      const newState = maxLevel >= 3 ? "intervention" : maxLevel >= 2 ? "action" : maxLevel >= 1 ? "warning" : "none";
      await supabase
        .from("run_sheet_days")
        .update({ escalation_state: newState === "none" ? null : newState, updated_at: now.toISOString() })
        .eq("id", day.id);
      continue;
    }

    if (nowMs <= cutoffAt) continue;

    const projectId = runSheetById.get(day.run_sheet_id)?.project_id;
    if (!projectId) continue;

    const category = (day as { cutoff_category?: string }).cutoff_category ?? "cut-off";
    const dueStr = new Date(day.cutoff_datetime).toISOString().slice(0, 16);

    if (!hasOpenCutoffMissedForDay(day.id)) {
      await supabase.from("run_sheet_escalations").insert({
        project_id: projectId,
        run_sheet_id: day.run_sheet_id,
        run_sheet_day_id: day.id,
        escalation_type: "cutoff_missed",
        level: 1,
        reason: `Cut-off missed: ${category} due ${dueStr}`,
        metadata: { cutoff_datetime: day.cutoff_datetime, run_sheet_day_id: day.id, cutoff_category: category },
        created_by_label: SYSTEM_LABEL,
      });
      await supabase.from("run_sheet_days").update({ escalation_state: "warning", updated_at: now.toISOString() }).eq("id", day.id);
      result.created += 1;
      result.byType.cutoff_missed = (result.byType.cutoff_missed ?? 0) + 1;
      createdThisRunByDay.set(day.id, Math.max(createdThisRunByDay.get(day.id) ?? 0, 1));
    }

    const maxLevel = maxLevelForDay(day.id) || (nowMs > cutoffAt ? 1 : 0);
    if (nowMs >= cutoffAt + day24 && maxLevel < 2) {
      const existingLevel2 = (openEscalations ?? []).some(
        (e) => e.run_sheet_day_id === day.id && e.level >= 2
      );
      if (!existingLevel2) {
        await supabase.from("run_sheet_escalations").insert({
          project_id: projectId,
          run_sheet_id: day.run_sheet_id,
          run_sheet_day_id: day.id,
          escalation_type: "cutoff_missed",
          level: 2,
          reason: "Cut-off overdue >24h",
          metadata: { cutoff_datetime: day.cutoff_datetime, run_sheet_day_id: day.id, cutoff_category: category, suggested_action: "Owner call / reschedule pour" },
          created_by_label: SYSTEM_LABEL,
        });
        await supabase.from("run_sheet_days").update({ escalation_state: "action", updated_at: now.toISOString() }).eq("id", day.id);
        result.created += 1;
        result.byType.cutoff_missed = (result.byType.cutoff_missed ?? 0) + 1;
        createdThisRunByDay.set(day.id, Math.max(createdThisRunByDay.get(day.id) ?? 0, 2));
      }
    }

    if (nowMs >= cutoffAt + day72) {
      const hasLevel3 =
        (createdThisRunByDay.get(day.id) ?? 0) >= 3 ||
        (openEscalations ?? []).some(
          (e) => e.run_sheet_day_id === day.id && e.level >= 3
        );
      if (!hasLevel3) {
        await supabase.from("run_sheet_escalations").insert({
          project_id: projectId,
          run_sheet_id: day.run_sheet_id,
          run_sheet_day_id: day.id,
          escalation_type: "cutoff_missed",
          level: 3,
          reason: "Cut-off overdue >72h — intervention required",
          metadata: { cutoff_datetime: day.cutoff_datetime, run_sheet_day_id: day.id, cutoff_category: category },
          created_by_label: SYSTEM_LABEL,
        });
        await supabase.from("run_sheet_days").update({ escalation_state: "intervention", updated_at: now.toISOString() }).eq("id", day.id);
        result.created += 1;
        result.byType.cutoff_missed = (result.byType.cutoff_missed ?? 0) + 1;
        createdThisRunByDay.set(day.id, 3);
      }
    }
  }

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: executions } = await supabase
    .from("daily_execution")
    .select("project_id, submitted_by_label")
    .gte("submitted_at", sevenDaysAgo.toISOString())
    .in("project_id", projectIds)
    .neq("status", "complete");

  const missCountByKey = new Map<string, number>();
  for (const ex of executions ?? []) {
    const key = `${ex.project_id}:${ex.submitted_by_label}`;
    missCountByKey.set(key, (missCountByKey.get(key) ?? 0) + 1);
  }
  for (const [key, count] of missCountByKey) {
    if (count < 2) continue;
    const [projectId] = key.split(":");
    if (openConsecutiveByProject.has(projectId)) continue;
    const rs = runSheets?.find((r) => r.project_id === projectId);
    if (!rs) continue;
    await supabase.from("run_sheet_escalations").insert({
      project_id: projectId,
      run_sheet_id: rs.id,
      run_sheet_day_id: null,
      escalation_type: "consecutive_misses",
      level: 2,
      reason: "2+ missed days this week — review supervision",
      metadata: { submitted_by_label: key.split(":")[1] },
      created_by_label: SYSTEM_LABEL,
    });
    result.created += 1;
    result.byType.consecutive_misses = (result.byType.consecutive_misses ?? 0) + 1;
    openConsecutiveByProject.add(projectId);
  }

  const isWed = now.getUTCDay() === 3;
  const hourUtc = now.getUTCHours();
  if (isWed && hourUtc >= 8) {
    const weekStart = getWeekStart(now);
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    for (const projectId of projectIds) {
      if (openMidweekByProject.has(projectId)) continue;
      const sheets = runSheets?.filter((r) => r.project_id === projectId) ?? [];
      if (sheets.length === 0) continue;
      const runSheetId = sheets[0].id;
      const { data: days } = await supabase
        .from("run_sheet_days")
        .select("id, cutoff_datetime, cutoff_confirmed_at")
        .eq("run_sheet_id", runSheetId);
      let needsReview = false;
      for (const d of days ?? []) {
        if (!d.cutoff_datetime) continue;
        const cut = new Date(d.cutoff_datetime);
        if (cut <= in48h && cut >= now && !d.cutoff_confirmed_at) needsReview = true;
      }
      if (!needsReview) {
        const { data: execs } = await supabase
          .from("daily_execution")
          .select("status")
          .eq("project_id", projectId)
          .gte("submitted_at", new Date(now).toISOString().slice(0, 10));
        const hasPartialOrMissed = (execs ?? []).some((e) => e.status !== "complete");
        if (hasPartialOrMissed) needsReview = true;
      }
      if (needsReview) {
        await supabase.from("run_sheet_escalations").insert({
          project_id: projectId,
          run_sheet_id: runSheetId,
          run_sheet_day_id: null,
          escalation_type: "midweek_review",
          level: 2,
          reason: "Mid-week review required — check remaining days",
          metadata: { week_start: weekStart },
          created_by_label: SYSTEM_LABEL,
        });
        result.created += 1;
        result.byType.midweek_review = (result.byType.midweek_review ?? 0) + 1;
        openMidweekByProject.add(projectId);
      }
    }
  }

  const isMonday = now.getUTCDay() === 1;
  const mondayHourUtc = now.getUTCHours();
  if (isMonday) {
    const weekStart = getWeekStart(now);
    const { data: reviews } = await supabase
      .from("weekly_logistics_reviews")
      .select("project_id")
      .eq("week_start_date", weekStart)
      .in("project_id", projectIds);
    const reviewedProjectIds = new Set((reviews ?? []).map((r) => r.project_id));
    for (const projectId of projectIds) {
      if (reviewedProjectIds.has(projectId)) continue;
      const sheets = runSheets?.filter((r) => r.project_id === projectId) ?? [];
      if (sheets.length === 0) continue;
      const runSheetId = sheets[0].id;
      const key = `${projectId}:${weekStart}`;
      const existing = openWeeklyLogisticsByProject.get(key);
      if (existing) {
        if (existing.level === 1 && mondayHourUtc >= 12) {
          await supabase
            .from("run_sheet_escalations")
            .update({ level: 2, metadata: { week_start: weekStart } })
            .eq("id", existing.id);
        }
        continue;
      }
      const level = mondayHourUtc >= 12 ? 2 : 1;
      await supabase.from("run_sheet_escalations").insert({
        project_id: projectId,
        run_sheet_id: runSheetId,
        run_sheet_day_id: null,
        escalation_type: "weekly_logistics_not_confirmed",
        level,
        reason:
          level >= 2
            ? "Weekly logistics check not confirmed — overdue (Monday 12:00)"
            : "Weekly logistics check required (Monday)",
        metadata: { week_start: weekStart },
        created_by_label: SYSTEM_LABEL,
      });
      result.created += 1;
      result.byType.weekly_logistics_not_confirmed =
        (result.byType.weekly_logistics_not_confirmed ?? 0) + 1;
      openWeeklyLogisticsByProject.set(key, { id: "", level });
    }
  }

  return result;
}
