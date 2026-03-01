"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { OPS_FLAG_LABELS } from "@/lib/ui/ops-flags-labels";

interface EscalationItem {
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
  run_sheet_day?: { day_number: number; calendar_date: string | null } | null;
}

interface EscalationInboxModalProps {
  projectId: string;
  projectName: string;
  token: string;
  onClose: () => void;
  onResolved: () => void;
}

function LevelBadge({ level }: { level: number }) {
  const label = level >= 3 ? OPS_FLAG_LABELS.level3Label : level >= 2 ? OPS_FLAG_LABELS.level2Label : OPS_FLAG_LABELS.level1Label;
  if (level >= 3) return <Badge variant="danger">{label}</Badge>;
  if (level >= 2) return <Badge variant="warning">{label}</Badge>;
  return <Badge variant="default">{label}</Badge>;
}

export function EscalationInboxModal({
  projectId,
  projectName,
  token,
  onClose,
  onResolved,
}: EscalationInboxModalProps) {
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveLevel, setResolveLevel] = useState<number>(1);
  const [resolutionNote, setResolutionNote] = useState("");
  const [recoveryPlan, setRecoveryPlan] = useState("");
  const [assignId, setAssignId] = useState<string | null>(null);
  const [assignToLabel, setAssignToLabel] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filterLevel, setFilterLevel] = useState<number>(2); // default ≥ 2
  const [filterType, setFilterType] = useState<string>("");

  const MIN_RESOLUTION_NOTE = 20;
  const MIN_RECOVERY_PLAN = 50;

  const fetchEscalations = async () => {
    setLoading(true);
    const url = `/api/run-sheet/escalations?project_id=${encodeURIComponent(projectId)}&open_only=true`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setEscalations(Array.isArray(data) ? data : []);
    } else {
      setEscalations([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEscalations();
  }, [projectId, token]);

  const filtered = escalations.filter((e) => {
    if (e.level < filterLevel) return false;
    if (filterType && e.escalation_type !== filterType) return false;
    return true;
  });

  const handleResolve = async () => {
    if (!resolveId) return;
    if (resolutionNote.trim().length < MIN_RESOLUTION_NOTE) {
      alert(`Resolution note is required (min ${MIN_RESOLUTION_NOTE} characters).`);
      return;
    }
    if (resolveLevel === 3 && recoveryPlan.trim().length < MIN_RECOVERY_PLAN) {
      alert(`Level 3 requires a recovery plan (min ${MIN_RECOVERY_PLAN} characters).`);
      return;
    }
    setSubmitting(true);
    const body: { resolution_note: string; recovery_plan?: string } = {
      resolution_note: resolutionNote.trim(),
    };
    if (resolveLevel === 3 && recoveryPlan.trim()) body.recovery_plan = recoveryPlan.trim();
    const res = await fetch(`/api/run-sheet/escalations/${resolveId}/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (res.ok) {
      setResolveId(null);
      setResolutionNote("");
      setRecoveryPlan("");
      await fetchEscalations();
      onResolved();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Failed to resolve");
    }
  };

  const handleAssign = async () => {
    if (!assignId || !assignToLabel.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/run-sheet/escalations/${assignId}/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        assign_to_label: assignToLabel.trim(),
        note: assignNote || undefined,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setAssignId(null);
      setAssignToLabel("");
      setAssignNote("");
      await fetchEscalations();
      onResolved();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Failed to assign");
    }
  };

  const assignedTo = (e: EscalationItem) =>
    (e.metadata && typeof e.metadata.assigned_to === "string"
      ? e.metadata.assigned_to
      : null) as string | null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 className="text-lg font-semibold">{OPS_FLAG_LABELS.modalTitle} — {projectName}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-zinc-200 px-4 py-2">
          <label className="flex items-center gap-1 text-sm">
            Level ≥
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(Number(e.target.value))}
              className="rounded border border-zinc-300 px-2 py-1 text-sm"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <label className="flex items-center gap-1 text-sm">
            Type
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1 text-sm"
            >
              <option value="">All</option>
              <option value="cutoff_missed">cutoff_missed</option>
              <option value="consecutive_misses">consecutive_misses</option>
              <option value="midweek_review">midweek_review</option>
              <option value="weekly_logistics_not_confirmed">weekly_logistics_not_confirmed</option>
            </select>
          </label>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-zinc-500">No open escalations match the filters.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-600">
                  <th className="px-2 py-2 font-medium">Created</th>
                  <th className="px-2 py-2 font-medium">Level</th>
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 font-medium">Day</th>
                  <th className="px-2 py-2 font-medium">Reason</th>
                  <th className="px-2 py-2 font-medium">Assigned</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-zinc-100">
                    <td className="px-2 py-2 text-zinc-600">
                      {new Date(e.created_at).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-2 py-2">
                      <LevelBadge level={e.level} />
                    </td>
                    <td className="px-2 py-2">{e.escalation_type}</td>
                    <td className="px-2 py-2">
                      {e.run_sheet_day
                        ? `Day ${e.run_sheet_day.day_number}${e.run_sheet_day.calendar_date ? ` (${e.run_sheet_day.calendar_date})` : ""}`
                        : "—"}
                    </td>
                    <td className="max-w-xs px-2 py-2 truncate" title={e.reason}>
                      {e.reason}
                    </td>
                    <td className="px-2 py-2">{assignedTo(e) ?? "—"}</td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setAssignId(e.id)}
                        >
                          Assign
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setResolveId(e.id);
                            setResolveLevel(e.level);
                            setResolutionNote("");
                            setRecoveryPlan("");
                          }}
                        >
                          Resolve
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {resolveId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h3 className="font-semibold">{OPS_FLAG_LABELS.modalResolveTitle}</h3>
            <p className="mt-1 text-sm text-zinc-600">Resolution note (required, min {MIN_RESOLUTION_NOTE} characters)</p>
            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              className="mt-2 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              rows={3}
              placeholder="What was done to resolve this?"
            />
            {resolveLevel === 3 && (
              <>
                <p className="mt-3 text-sm text-zinc-600">Recovery plan (required for level 3, min {MIN_RECOVERY_PLAN} characters)</p>
                <textarea
                  value={recoveryPlan}
                  onChange={(e) => setRecoveryPlan(e.target.value)}
                  className="mt-2 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                  rows={4}
                  placeholder="Recovery plan and next steps..."
                />
              </>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setResolveId(null); setResolutionNote(""); setRecoveryPlan(""); }}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleResolve}
                disabled={
                  submitting ||
                  resolutionNote.trim().length < MIN_RESOLUTION_NOTE ||
                  (resolveLevel === 3 && recoveryPlan.trim().length < MIN_RECOVERY_PLAN)
                }
              >
                {submitting ? "Saving…" : "Resolve"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {assignId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h3 className="font-semibold">{OPS_FLAG_LABELS.modalAssignTitle}</h3>
            <label className="mt-2 block text-sm text-zinc-600">
              Assign to (label)
            </label>
            <input
              type="text"
              value={assignToLabel}
              onChange={(e) => setAssignToLabel(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              placeholder="e.g. Jane Smith"
            />
            <label className="mt-2 block text-sm text-zinc-600">Note (optional)</label>
            <input
              type="text"
              value={assignNote}
              onChange={(e) => setAssignNote(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAssignId(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAssign}
                disabled={submitting || !assignToLabel.trim()}
              >
                {submitting ? "Saving…" : "Assign"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
