"use client";

import { useState } from "react";
import Link from "next/link";
import { RunSheetHeader } from "@/components/run-sheet/RunSheetHeader";
import { WeekActionsPanel } from "@/components/run-sheet/WeekActionsPanel";
import { RunSheetTable } from "@/components/run-sheet/RunSheetTable";
import { ProposeChangeModal } from "@/components/run-sheet/ProposeChangeModal";
import { SupervisorConfirmCard } from "@/components/run-sheet/SupervisorConfirmCard";
import { CutoffConfirmModal } from "@/components/run-sheet/CutoffConfirmModal";
import { EscalationBanner } from "@/components/run-sheet/EscalationBanner";
import { MidweekReviewModal } from "@/components/run-sheet/MidweekReviewModal";
import { EscalationInboxModal } from "@/components/run-sheet/EscalationInboxModal";
import { RunSheetScoreboard } from "@/components/run-sheet/RunSheetScoreboard";
import { ImportRunSheetCsvModal } from "@/components/run-sheet/ImportRunSheetCsvModal";
import { useRunSheetAuth } from "@/contexts/RunSheetContext";
import type { RunSheetStatus } from "@/lib/types";

interface DayRow {
  id: string;
  day_number: number;
  calendar_date: string | null;
  outcomes_text: string | null;
  logistics_text: string | null;
  cutoff_datetime: string | null;
  cutoff_category: string | null;
  cutoff_override_reason: string | null;
  cutoff_confirmed_at?: string | null;
  cutoff_confirmed_by_label?: string | null;
  cutoff_confirm_note?: string | null;
  planned_labour_hours?: number | null;
}

interface CutoffRow {
  id: string;
  day_number: number;
  calendar_date: string | null;
  cutoff_datetime: string;
  cutoff_category: string | null;
  status: "confirmed" | "overdue" | "due";
  cutoff_confirmed_at?: string | null;
  cutoff_confirmed_by_label?: string | null;
  cutoff_confirm_note?: string | null;
  escalation_state?: string | null;
}

