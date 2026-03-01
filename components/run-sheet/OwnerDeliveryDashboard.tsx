"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";

interface EscalationItem {
  id: string;
  project_id: string;
  escalation_type: string;
  level: number;
  reason: string;
  resolved: boolean;
  resolved_at: string | null;
}

interface OwnerDeliveryDashboardProps {
  projectId: string;
  projectName: string;
  token: string;
}

function getWeekStart(d: Date): Date {
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setUTCDate(diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

export function OwnerDeliveryDashboard({
  projectId,
  projectName,
  token,
}: OwnerDeliveryDashboardProps) {
  const [openEscalations, setOpenEscalations] = useState<EscalationItem[]>([]);
  const [resolvedThisWeek, setResolvedThisWeek] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const weekStart = getWeekStart(new Date()).toISOString();
    Promise.all([
      fetch(
        `/api/run-sheet/escalations?project_id=${encodeURIComponent(projectId)}&open_only=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).then((r) => r.json()),
      fetch(
        `/api/run-sheet/escalations?project_id=${encodeURIComponent(projectId)}&open_only=false`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).then((r) => r.json()),
    ])
      .then(([openData, allData]) => {
        if (cancelled) return;
        const open = Array.isArray(openData) ? openData : [];
        setOpenEscalations(open);
        const all = Array.isArray(allData) ? allData : [];
        const resolved = all.filter(
          (e: EscalationItem) => e.resolved && e.resolved_at && e.resolved_at >= weekStart
        );
        setResolvedThisWeek(resolved.length);
      })
      .catch(() => {
        if (!cancelled) setOpenEscalations([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, token]);

  const level2Plus = openEscalations.filter((e) => e.level >= 2);
  const totalLevel2Plus = level2Plus.length;
  const projectsWithRisk = totalLevel2Plus > 0 ? 1 : 0;
  const todayStart = new Date().toISOString().slice(0, 10);
  const overdueCutoffsToday = level2Plus.filter(
    (e) => e.escalation_type === "cutoff_missed" && e.level >= 2
  ).length;

  const tokenQ = token ? `?token=${encodeURIComponent(token)}` : "";

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="py-6">
          <p className="text-sm text-zinc-500">Loading delivery risk…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mb-6 space-y-4">
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-zinc-900">Delivery Risk Overview</h2>
          <p className="mt-1 text-sm text-zinc-600">{projectName}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="text-sm text-zinc-700">
            <li>Projects at risk: {projectsWithRisk}</li>
            <li>Active escalations (level 2+): {totalLevel2Plus}</li>
            <li>Overdue cut-offs (level 2+): {overdueCutoffsToday}</li>
          </ul>
          <Link href={`/projects/${projectId}/run-sheet${tokenQ}`}>
            <Button variant="primary">Open Escalation Inbox</Button>
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-zinc-900">Resolved This Week</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-600">
            {resolvedThisWeek} escalation{resolvedThisWeek !== 1 ? "s" : ""} resolved since Monday.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
