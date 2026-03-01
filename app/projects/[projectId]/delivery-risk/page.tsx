import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateRunSheetToken } from "@/lib/auth/validate-token-server";
import { RunSheetProvider } from "@/contexts/RunSheetContext";
import { OwnerDeliveryDashboard } from "@/components/run-sheet/OwnerDeliveryDashboard";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface PageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function DeliveryRiskPage({ params, searchParams }: PageProps) {
  const { projectId } = await params;
  const { token: tokenParam } = await searchParams;
  const payload = await validateRunSheetToken(tokenParam ?? null, projectId);

  if (payload.role !== "owner") {
    redirect(`/projects/${projectId}/run-sheet?token=${encodeURIComponent(tokenParam ?? "")}`);
  }

  const supabase = createServerSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .single();
  if (!project) redirect("/invalid-link");

  const token = tokenParam!;
  const tokenQ = `?token=${encodeURIComponent(token)}`;

  return (
    <RunSheetProvider
      value={{
        project_id: payload.project_id,
        role: payload.role,
        expires_at: payload.expires_at,
        label: payload.label,
        token,
      }}
    >
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900">Delivery Risk Dashboard</h1>
          <Link href={`/projects/${projectId}/run-sheet${tokenQ}`}>
            <Button variant="secondary">Back to run sheet</Button>
          </Link>
        </div>
        <OwnerDeliveryDashboard
          projectId={projectId}
          projectName={project.name}
          token={token}
        />
      </div>
    </RunSheetProvider>
  );
}
