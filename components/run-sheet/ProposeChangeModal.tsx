"use client";

import { useState } from "react";
import { useRunSheetAuth } from "@/contexts/RunSheetContext";
import { Button } from "@/components/ui/Button";
import { getDefaultCutoffISO } from "@/lib/cutoff-rules";
import type { ProposalField } from "@/lib/types";
import type { CutoffCategory } from "@/lib/types";

const FIELDS: { value: ProposalField; label: string }[] = [
  { value: "outcomes", label: "Outcomes" },
  { value: "logistics", label: "Logistics" },
  { value: "cutoff", label: "Cut-off" },
  { value: "date", label: "Date" },
  { value: "sequencing", label: "Sequencing" },
];

const CUTOFF_CATEGORIES: { value: CutoffCategory; label: string }[] = [
  { value: "concrete", label: "Concrete" },
  { value: "pump", label: "Pump" },
  { value: "timber_nonstandard", label: "Timber (non-standard)" },
  { value: "pavers", label: "Pavers" },
  { value: "other", label: "Other" },
];

interface DayOption {
  id: string;
  day_number: number;
  calendar_date: string | null;
}

interface ProposeChangeModalProps {
  runSheetId: string;
  days: DayOption[];
  currentOutcomes?: string | null;
  currentLogistics?: string | null;
  currentCutoff?: string | null;
  currentCutoffCategory?: string | null;
  currentDate?: string | null;
  dayId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProposeChangeModal({
  runSheetId,
  days,
  currentOutcomes,
  currentLogistics,
  currentCutoff,
  currentCutoffCategory,
  currentDate,
  dayId,
  onClose,
  onSuccess,
}: ProposeChangeModalProps) {
  const { token } = useRunSheetAuth();
  const [field, setField] = useState<ProposalField>("outcomes");
  const [proposedValue, setProposedValue] = useState("");
  const [reason, setReason] = useState("");
  const [runSheetDayId, setRunSheetDayId] = useState<string | null>(dayId ?? null);
  const [cutoffCategory, setCutoffCategory] = useState<CutoffCategory>(
    (currentCutoffCategory as CutoffCategory) ?? "other"
  );
  const [cutoffDatetime, setCutoffDatetime] = useState(currentCutoff ?? "");
  const [cutoffOverrideReason, setCutoffOverrideReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyDefaultCutoff() {
    const day = days.find((d) => d.id === runSheetDayId);
    const date = day?.calendar_date ?? new Date().toISOString().slice(0, 10);
    const suggested = getDefaultCutoffISO(date, cutoffCategory);
    if (suggested) setCutoffDatetime(suggested);
  }

  async function submit() {
    setError(null);
    if (!reason.trim()) {
      setError("Reason is required.");
      return;
    }
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        run_sheet_id: runSheetId,
        field,
        reason: reason.trim(),
      };
      if (field === "cutoff") {
        if (!runSheetDayId) {
          setError("Select a day for cut-off proposal.");
          setLoading(false);
          return;
        }
        body.run_sheet_day_id = runSheetDayId;
        body.proposed_value = "";
        body.cutoff_category = cutoffCategory;
        body.cutoff_datetime = cutoffDatetime || null;
        body.cutoff_override_reason = cutoffOverrideReason.trim() || null;
      } else {
        body.run_sheet_day_id = runSheetDayId || null;
        body.proposed_value =
          field === "outcomes"
            ? proposedValue
            : field === "logistics"
              ? proposedValue
              : field === "date"
                ? proposedValue
                : proposedValue;
      }
      const res = await fetch("/api/run-sheet/proposals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to submit proposal");
        setLoading(false);
        return;
      }
      onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const currentDisplay =
    field === "outcomes"
      ? currentOutcomes ?? "—"
      : field === "logistics"
        ? currentLogistics ?? "—"
        : field === "cutoff"
          ? currentCutoff ?? "—"
          : field === "date"
            ? currentDate ?? "—"
            : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-lg font-semibold">Propose a change</h2>
        </div>
        <div className="space-y-4 px-4 py-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Field
            </label>
            <select
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              value={field}
              onChange={(e) => setField(e.target.value as ProposalField)}
            >
              {FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          {(field === "outcomes" ||
            field === "logistics" ||
            field === "date" ||
            field === "sequencing") && (
            <>
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Day (optional for sheet-level)
                </label>
                <select
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                  value={runSheetDayId ?? ""}
                  onChange={(e) =>
                    setRunSheetDayId(e.target.value || null)
                  }
                >
                  <option value="">—</option>
                  {days.map((d) => (
                    <option key={d.id} value={d.id}>
                      Day {d.day_number} {d.calendar_date ?? ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Current
                </label>
                <pre className="mt-1 rounded border border-zinc-200 bg-zinc-50 p-2 text-sm text-zinc-600">
                  {currentDisplay}
                </pre>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Proposed
                </label>
                <textarea
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                  rows={4}
                  value={proposedValue}
                  onChange={(e) => setProposedValue(e.target.value)}
                  placeholder="Enter proposed value..."
                />
              </div>
            </>
          )}
          {field === "cutoff" && (
            <>
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Day
                </label>
                <select
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                  value={runSheetDayId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    setRunSheetDayId(id);
                    const day = days.find((d) => d.id === id);
                    if (day?.calendar_date) setCutoffDatetime("");
                  }}
                >
                  <option value="">Select day</option>
                  {days.map((d) => (
                    <option key={d.id} value={d.id}>
                      Day {d.day_number} {d.calendar_date ?? ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Category
                </label>
                <select
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                  value={cutoffCategory}
                  onChange={(e) =>
                    setCutoffCategory(e.target.value as CutoffCategory)
                  }
                >
                  {CUTOFF_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
                  value={
                    cutoffDatetime
                      ? new Date(cutoffDatetime)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(e) =>
                    setCutoffDatetime(
                      e.target.value ? new Date(e.target.value).toISOString() : ""
                    )
                  }
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={applyDefaultCutoff}
                >
                  Apply default rule
                </Button>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Override reason (if different from default)
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                  value={cutoffOverrideReason}
                  onChange={(e) => setCutoffOverrideReason(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Reason <span className="text-red-600">*</span>
            </label>
            <textarea
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this change needed?"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? "Submitting…" : "Submit proposal"}
          </Button>
        </div>
      </div>
    </div>
  );
}
