"use client";

import { useState } from "react";
import { useRunSheetAuth } from "@/contexts/RunSheetContext";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

interface SupervisorConfirmCardProps {
  runSheetId: string;
  supervisorConfirmedAt: string | null;
}

export function SupervisorConfirmCard({
  runSheetId,
  supervisorConfirmedAt,
}: SupervisorConfirmCardProps) {
  const { role, token } = useRunSheetAuth();
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  const isSupervisor = role === "supervisor";
  const alreadyConfirmed = !!supervisorConfirmedAt;

  async function confirm() {
    if (!checked) return;
    setLoading(true);
    try {
      const res = await fetch("/api/run-sheet/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ run_sheet_id: runSheetId }),
      });
      if (res.ok) window.location.reload();
      else alert((await res.json()).error ?? "Failed to confirm");
    } finally {
      setLoading(false);
    }
  }

  if (!isSupervisor || alreadyConfirmed) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="py-4">
        <p className="font-medium text-zinc-900">
          Confirm run sheet before lock
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          The owner has approved this run sheet. Please confirm that you have
          reviewed it and agree to lock it. Once locked, changes will require a
          new version.
        </p>
        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="rounded border-zinc-300"
          />
          <span className="text-sm">I confirm I have reviewed and agree</span>
        </label>
        <div className="mt-3">
          <Button
            onClick={confirm}
            disabled={!checked || loading}
          >
            {loading ? "Confirming…" : "I confirm"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
