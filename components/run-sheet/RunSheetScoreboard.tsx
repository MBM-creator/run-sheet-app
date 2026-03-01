"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface RunSheetScoreboardProps {
  currentDay: number | null;
  totalDays: number;
  hoursAgreed: number | null;
  hoursUsed: number | null;
  escalationCountLevel2Plus: number;
  resolvedThisWeek: number;
  onOpenInbox?: () => void;
  role: "owner" | "supervisor" | "crew";
  runSheetId: string | null;
  token: string;
}

function hoursVariant(
  used: number | null,
  agreed: number | null
): "default" | "success" | "warning" | "danger" {
  if (used == null || agreed == null || agreed === 0) return "default";
  if (used <= agreed) return "success";
  const overPct = ((used - agreed) / agreed) * 100;
  if (overPct < 10) return "warning";
  return "danger";
}

export function RunSheetScoreboard({
  currentDay,
  totalDays,
  hoursAgreed,
  hoursUsed,
  escalationCountLevel2Plus,
  resolvedThisWeek,
  onOpenInbox,
  role,
  runSheetId,
  token,
}: RunSheetScoreboardProps) {
  const [hoursAgreedEdit, setHoursAgreedEdit] = useState<string>(
    hoursAgreed != null ? String(hoursAgreed) : ""
  );
  const [savingHours, setSavingHours] = useState(false);
  const [isEditingHours, setIsEditingHours] = useState(false);

  const canEditHours = (role === "owner" || role === "supervisor") && runSheetId;
  const hoursVariantResult = hoursVariant(hoursUsed, hoursAgreed);

  const dayLabel =
    totalDays > 0
      ? `Day ${currentDay ?? "—"} of ${totalDays}`
      : "—";

  const hoursLabel =
    hoursUsed != null && hoursAgreed != null
      ? `${hoursUsed} / ${hoursAgreed}`
      : hoursUsed != null
        ? `${hoursUsed} / —`
        : hoursAgreed != null
          ? `— / ${hoursAgreed}`
          : "— / —";

  async function saveHoursAgreed() {
    if (!runSheetId || !token) return;
    const val = parseFloat(hoursAgreedEdit);
    if (Number.isNaN(val) || val < 0) {
      setHoursAgreedEdit(hoursAgreed != null ? String(hoursAgreed) : "");
      setIsEditingHours(false);
      return;
    }
    setSavingHours(true);
    try {
      const res = await fetch("/api/run-sheet/hours", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ run_sheet_id: runSheetId, hours_agreed: val }),
      });
      if (res.ok) window.location.reload();
      else {
        const data = await res.json();
        alert(data.error ?? "Failed to save");
      }
    } finally {
      setSavingHours(false);
      setIsEditingHours(false);
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Week progress
          </span>
          <p className="mt-0.5 text-lg font-semibold text-zinc-900">{dayLabel}</p>
        </div>

        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Hours (used / agreed)
          </span>
          {canEditHours && isEditingHours ? (
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={0.5}
                className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm"
                value={hoursAgreedEdit}
                onChange={(e) => setHoursAgreedEdit(e.target.value)}
              />
              <Button
                variant="primary"
                disabled={savingHours}
                onClick={saveHoursAgreed}
              >
                {savingHours ? "Saving…" : "Save"}
              </Button>
              <button
                type="button"
                className="text-sm text-zinc-500 underline"
                onClick={() => {
                  setHoursAgreedEdit(hoursAgreed != null ? String(hoursAgreed) : "");
                  setIsEditingHours(false);
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <p className="mt-1 flex items-center gap-2">
              <Badge variant={hoursVariantResult}>{hoursLabel}</Badge>
              {canEditHours && (
                <button
                  type="button"
                  className="text-sm text-zinc-500 underline"
                  onClick={() => setIsEditingHours(true)}
                >
                  Edit agreed
                </button>
              )}
            </p>
          )}
        </div>

        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Delivery risk
          </span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge
              variant={
                escalationCountLevel2Plus > 0 ? "danger" : "success"
              }
            >
              {escalationCountLevel2Plus} active
            </Badge>
            <span className="text-sm text-zinc-600">
              {resolvedThisWeek} resolved this week
            </span>
            {role === "owner" && onOpenInbox && (
              <Button
                variant="secondary"
                className="!py-1 !text-sm"
                onClick={onOpenInbox}
              >
                Open Escalation Inbox
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
