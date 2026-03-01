"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRunSheetAuth } from "@/contexts/RunSheetContext";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface ProposalRow {
  id: string;
  run_sheet_id: string;
  run_sheet_day_id: string | null;
  proposed_by_label: string;
  field: string;
  current_value: string | null;
  proposed_value: string | null;
  reason: string;
  status: string;
}

interface ProposalsViewProps {
  projectId: string;
  projectName: string;
  runSheet: { id: string; version: number; status: string } | null;
  proposals: ProposalRow[];
  token: string;
}

export function ProposalsView({
  projectId,
  projectName,
  runSheet,
  proposals: initialProposals,
  token,
}: ProposalsViewProps) {
  const { role } = useRunSheetAuth();
  const [proposals, setProposals] = useState(initialProposals);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialProposals.find((p) => p.status === "pending")?.id ?? null
  );
  const [loading, setLoading] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");
  const [editedValue, setEditedValue] = useState("");

  const pending = proposals.filter((p) => p.status === "pending");
  const selected = proposals.find((p) => p.id === selectedId);

  const refetch = useCallback(async () => {
    const res = await fetch(
      `/api/run-sheet/proposals?run_sheet_id=${runSheet?.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      const data = await res.json();
      setProposals(data);
      const nextPending = data.find((p: ProposalRow) => p.status === "pending");
      setSelectedId(nextPending?.id ?? null);
    }
  }, [runSheet?.id, token]);

  async function decide(proposalId: string, decision: "accept" | "reject" | "edit_accept") {
    setLoading(true);
    try {
      const body: Record<string, string> = {
        decision,
        decision_note: decisionNote,
      };
      if (decision === "edit_accept" && editedValue) body.edited_value = editedValue;
      const res = await fetch(`/api/run-sheet/proposals/${proposalId}/decision`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) await refetch();
      else alert((await res.json()).error ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  const basePath = `/projects/${projectId}/run-sheet`;
  const tokenQ = `?token=${encodeURIComponent(token)}`;

  if (!runSheet) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-zinc-600">
          No run sheet in review. Open the run sheet to send it to review first.
        </p>
        <Link href={`${basePath}${tokenQ}`} className="mt-4 inline-block">
          <Button variant="secondary">Back to run sheet</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Proposals — {projectName}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            v{runSheet.version} · {runSheet.status}
          </p>
        </div>
        <Link href={`${basePath}${tokenQ}`}>
          <Button variant="secondary">Back to run sheet</Button>
        </Link>
      </div>

      {pending.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-zinc-600">No pending proposals.</p>
            <p className="mt-2 text-sm text-zinc-500">
              When the run sheet is approved and the supervisor has confirmed, you
              can lock it.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Queue ({pending.length})</h2>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-zinc-200">
                {pending.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-zinc-50 ${
                        selectedId === p.id ? "bg-zinc-100" : ""
                      }`}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <span className="font-medium">{p.field}</span>
                      {p.run_sheet_day_id && (
                        <span className="ml-1 text-zinc-500">· Day</span>
                      )}
                      <span className="ml-1 text-zinc-500">by {p.proposed_by_label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            {selected && (
              <>
                <CardHeader className="flex flex-row items-center justify-between">
                  <h2 className="font-semibold">
                    {selected.field} — {selected.proposed_by_label}
                  </h2>
                  <Badge variant={selected.status === "pending" ? "warning" : "default"}>
                    {selected.status}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-500">Reason</p>
                    <p className="mt-1 text-zinc-800">{selected.reason}</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-500">Current</p>
                      <pre className="mt-1 max-h-40 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-sm whitespace-pre-wrap">
                        {formatValue(selected.current_value)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-500">Proposed</p>
                      <pre className="mt-1 max-h-40 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-sm whitespace-pre-wrap">
                        {formatValue(selected.proposed_value)}
                      </pre>
                    </div>
                  </div>
                  {selected.status === "pending" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700">
                          Decision note (optional)
                        </label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                          value={decisionNote}
                          onChange={(e) => setDecisionNote(e.target.value)}
                        />
                      </div>
                      {(selected.field === "outcomes" ||
                        selected.field === "logistics") && (
                        <div>
                          <label className="block text-sm font-medium text-zinc-700">
                            Or accept with edit
                          </label>
                          <textarea
                            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                            rows={3}
                            value={editedValue}
                            onChange={(e) => setEditedValue(e.target.value)}
                            placeholder="Leave empty to accept as-is"
                          />
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="primary"
                          onClick={() => decide(selected.id, "accept")}
                          disabled={loading}
                        >
                          Accept
                        </Button>
                        {editedValue && (
                          <Button
                            variant="secondary"
                            onClick={() =>
                              decide(selected.id, "edit_accept")
                            }
                            disabled={loading}
                          >
                            Accept with edit
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          onClick={() => decide(selected.id, "reject")}
                          disabled={loading}
                        >
                          Reject
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </>
            )}
            {!selected && pending.length > 0 && (
              <CardContent className="py-8 text-center text-zinc-500">
                Select a proposal from the queue.
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function formatValue(v: string | null): string {
  if (v == null) return "—";
  try {
    const parsed = JSON.parse(v);
    if (typeof parsed === "object" && parsed !== null) {
      return JSON.stringify(parsed, null, 2);
    }
  } catch {
    // not JSON
  }
  return v;
}
