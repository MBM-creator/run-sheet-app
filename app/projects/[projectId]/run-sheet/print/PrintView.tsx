"use client";

import { Button } from "@/components/ui/Button";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  approved_pending_lock: "Approved (pending lock)",
  locked: "Locked",
};

interface PrintViewProps {
  projectName: string;
  siteAddress: string | null;
  runSheet: { id: string; version: number; status: string } | null;
  days: {
    day_number: number;
    calendar_date: string | null;
    outcomes_text: string | null;
    logistics_text: string | null;
  }[];
}

export function PrintView({
  projectName,
  siteAddress,
  runSheet,
  days,
}: PrintViewProps) {
  return (
    <div className="min-h-screen bg-white p-8 print:p-4">
      <div className="mb-4 print:hidden">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.print()}
        >
          Print / Export PDF
        </Button>
      </div>
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 border-b border-zinc-300 pb-4">
          <h1 className="text-2xl font-bold text-zinc-900">{projectName}</h1>
          {siteAddress && (
            <p className="mt-1 text-zinc-600">{siteAddress}</p>
          )}
          {runSheet && (
            <p className="mt-2 text-sm text-zinc-500">
              {STATUS_LABEL[runSheet.status] ?? runSheet.status} · v{runSheet.version}
            </p>
          )}
        </header>

        {runSheet && days.length > 0 ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-zinc-400">
                <th className="py-2 text-left font-semibold">Day</th>
                <th className="py-2 text-left font-semibold">Date</th>
                <th className="py-2 text-left font-semibold">Outcomes</th>
                <th className="py-2 text-left font-semibold">Logistics</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day_number} className="border-b border-zinc-200">
                  <td className="py-3 align-top font-medium">{d.day_number}</td>
                  <td className="py-3 align-top text-zinc-600">
                    {d.calendar_date ?? "—"}
                  </td>
                  <td className="py-3 align-top whitespace-pre-wrap">
                    {d.outcomes_text ?? "—"}
                  </td>
                  <td className="py-3 align-top whitespace-pre-wrap">
                    {d.logistics_text ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-zinc-500">No run sheet to print.</p>
        )}

        <footer className="mt-12 text-xs text-zinc-400 print:mt-8">
          Run Sheet · Printed {new Date().toLocaleDateString()}
        </footer>
      </div>
    </div>
  );
}
