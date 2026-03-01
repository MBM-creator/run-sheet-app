"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRunSheetAuth } from "@/contexts/RunSheetContext";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { OPS_FLAG_LABELS } from "@/lib/ui/ops-flags-labels";

interface TodayPlan {
  run_sheet_id: string | null;
  run_sheet_day_id: string | null;
  outcomes_text: string | null;
  logistics_text: string | null;
  day_number?: number;
  calendar_date?: string | null;
  link: string | null;
}

interface Level2Escalation {
  id: string;
  level: number;
  reason: string;
  escalation_type: string;
}

interface EODViewProps {
  projectId: string;
  projectName: string;
  token: string;
  initialDate: string;
  openLevel2Escalations: Level2Escalation[];
  openLevel2Count: number;
}

const MIN_ACK_NOTE = 20;

export function EODView({
  projectId,
  projectName,
  token,
  initialDate,
  openLevel2Escalations,
  openLevel2Count,
}: EODViewProps) {
  const { role } = useRunSheetAuth();
  const [date, setDate] = useState(initialDate);
  const [plan, setPlan] = useState<TodayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"complete" | "partial" | "missed">("complete");
  const [reason, setReason] = useState<"weather" | "variation" | "other">("weather");
  const [explanation, setExplanation] = useState("");
  const [recoveryPlan, setRecoveryPlan] = useState("");
  const [actualNotes, setActualNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [acknowledgedThisSession, setAcknowledgedThisSession] = useState(false);
  const [ackNote, setAckNote] = useState("");
  const [ackSubmitting, setAckSubmitting] = useState(false);
  const canAcknowledge = role === "owner" || role === "supervisor";
  const showBlockingSection = openLevel2Count > 0 && !acknowledgedThisSession;
  const submitBlocked = openLevel2Count > 0 && !acknowledgedThisSession;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(
      `/api/eod/today-plan?project_id=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setPlan(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, date, token]);

  async function acknowledge() {
    if (ackNote.trim().length < MIN_ACK_NOTE) {
      alert(`Comment must be at least ${MIN_ACK_NOTE} characters.`);
      return;
    }
    setAckSubmitting(true);
    try {
      const res = await fetch("/api/run-sheet/escalations/acknowledge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          project_id: projectId,
          escalation_ids: openLevel2Escalations.map((e) => e.id),
          note: ackNote.trim(),
        }),
      });
      if (res.ok) setAcknowledgedThisSession(true);
      else alert((await res.json()).error ?? "Failed to acknowledge");
    } finally {
      setAckSubmitting(false);
    }
  }

  async function submit() {
    if (!plan?.run_sheet_day_id) {
      alert("No plan for this date to submit against.");
      return;
    }
    if (status !== "complete" && !recoveryPlan.trim()) {
      alert("Recovery plan is required when status is not complete.");
      return;
    }
    if (reason === "other" && !explanation.trim()) {
      alert("Explanation is required when reason is 'other'.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/eod/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          project_id: projectId,
          run_sheet_day_id: plan.run_sheet_day_id,
          status,
          reason,
          explanation: explanation.trim() || undefined,
          recovery_plan: recoveryPlan.trim() || undefined,
          actual_notes: actualNotes.trim() || undefined,
        }),
      });
      if (res.ok) setSubmitted(true);
      else alert((await res.json()).error ?? "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  const tokenQ = `?token=${encodeURIComponent(token)}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">
          End of day — {projectName}
        </h1>
        <Link href={`/projects/${projectId}/run-sheet${tokenQ}`}>
          <Button variant="secondary">Back to run sheet</Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <label className="block text-sm font-medium text-zinc-700">
            Date
          </label>
          <input
            type="date"
            className="mt-1 rounded border border-zinc-300 px-3 py-2 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </CardHeader>
      </Card>

      {loading ? (
        <p className="text-zinc-500">Loading plan…</p>
      ) : !plan?.run_sheet_id ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-zinc-600">
              No run sheet for this project, or no day matching this date.
            </p>
            <Link
              href={`/projects/${projectId}/run-sheet${tokenQ}`}
              className="mt-4 inline-block text-sm font-medium text-zinc-700 underline"
            >
              View run sheet
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {showBlockingSection && (
            <Card className="mb-6 border-amber-200 bg-amber-50">
              <CardHeader>
                <h2 className="font-semibold text-amber-900">
                  {OPS_FLAG_LABELS.bannerTitle.toUpperCase().replace(/\s+/g, " ")}
                </h2>
                <p className="mt-1 text-sm text-amber-800">
                  {OPS_FLAG_LABELS.bannerBody(openLevel2Count)}
                </p>
                <Link
                  href={`/projects/${projectId}/run-sheet${tokenQ}`}
                  className="mt-2 inline-block text-sm font-medium text-amber-800 underline"
                >
                  {OPS_FLAG_LABELS.viewItemsText}
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {canAcknowledge ? (
                  <>
                    <label className="block text-sm font-medium text-amber-900">
                      {OPS_FLAG_LABELS.commentLabel}
                    </label>
                    <textarea
                      className="w-full rounded border border-amber-300 px-3 py-2 text-sm"
                      rows={3}
                      value={ackNote}
                      onChange={(e) => setAckNote(e.target.value)}
                      placeholder={OPS_FLAG_LABELS.commentPlaceholder}
                    />
                    <Button
                      variant="primary"
                      onClick={acknowledge}
                      disabled={ackSubmitting || ackNote.trim().length < MIN_ACK_NOTE}
                    >
                      {ackSubmitting ? "Saving…" : OPS_FLAG_LABELS.acknowledgeLabel}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-amber-800">
                    {OPS_FLAG_LABELS.blockedCrewNote}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          {submitted ? (
            <Card>
              <CardContent className="py-8">
                <p className="font-medium text-green-800">
                  End of day submitted successfully.
                </p>
                <Link
                  href={`/projects/${projectId}/run-sheet${tokenQ}`}
                  className="mt-4 inline-block"
                >
                  <Button variant="secondary">Back to run sheet</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <h2 className="font-semibold">What we said we&apos;d do (from run sheet)</h2>
              {plan.calendar_date && (
                <p className="text-sm text-zinc-500">
                  Day {plan.day_number ?? ""} · {plan.calendar_date}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-zinc-500">Planned outcomes</p>
                <pre className="mt-1 whitespace-pre-wrap rounded bg-zinc-50 p-3 text-sm text-zinc-800">
                  {plan.outcomes_text ?? "—"}
                </pre>
              </div>
              {plan.logistics_text && (
                <div>
                  <p className="text-sm font-medium text-zinc-500">Planned logistics</p>
                  <pre className="mt-1 whitespace-pre-wrap rounded bg-zinc-50 p-3 text-sm text-zinc-800">
                    {plan.logistics_text}
                  </pre>
                </div>
              )}
              {plan.link && (
                <Link
                  href={`${plan.link}${tokenQ}`}
                  className="text-sm font-medium text-zinc-700 underline"
                >
                  Full run sheet
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold">What actually happened</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  What we actually did
                </label>
                <textarea
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                  rows={4}
                  value={actualNotes}
                  onChange={(e) => setActualNotes(e.target.value)}
                  placeholder="e.g. Stripped and poured 50m² pad. Steel fix booked for tomorrow."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Status
                </label>
                <select
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as "complete" | "partial" | "missed")
                  }
                >
                  <option value="complete">Complete</option>
                  <option value="partial">Partial</option>
                  <option value="missed">Missed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Reason (if not complete)
                </label>
                <select
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                  value={reason}
                  onChange={(e) =>
                    setReason(e.target.value as "weather" | "variation" | "other")
                  }
                >
                  <option value="weather">Weather</option>
                  <option value="variation">Variation</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {reason === "other" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700">
                    Explanation <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                    rows={2}
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                  />
                </div>
              )}
              {status !== "complete" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700">
                    Recovery plan <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                    rows={4}
                    value={recoveryPlan}
                    onChange={(e) => setRecoveryPlan(e.target.value)}
                  />
                </div>
              )}
              <Button
                onClick={submit}
                disabled={submitting || submitBlocked}
              >
                {submitting ? "Submitting…" : "Submit"}
              </Button>
            </CardContent>
          </Card>
        </>
          )}
        </>
      )}
    </div>
  );
}
