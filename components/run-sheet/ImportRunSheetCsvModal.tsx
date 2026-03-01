"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { parseAndValidateCsv, type ValidatedTaskRow, type ValidationError } from "@/lib/run-sheet/import-csv";

function getNextMondayISO(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

interface ImportRunSheetCsvModalProps {
  projectId: string;
  projectStartDate: string | null;
  token: string;
  onClose: () => void;
  onSuccess: (redirectUrl: string) => void;
}

export function ImportRunSheetCsvModal({
  projectId,
  projectStartDate,
  token,
  onClose,
  onSuccess,
}: ImportRunSheetCsvModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [startDate, setStartDate] = useState<string>(
    projectStartDate?.trim() || getNextMondayISO()
  );
  const [createNewDraft, setCreateNewDraft] = useState(true);
  const [preview, setPreview] = useState<{ rows: ValidatedTaskRow[]; errors: ValidationError[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [detailsErrors, setDetailsErrors] = useState<ValidationError[]>([]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setSubmitError(null);
    setDetailsErrors([]);
    if (!f) {
      setPreview(null);
      return;
    }
    f.text().then((text) => {
      const result = parseAndValidateCsv(text);
      setPreview({
        rows: result.rows,
        errors: result.errors,
      });
    }).catch(() => {
      setPreview(null);
    });
  }, []);

  async function handleSubmit() {
    if (!file) {
      setSubmitError("Please select a CSV file.");
      return;
    }
    setLoading(true);
    setSubmitError(null);
    setDetailsErrors([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("project_id", projectId);
      formData.append("start_date", startDate);

      const res = await fetch("/api/run-sheet/import-csv", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSubmitError(data.error ?? "Import failed");
        if (Array.isArray(data.details)) setDetailsErrors(data.details);
        return;
      }

      if (data.redirect_url) {
        onSuccess(data.redirect_url);
      } else {
        onSuccess(`/projects/${projectId}/run-sheet`);
      }
    } finally {
      setLoading(false);
    }
  }

  const previewRows = preview?.rows ?? [];
  const previewErrors = preview?.errors ?? [];
  const showPreview = previewRows.length > 0 || previewErrors.length > 0;
  const canSubmit = file && preview?.errors.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-lg font-semibold">Import from Excel (CSV)</h2>
        </div>
        <div className="space-y-4 px-4 py-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              CSV file
            </label>
            <input
              type="file"
              accept=".csv"
              className="mt-1 block w-full text-sm text-zinc-600 file:mr-2 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm"
              onChange={handleFileChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Start date
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="create-new-draft"
              checked={createNewDraft}
              onChange={(e) => setCreateNewDraft(e.target.checked)}
            />
            <label htmlFor="create-new-draft" className="text-sm text-zinc-700">
              Create new draft run sheet version
            </label>
          </div>

          {showPreview && (
            <div>
              <h3 className="text-sm font-medium text-zinc-700">Preview (first 10 rows)</h3>
              {previewErrors.length > 0 && (
                <ul className="mt-1 list-inside list-disc text-sm text-red-600">
                  {previewErrors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}, {e.field}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
              {previewRows.length > 0 && (
                <div className="mt-2 overflow-x-auto rounded border border-zinc-200">
                  <table className="min-w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50">
                        <th className="px-2 py-1 font-medium">task_name</th>
                        <th className="px-2 py-1 font-medium">labour_hours</th>
                        <th className="px-2 py-1 font-medium">crew_size</th>
                        <th className="px-2 py-1 font-medium">sequencing_group</th>
                        <th className="px-2 py-1 font-medium">requires_cutoff</th>
                        <th className="px-2 py-1 font-medium">cutoff_category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-b border-zinc-100">
                          <td className="px-2 py-1">{row.task_name}</td>
                          <td className="px-2 py-1">{row.labour_hours}</td>
                          <td className="px-2 py-1">{row.crew_size}</td>
                          <td className="px-2 py-1">{row.sequencing_group}</td>
                          <td className="px-2 py-1">{row.requires_cutoff ? "yes" : "no"}</td>
                          <td className="px-2 py-1">{row.cutoff_category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {submitError && (
            <p className="text-sm text-red-600">{submitError}</p>
          )}
          {detailsErrors.length > 0 && (
            <ul className="list-inside list-disc text-sm text-red-600">
              {detailsErrors.map((e, i) => (
                <li key={i}>
                  Row {e.row}, {e.field}: {e.message}
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="primary"
              disabled={!canSubmit || loading}
              onClick={handleSubmit}
            >
              {loading ? "Importing…" : "Import & Generate Draft"}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
