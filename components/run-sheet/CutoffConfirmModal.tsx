"use client";

import { useState } from "react";
import { useRunSheetAuth } from "@/contexts/RunSheetContext";
import { Button } from "@/components/ui/Button";

interface CutoffConfirmModalProps {
  runSheetDayId: string;
  projectId: string;
  dayLabel: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CutoffConfirmModal({
  runSheetDayId,
  projectId,
  dayLabel,
  onClose,
  onSuccess,
}: CutoffConfirmModalProps) {
  const { token } = useRunSheetAuth();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/run-sheet/cutoff/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          project_id: projectId,
          run_sheet_day_id: runSheetDayId,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onSuccess();
        onClose();
      } else if (res.status === 409) {
        setError("Already confirmed.");
      } else {
        setError(data.error ?? "Failed to confirm");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="font-semibold">Mark cut-off confirmed</h2>
          <p className="text-sm text-zinc-500">{dayLabel}</p>
        </div>
        <div className="px-4 py-3">
          <label className="block text-sm font-medium text-zinc-700">
            Note (optional)
          </label>
          <input
            type="text"
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            placeholder="e.g. Ordered with X, Pump booked ref #"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? "Confirming…" : "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}
