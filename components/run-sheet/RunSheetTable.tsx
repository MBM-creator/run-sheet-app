"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useRunSheetAuth } from "@/contexts/RunSheetContext";
import { OPS_FLAG_LABELS } from "@/lib/ui/ops-flags-labels";
import type { RunSheetStatus } from "@/lib/types";

interface DayRow {
  id: string;
  day_number: number;
  calendar_date: string | null;
  outcomes_text: string | null;
  logistics_text: string | null;
  cutoff_datetime?: string | null;
  cutoff_category?: string | null;
  cutoff_confirmed_at?: string | null;
  cutoff_confirmed_by_label?: string | null;
  cutoff_confirm_note?: string | null;
}

interface EscalationForRow {
  id: string;
  level: number;
  reason: string;
  created_at: string;
  escalation_type: string;
  metadata: Record<string, unknown> | null;
}

interface RunSheetTableProps {
  runSheetId: string;
  runSheetStatus: RunSheetStatus;
  days: DayRow[];
  pendingByDay: Record<string, number>;
  projectId: string;
  escalationsByDayId?: Record<string, EscalationForRow[]>;
  onConfirmCutoff?: (day: DayRow) => void;
  onUnconfirmCutoff?: (day: DayRow) => void;
  onOpenEscalationInbox?: () => void;
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

export function RunSheetTable({
  runSheetId,
  runSheetStatus,
  days,
  pendingByDay,
  projectId,
  escalationsByDayId = {},
  onConfirmCutoff,
  onUnconfirmCutoff,
  onOpenEscalationInbox,
}: RunSheetTableProps) {
  const { role } = useRunSheetAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [escalationPanelDayId, setEscalationPanelDayId] = useState<string | null>(null);
  const canConfirmCutoff = role === "owner" || role === "supervisor";
  const canUnconfirmCutoff = role === "owner";
  const isOwner = role === "owner";

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 font-medium text-zinc-700">Day</th>
              <th className="px-4 py-3 font-medium text-zinc-700">Date</th>
              <th className="px-4 py-3 font-medium text-zinc-700">Outcomes</th>
              <th className="px-4 py-3 font-medium text-zinc-700">Proposals</th>
              <th className="px-4 py-3 font-medium text-zinc-700">Escalation</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const open = expandedId === day.id;
              const pending = pendingByDay[day.id] ?? 0;
              const today = isToday(day.calendar_date);
              const dayEscalations = escalationsByDayId[day.id] ?? [];
              const showEscalationPanel = escalationPanelDayId === day.id;
              const topLevel = dayEscalations.length > 0 ? Math.max(...dayEscalations.map((e) => e.level)) : 0;
              return (
                <tr
                  key={day.id}
                  className={`border-b border-zinc-100 ${today ? "bg-amber-50/50" : ""}`}
                >
                  <td className="px-4 py-2 font-medium">{day.day_number}</td>
                  <td className="px-4 py-2 text-zinc-600">
                    {day.calendar_date ?? "—"}
                  </td>
                  <td className="max-w-xs px-4 py-2">
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={() =>
                        setExpandedId(open ? null : day.id)
                      }
                    >
                      {day.outcomes_text
                        ? day.outcomes_text.slice(0, 60) +
                          (day.outcomes_text.length > 60 ? "…" : "")
                        : "—"}
                    </button>
                    {open && (
                      <div className="mt-2 rounded border border-zinc-200 bg-white p-3 text-zinc-700">
                        <p className="font-medium text-zinc-500">Outcomes</p>
                        <pre className="mt-1 whitespace-pre-wrap font-sans text-sm">
                          {day.outcomes_text || "—"}
                        </pre>
                        <p className="mt-2 font-medium text-zinc-500">Logistics</p>
                        <pre className="mt-1 whitespace-pre-wrap font-sans text-sm">
                          {day.logistics_text || "—"}
                        </pre>
                        {day.cutoff_datetime ? (
                          <div className="mt-3 border-t border-zinc-200 pt-3">
                            <p className="font-medium text-zinc-500">Cut-off</p>
                            <p className="mt-1 text-sm">
                              {new Date(day.cutoff_datetime).toLocaleString(undefined, {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                              {day.cutoff_category && ` · ${day.cutoff_category}`}
                            </p>
                            {day.cutoff_confirmed_at ? (
                              <p className="mt-1 text-sm text-green-700">
                                {OPS_FLAG_LABELS.confirmedText} by {day.cutoff_confirmed_by_label ?? "—"} at{" "}
                                {new Date(day.cutoff_confirmed_at).toLocaleString(undefined, {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                                {day.cutoff_confirm_note && ` · ${day.cutoff_confirm_note}`}
                              </p>
                            ) : new Date(day.cutoff_datetime) < new Date() ? (
                              <p className="mt-1 text-sm font-medium text-red-700">{OPS_FLAG_LABELS.overdueText}</p>
                            ) : (
                              <p className="mt-1 text-sm text-zinc-600">{OPS_FLAG_LABELS.dueText}</p>
                            )}
                            {canConfirmCutoff && !day.cutoff_confirmed_at && onConfirmCutoff && (
                              <Button
                                variant="secondary"
                                size="sm"
                                className="mt-2"
                                onClick={() => onConfirmCutoff(day)}
                              >
                                Confirm cut-off
                              </Button>
                            )}
                            {canUnconfirmCutoff && day.cutoff_confirmed_at && onUnconfirmCutoff && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 ml-2 text-zinc-500"
                                onClick={() => onUnconfirmCutoff(day)}
                              >
                                Unconfirm
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="mt-3 border-t border-zinc-200 pt-3">
                            <p className="text-sm text-zinc-500">No cut-off set</p>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {pending > 0 ? (
                      <Badge variant="warning">{pending} pending</Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {dayEscalations.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setEscalationPanelDayId(showEscalationPanel ? null : day.id)
                          }
                          className="text-left"
                        >
                          <Badge
                            variant={topLevel >= 3 ? "danger" : "warning"}
                            className="cursor-pointer hover:opacity-90"
                          >
                            {topLevel >= 3 ? OPS_FLAG_LABELS.level3Label : topLevel >= 2 ? OPS_FLAG_LABELS.level2Label : OPS_FLAG_LABELS.level1Label} · {dayEscalations.length} item
                            {dayEscalations.length !== 1 ? "s" : ""}
                          </Badge>
                        </button>
                        {showEscalationPanel && (
                          <div className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm">
                            {dayEscalations.map((e) => (
                              <div key={e.id} className="mb-2 last:mb-0">
                                <p className="font-medium text-zinc-800">
                                  {e.escalation_type} (Level {e.level})
                                </p>
                                <p className="text-zinc-600">{e.reason}</p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  {new Date(e.created_at).toLocaleString(undefined, {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}
                                </p>
                              </div>
                            ))}
                            {isOwner && onOpenEscalationInbox && (
                              <Button
                                variant="secondary"
                                size="sm"
                                className="mt-2"
                                onClick={onOpenEscalationInbox}
                              >
                                {OPS_FLAG_LABELS.openInboxText}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