export interface EscalationForView {
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

interface RunSheetViewProps {
  projectId: string;
  projectName: string;
  siteAddress: string | null;
  projectStartDate: string | null;
  runSheet: {
    id: string;
    version: number;
    status: RunSheetStatus;
    supervisor_confirmed_at: string | null;
    hours_agreed?: number | null;
    hours_used?: number | null;
  } | null;
  days: DayRow[];
  pendingByDay: Record<string, number>;
  cutoffs: CutoffRow[];
  token: string;
  openEscalations: EscalationForView[];
  escalationCountLevel2Plus: number;
  escalationsByDayId: Record<string, EscalationForView[]>;
  weekStartDate: string;
  hasWeeklyLogisticsReview: boolean;
  resolvedThisWeek: number;
  currentDay: number | null;
  totalDays: number;
}

export function RunSheetView({
  projectId,
  projectName,
  siteAddress,
  projectStartDate,
  runSheet,
  days,
  pendingByDay,
  cutoffs,
  token,
  openEscalations,
  escalationCountLevel2Plus,
  escalationsByDayId,
  weekStartDate,
  hasWeeklyLogisticsReview,
  resolvedThisWeek,
  currentDay,
  totalDays,
}: RunSheetViewProps) {
  const { role } = useRunSheetAuth();
  const [proposeModalOpen, setProposeModalOpen] = useState(false);
  const [importCsvModalOpen, setImportCsvModalOpen] = useState(false);
  const [cutoffConfirmDay, setCutoffConfirmDay] = useState<CutoffRow | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [midweekModalDismissed, setMidweekModalDismissed] = useState(false);
  const basePath = `/projects/${projectId}/run-sheet`;
  const tokenQ = token ? `?token=${encodeURIComponent(token)}` : "";
  const dayOptions = days.map((d) => ({
    id: d.id,
    day_number: d.day_number,
    calendar_date: d.calendar_date,
  }));
  const midweekEscalations = openEscalations.filter((e) => e.escalation_type === "midweek_review");
  const isSnoozed = (e: EscalationForView) => {
    const until = e.metadata && typeof (e.metadata as Record<string, unknown>).snoozed_until === "string"
      ? (e.metadata as Record<string, unknown>).snoozed_until as string
      : null;
    return until ? new Date(until) > new Date() : false;
  };
  const hasMidweekReview = midweekEscalations.some((e) => !isSnoozed(e));
  const showMidweekModal = hasMidweekReview && !midweekModalDismissed;
  const firstMidweekId = midweekEscalations.find((e) => !isSnoozed(e))?.id ?? null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {escalationCountLevel2Plus > 0 && (
          <EscalationBanner
            count={escalationCountLevel2Plus}
            onOpenInbox={() => setInboxOpen(true)}
          />
        )}
        {showMidweekModal && firstMidweekId && (
          <MidweekReviewModal
            projectName={projectName}
            count={openEscalations.length}
            escalationId={firstMidweekId}
            token={token}
            onStartReview={() => setMidweekModalDismissed(true)}
            onSnooze={role === "owner" ? () => setMidweekModalDismissed(true) : undefined}
          />
        )}
        {importCsvModalOpen && (
          <ImportRunSheetCsvModal
            projectId={projectId}
            projectStartDate={projectStartDate}
            token={token}
            onClose={() => setImportCsvModalOpen(false)}
            onSuccess={(redirectUrl) => {
              setImportCsvModalOpen(false);
              window.location.href = redirectUrl;
            }}
          />
        )}
        {inboxOpen && (
          <EscalationInboxModal
            projectId={projectId}
            projectName={projectName}
            token={token}
            onClose={() => setInboxOpen(false)}
            onResolved={() => window.location.reload()}
          />
        )}
        <RunSheetHeader
          projectId={projectId}
          projectName={projectName}
          siteAddress={siteAddress}
          runSheet={runSheet}
          days={days}
          weekStartDate={weekStartDate}
          hasWeeklyLogisticsReview={hasWeeklyLogisticsReview}
          onOpenProposeModal={() => setProposeModalOpen(true)}
          onOpenImportCsvModal={role === "owner" ? () => setImportCsvModalOpen(true) : undefined}
        />
        <RunSheetScoreboard
          currentDay={currentDay}
          totalDays={totalDays}
          hoursAgreed={runSheet?.hours_agreed ?? null}
          hoursUsed={runSheet?.hours_used ?? null}
          escalationCountLevel2Plus={escalationCountLevel2Plus}
          resolvedThisWeek={resolvedThisWeek}
          onOpenInbox={() => setInboxOpen(true)}
          role={role}
          runSheetId={runSheet?.id ?? null}
          token={token}
        />
        <WeekActionsPanel
          cutoffs={cutoffs}
          role={role}
          escalationsByDayId={escalationsByDayId}
          onConfirmCutoff={(c) => setCutoffConfirmDay(c)}
          onOpenInbox={() => setInboxOpen(true)}
        />
        {cutoffConfirmDay && (
          <CutoffConfirmModal
            runSheetDayId={cutoffConfirmDay.id}
            projectId={projectId}
            dayLabel={`Day ${cutoffConfirmDay.day_number}${cutoffConfirmDay.calendar_date ? ` (${cutoffConfirmDay.calendar_date})` : ""}`}
            onClose={() => setCutoffConfirmDay(null)}
            onSuccess={() => window.location.reload()}
          />
        )}
        {runSheet?.status === "approved_pending_lock" && (
          <div className="mt-4">
            <SupervisorConfirmCard
              runSheetId={runSheet.id}
              supervisorConfirmedAt={runSheet.supervisor_confirmed_at}
            />
          </div>
        )}
        <div className="mt-6">
          {runSheet && days.length > 0 ? (
            <RunSheetTable
              runSheetId={runSheet.id}
              runSheetStatus={runSheet.status}
              days={days}
              pendingByDay={pendingByDay}
              projectId={projectId}
              escalationsByDayId={escalationsByDayId}
              onOpenEscalationInbox={() => setInboxOpen(true)}
              onConfirmCutoff={(day) => setCutoffConfirmDay({
                id: day.id,
                day_number: day.day_number,
                calendar_date: day.calendar_date ?? null,
                cutoff_datetime: day.cutoff_datetime!,
                cutoff_category: day.cutoff_category ?? null,
                status: day.cutoff_confirmed_at ? "confirmed" : new Date(day.cutoff_datetime!) < new Date() ? "overdue" : "due",
                cutoff_confirmed_at: day.cutoff_confirmed_at ?? null,
                cutoff_confirmed_by_label: day.cutoff_confirmed_by_label ?? null,
                cutoff_confirm_note: day.cutoff_confirm_note ?? null,
              })}
              onUnconfirmCutoff={async (day) => {
                const res = await fetch("/api/run-sheet/cutoff/unconfirm", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    project_id: projectId,
                    run_sheet_day_id: day.id,
                  }),
                });
                if (res.ok) window.location.reload();
                else alert((await res.json()).error ?? "Failed to unconfirm");
              }}
            />
          ) : (
            <p className="rounded-lg border border-zinc-200 bg-white p-6 text-zinc-600">
              No run sheet yet. As the project owner, use &quot;Create run sheet&quot; to
              get started.
            </p>
          )}
        </div>
        {proposeModalOpen && runSheet && (
          <ProposeChangeModal
            runSheetId={runSheet.id}
            days={dayOptions}
            onClose={() => setProposeModalOpen(false)}
            onSuccess={() => window.location.reload()}
          />
        )}
        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href={`/projects/${projectId}/eod${tokenQ}`}
            className="text-sm font-medium text-zinc-700 underline hover:no-underline"
          >
            End of day
          </Link>
          {runSheet && (
            <Link
              href={`${basePath}/print${tokenQ}`}
              className="text-sm font-medium text-zinc-700 underline hover:no-underline"
            >
              Print view
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
