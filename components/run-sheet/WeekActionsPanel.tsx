"use client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { OPS_FLAG_LABELS } from "@/lib/ui/ops-flags-labels";

export type CutoffStatus = "confirmed" | "overdue" | "due";

interface CutoffRow {
  id: string;
  day_number: number;
  calendar_date: string | null;
  cutoff_datetime: string;
  cutoff_category: string | null;
  status: CutoffStatus;
  cutoff_confirmed_at?: string | null;
  cutoff_confirmed_by_label?: string | null;
  cutoff_confirm_note?: string | null;
  escalation_state?: string | null;
}

interface EscalationForPanel {
  id: string;
  level: number;
  reason: string;
  created_at: string;
  escalation_type: string;
}

interface WeekActionsPanelProps {
  cutoffs: CutoffRow[];
  role: "owner" | "supervisor" | "crew";
  escalationsByDayId?: Record<string, EscalationForPanel[]>;
  onConfirmCutoff: (cutoff: CutoffRow) => void;
  onOpenInbox?: () => void;
}

function StatusPill({ status }: { status: CutoffStatus }) {
  if (status === "confirmed") {
    return <Badge variant="success">{OPS_FLAG_LABELS.confirmedText}</Badge>;
  }
  if (status === "overdue") {
    return <Badge variant="danger">Overdue</Badge>;
  }
  return <Badge variant="warning">{OPS_FLAG_LABELS.dueText}</Badge>;
}

export function WeekActionsPanel({
  cutoffs,
  role,
  escalationsByDayId = {},
  onConfirmCutoff,
  onOpenInbox,
}: WeekActionsPanelProps) {
  const canConfirm = role === "owner" || role === "supervisor";
  const isOwner = role === "owner";

  if (cutoffs.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">
          Actions required this week
        </h2>
        <p className="mt-2 text-sm text-zinc-500">No cut-offs due in the next 7 days.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">
        Actions required this week
      </h2>
      <ul className="mt-2 space-y-2">
        {cutoffs.map((c) => {
          const dayEscalations = escalationsByDayId[c.id] ?? [];
          const topLevel = dayEscalations.length > 0
            ? Math.max(...dayEscalations.map((e) => e.level))
            : 0;
          const escalationLabel =
            topLevel >= 3 ? OPS_FLAG_LABELS.level3Label : topLevel >= 2 ? OPS_FLAG_LABELS.level2Label : topLevel >= 1 ? OPS_FLAG_LABELS.level1Label : null;
          const age =
            dayEscalations.length > 0
              ? (() => {
                  const created = dayEscalations[0].created_at;
                  const ms = Date.now() - new Date(created).getTime();
                  const h = Math.floor(ms / 3600000);
                  const d = Math.floor(h / 24);
                  if (d > 0) return `${d}d ago`;
                  if (h > 0) return `${h}h ago`;
                  return "Just now";
                })()
              : null;
          return (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-2 text-sm text-zinc-700"
            >
              <span className="font-medium">
                {new Date(c.cutoff_datetime).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
                {c.cutoff_category ?? "—"}
              </span>
              <span className="text-zinc-500">
                Day {c.day_number}
                {c.calendar_date ? ` (${c.calendar_date})` : ""}
              </span>
              <StatusPill status={c.status} />
              {escalationLabel && (
                <>
                  <Badge variant={topLevel >= 3 ? "danger" : "warning"}>
                    {escalationLabel}
                    {age ? ` · ${age}` : ""}
                  </Badge>
                </>
              )}
              {c.status === "confirmed" && c.cutoff_confirmed_by_label && (
                <span className="text-zinc-500 text-xs">
                  by {c.cutoff_confirmed_by_label}
                  {c.cutoff_confirm_note ? ` · ${c.cutoff_confirm_note}` : ""}
                </span>
              )}
              {canConfirm && c.status !== "confirmed" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onConfirmCutoff(c)}
                >
                  Mark confirmed
                </Button>
              )}
              {isOwner && dayEscalations.length > 0 && onOpenInbox && (
                <Button variant="secondary" size="sm" onClick={onOpenInbox}>
                  {OPS_FLAG_LABELS.openInboxText}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
