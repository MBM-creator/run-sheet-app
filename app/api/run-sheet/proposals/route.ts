import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProposalField } from "@/lib/types";
import { validateOutcomes } from "@/lib/validation/outcomes";
import { getDefaultCutoffISO } from "@/lib/cutoff-rules";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["supervisor"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  let body: {
    run_sheet_id: string;
    run_sheet_day_id?: string | null;
    field: ProposalField;
    proposed_value: string;
    reason: string;
    cutoff_category?: string;
    cutoff_datetime?: string | null;
    cutoff_override_reason?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.run_sheet_id || !body.field || body.reason == null) {
    return NextResponse.json(
      { error: "run_sheet_id, field, and reason are required" },
      { status: 400 }
    );
  }
  if (!body.reason.trim()) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data: runSheet, error: rsError } = await supabase
    .from("run_sheets")
    .select("id, project_id, status")
    .eq("id", body.run_sheet_id)
    .single();

  if (rsError || !runSheet) {
    return NextResponse.json({ error: "Run sheet not found" }, { status: 404 });
  }
  if (runSheet.project_id !== payload.project_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (runSheet.status !== "in_review") {
    return NextResponse.json(
      { error: "Proposals only allowed when run sheet is in review" },
      { status: 400 }
    );
  }

  if (body.field === "outcomes") {
    if (!validateOutcomes(body.proposed_value)) {
      return NextResponse.json(
        {
          error:
            "Proposed outcomes must include a measurable anchor (number, unit, or phrase)",
        },
        { status: 400 }
      );
    }
  }

  if (body.field === "cutoff") {
    const dayId = body.run_sheet_day_id;
    if (!dayId) {
      return NextResponse.json(
        { error: "run_sheet_day_id required for cutoff proposals" },
        { status: 400 }
      );
    }
    const { data: day } = await supabase
      .from("run_sheet_days")
      .select("calendar_date, cutoff_category")
      .eq("id", dayId)
      .single();
    const category = (body.cutoff_category ?? day?.cutoff_category) as
      | "concrete"
      | "pump"
      | "timber_nonstandard"
      | "pavers"
      | "other"
      | undefined;
    if (category && category !== "other" && day?.calendar_date) {
      const defaultCutoff = getDefaultCutoffISO(day.calendar_date, category);
      const proposedCutoff = body.cutoff_datetime ?? null;
      if (
        defaultCutoff &&
        proposedCutoff &&
        new Date(proposedCutoff).toISOString().slice(0, 10) !==
          new Date(defaultCutoff).toISOString().slice(0, 10)
      ) {
        if (
          !body.cutoff_override_reason ||
          !body.cutoff_override_reason.trim()
        ) {
          return NextResponse.json(
            {
              error:
                "Cut-off differs from default for this category; cutoff_override_reason is required",
            },
            { status: 400 }
          );
        }
      }
    }
  }

  let currentValue: string | null = null;
  if (body.run_sheet_day_id && ["outcomes", "logistics", "cutoff", "date"].includes(body.field)) {
    const { data: dayRow } = await supabase
      .from("run_sheet_days")
      .select(
        body.field === "outcomes"
          ? "outcomes_text"
          : body.field === "logistics"
            ? "logistics_text"
            : body.field === "cutoff"
              ? "cutoff_datetime, cutoff_category"
              : "calendar_date"
      )
      .eq("id", body.run_sheet_day_id)
      .single();
    if (dayRow) {
      if (body.field === "cutoff") {
        const row = dayRow as { cutoff_datetime?: string; cutoff_category?: string };
        currentValue = JSON.stringify({
          cutoff_datetime: row.cutoff_datetime,
          cutoff_category: row.cutoff_category,
        });
      } else {
        const key =
          body.field === "outcomes"
            ? "outcomes_text"
            : body.field === "logistics"
              ? "logistics_text"
              : "calendar_date";
        const row = dayRow as unknown as Record<string, string | null>;
        currentValue = row[key] ?? null;
      }
    }
  }

  const proposedValue =
    body.field === "cutoff"
      ? JSON.stringify({
          cutoff_datetime: body.cutoff_datetime,
          cutoff_category: body.cutoff_category,
        })
      : body.proposed_value;

  const { data: proposal, error: insertError } = await supabase
    .from("run_sheet_proposals")
    .insert({
      run_sheet_id: body.run_sheet_id,
      run_sheet_day_id: body.run_sheet_day_id ?? null,
      proposed_by_label: payload.label ?? "Supervisor",
      field: body.field,
      current_value: currentValue,
      proposed_value: proposedValue,
      reason: body.reason.trim(),
      status: "pending",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message ?? "Failed to create proposal" },
      { status: 500 }
    );
  }
  return NextResponse.json(proposal);
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["owner"]);
  if ("error" in auth) return auth.error;
  const { payload } = auth;

  const url = new URL(request.url);
  const runSheetId = url.searchParams.get("run_sheet_id");
  if (!runSheetId) {
    return NextResponse.json(
      { error: "run_sheet_id query is required" },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();
  const { data: runSheet } = await supabase
    .from("run_sheets")
    .select("id, project_id")
    .eq("id", runSheetId)
    .single();

  if (!runSheet || runSheet.project_id !== payload.project_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: proposals, error } = await supabase
    .from("run_sheet_proposals")
    .select("*")
    .eq("run_sheet_id", runSheetId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to fetch proposals" },
      { status: 500 }
    );
  }
  return NextResponse.json(proposals ?? []);
}
