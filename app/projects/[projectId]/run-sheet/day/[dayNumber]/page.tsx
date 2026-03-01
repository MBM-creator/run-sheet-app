import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateRunSheetToken } from "@/lib/auth/validate-token-server";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";

interface PageProps {
  params: Promise<{ projectId: string; dayNumber: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function DayPage({ params, searchParams }: PageProps) {
  const { projectId, dayNumber } = await params;
  const { token: tokenParam } = await searchParams;
  await validateRunSheetToken(tokenParam ?? null, projectId);

  const dayNum = parseInt(dayNumber, 10);
  if (Number.isNaN(dayNum) || dayNum < 1) {
    redirect("/invalid-link");
  }

  const supabase = createServerSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .single();
  if (!project) redirect("/invalid-link");

  const { data: runSheets } = await supabase
    .from("run_sheets")
    .select("id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  const runSheetId = runSheets?.[0]?.id;
  if (!runSheetId) redirect("/invalid-link");

  const { data: day } = await supabase
    .from("run_sheet_days")
    .select("id, day_number, calendar_date, outcomes_text, logistics_text, cutoff_datetime, cutoff_category")
    .eq("run_sheet_id", runSheetId)
    .eq("day_number", dayNum)
    .single();

  const { data: upcoming } = await supabase
    .from("run_sheet_days")
    .select("day_number, calendar_date, outcomes_text")
    .eq("run_sheet_id", runSheetId)
    .gt("day_number", dayNum)
    .order("day_number", { ascending: true })
    .limit(3);

  const tokenQ = tokenParam ? `?token=${encodeURIComponent(tokenParam)}` : "";
  const basePath = `/projects/${projectId}/run-sheet`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">
          {project.name} — Day {dayNum}
        </h1>
        <Link href={`${basePath}${tokenQ}`}>
          <Button variant="secondary">Full plan</Button>
        </Link>
      </div>

      {day ? (
        <>
          <Card className="mb-6">
            <CardHeader>
              <p className="text-sm text-zinc-500">
                {day.calendar_date ?? "No date set"}
                {day.cutoff_datetime && (
                  <> · Cut-off: {new Date(day.cutoff_datetime).toLocaleString()}</>
                )}
                {day.cutoff_category && (
                  <> · {day.cutoff_category}</>
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-zinc-500">Outcomes</p>
                <pre className="mt-1 whitespace-pre-wrap rounded bg-zinc-50 p-3 text-sm">
                  {day.outcomes_text ?? "—"}
                </pre>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500">Logistics</p>
                <pre className="mt-1 whitespace-pre-wrap rounded bg-zinc-50 p-3 text-sm">
                  {day.logistics_text ?? "—"}
                </pre>
              </div>
            </CardContent>
          </Card>

          {upcoming && upcoming.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Upcoming</h2>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {upcoming.map((u) => (
                    <li key={u.day_number}>
                      <span className="font-medium">Day {u.day_number}</span>
                      {u.calendar_date && (
                        <span className="text-zinc-500"> · {u.calendar_date}</span>
                      )}
                      {u.outcomes_text && (
                        <p className="mt-1 truncate text-zinc-600">
                          {u.outcomes_text.slice(0, 80)}…
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`${basePath}${tokenQ}`}
                  className="mt-3 inline-block text-sm font-medium text-zinc-700 underline"
                >
                  View full plan
                </Link>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-zinc-500">
            Day {dayNum} not found for this run sheet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
