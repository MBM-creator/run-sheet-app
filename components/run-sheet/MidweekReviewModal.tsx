"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface MidweekReviewModalProps {
  projectName: string;
  count: number;
  escalationId: string;
  token: string;
  onStartReview: () => void;
  onSnooze?: () => void;
}

export function MidweekReviewModal({
  projectName,
  count,
  escalationId,
  token,
  onStartReview,
  onSnooze,
}: MidweekReviewModalProps) {
  const [snoozing, setSnoozing] = useState(false);

  const handleSnooze = async () => {
    if (!onSnooze) return;
    setSnoozing(true);
    try {
      const res = await fetch(`/api/run-sheet/escalations/${escalationId}/snooze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ duration_hours: 2 }),
      });
      if (res.ok) {
        onSnooze();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Failed to snooze");
      }
    } finally {
      setSnoozing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-lg font-semibold">Mid-week review required</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {projectName} — outstanding items: {count}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 px-4 py-3">
          <Button variant="primary" onClick={onStartReview}>
            Start review now
          </Button>
          {onSnooze && (
            <Button
              variant="secondary"
              onClick={handleSnooze}
              disabled={snoozing}
            >
              {snoozing ? "Snoozing…" : "Snooze 2 hours"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
