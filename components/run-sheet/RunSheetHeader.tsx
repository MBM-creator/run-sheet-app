"use client";

import { useState } from "react";
import Link from "next/link";
import { useRunSheetAuth } from "@/contexts/RunSheetContext";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { RunSheetStatus } from "@/lib/types";

const STATUS_LABEL: Record<RunSheetStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  approved_pending_lock: "Approved (pending lock)",
  locked: "Locked",
};

interface DayRow {
  id: string;
  day_number: number;
  calendar_date: string | null;
}

interface RunSheetHeaderProps {
  projectId: string;
  projectName: string;
  siteAddress: string | null;
  runSheet: {
    id: string;
    version: number;
    status: RunSheetStatus;
    supervisor_confirmed_at: string | null;
  } | null;
  days: DayRow[];
  weekStartDate?: string;
  hasWeeklyLogisticsReview?: boolean;
  onOpenProposeModal?: () => void;
  onOpenImportCsvModal?: () => void;
}

export function RunSheetHeader({
  projectId,
  projectName,
  siteAddress,
  runSheet,
  days,
  weekStartDate,
  hasWeeklyLogisticsReview = true,
  onOpenProposeModal,
  onOpenImportCsvModal,
}: RunSheetHeaderProps) {
  const { role, token } = useRunSheetAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const basePath = `/projects/${projectId}/run-sheet`;
  const tokenQ = token ? `?token=${encodeURIComponent(token)}` : "";
  const now = new Date();
  const isMonday = now.getUTCDay() === 1;
  const showWeeklyLogisticsButton =
    runSheet &&
    (role === "owner" || role === "supervisor") &&
    isMonday &&
    weekStartDate &&
    !hasWeeklyLogisticsReview;

  const dateRange =
    days.length > 0 && days[0].calendar_date && days[days.length - 1].calendar_date
      ? `${days[0].calendar_date} – ${days[days.length - 1].calendar_date}`
      : null;

  async function doCreate() {
    setLoading("create");
    try {
      const res = await fetch("/api/run-sheet/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ project_id: projectId, seed_days_from_start: true }),
      });
      if (res.ok) window.location.reload();
      else alert((await res.json()).error ?? "Failed");
    } finally {
      setLoading(null);
    }
  }

  async function doStatus(next: RunSheetStatus) {
    if (!runSheet) return;
    setLoading("status");
    try {
      const res = await fetch("/api/run-sheet/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ run_sheet_id: runSheet.id, status: next }),
      });
      if (res.ok) window.location.reload();
      else alert((await res.json()).error ?? "Failed");
    } finally {
      setLoading(null);
    }
  }

  async function doWeeklyLogisticsComplete() {
    if (!weekStartDate) return;
    setLoading("logistics");
    try {
      const res = await fetch("/api/run-sheet/logistics-review", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ project_id: projectId, week_start_date: weekStartDate }),
      });
      if (res.ok) window.location.reload();
      else alert((await res.json()).error ?? "Failed");
    } finally {
      setLoading(null);
    }
  }

  const isOwner = role === "owner";
  const isSupervisor = role === "supervisor";
  const canLock =
    runSheet?.status === "approved_pending_lock" && runSheet?.supervisor_confirmed_at;

  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">{projectName}</h1>
          {siteAddress && (
            <p className="mt-1 text-sm text-zinc-600">{siteAddress}</p>
          )}
          {runSheet && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  runSheet.status === "locked"
                    ? "success"
                    : runSheet.status === "draft"
                      ? "default"
                      : "info"
                }
              >
                {STATUS_LABEL[runSheet.status]}
              </Badge>
              <span className="text-sm text-zinc-500">v{runSheet.version}</span>
              {dateRange && (
                <span className="text-sm text-zinc-500">{dateRange}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwner && onOpenImportCsvModal && (
            <Button variant="secondary" onClick={onOpenImportCsvModal}>
              Import from Excel (CSV)
            </Button>
          )}
          {isOwner && !runSheet && (
            <Button
              onClick={doCreate}
              disabled={!!loading}
            >
              {loading === "create" ? "Creating…" : "Create run sheet"}
            </Button>
          )}
          {isOwner && runSheet?.status === "draft" && (
            <Button
              onClick={() => doStatus("in_review")}
              disabled={!!loading}
            >
              {loading === "status" ? "Sending…" : "Send to review"}
            </Button>
          )}
          {isOwner && runSheet && (
            <Link href={`${basePath}/proposals${tokenQ}`}>
              <Button variant="secondary">Open proposals</Button>
            </Link>
          )}
          {isOwner && canLock && (
            <Button
              variant="primary"
              onClick={() => doStatus("locked")}
              disabled={!!loading}
            >
              {loading === "status" ? "Locking…" : "Lock"}
            </Button>
          )}
          {isSupervisor && runSheet?.status === "in_review" && onOpenProposeModal && (
            <Button variant="secondary" onClick={onOpenProposeModal}>
              Propose changes
            </Button>
          )}
          {showWeeklyLogisticsButton && (
            <Button
              variant="secondary"
              onClick={doWeeklyLogisticsComplete}
              disabled={!!loading}
            >
              {loading === "logistics" ? "Saving…" : "Weekly Logistics Check Complete"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
