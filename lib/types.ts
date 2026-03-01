// Database enum and row types (mirror Supabase schema)

export type RunSheetStatus =
  | "draft"
  | "in_review"
  | "approved_pending_lock"
  | "locked";

export type ProposalField =
  | "outcomes"
  | "logistics"
  | "cutoff"
  | "date"
  | "sequencing";

export type ProposalStatus = "pending" | "accepted" | "rejected";

export type CutoffCategory =
  | "concrete"
  | "pump"
  | "timber_nonstandard"
  | "pavers"
  | "other";

export type DailyExecutionStatus = "complete" | "partial" | "missed";

export type DailyExecutionReason = "weather" | "variation" | "other";

export type LinkRole = "owner" | "supervisor" | "crew";

export interface TokenPayload {
  project_id: string;
  role: LinkRole;
  expires_at: string; // ISO
  label?: string;
  /** When set, must match projects.token_version for auth to succeed (revocation). */
  token_version?: number;
}

export interface Project {
  id: string;
  organisation_id: string | null;
  name: string;
  site_address: string | null;
  start_date: string | null;
  supervisor_name: string | null;
  status: string | null;
  created_at: string;
  token_version?: number;
}

export interface RunSheet {
  id: string;
  project_id: string;
  version: number;
  status: RunSheetStatus;
  created_by: string | null;
  locked_at: string | null;
  locked_by: string | null;
  supervisor_confirmed_at: string | null;
  supervisor_confirmed_by_label: string | null;
  created_at: string;
}

export interface RunSheetDay {
  id: string;
  run_sheet_id: string;
  day_number: number;
  calendar_date: string | null;
  outcomes_text: string | null;
  logistics_text: string | null;
  cutoff_datetime: string | null;
  cutoff_category: CutoffCategory | null;
  cutoff_rule_applied: boolean | null;
  cutoff_override_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunSheetProposal {
  id: string;
  run_sheet_id: string;
  run_sheet_day_id: string | null;
  proposed_by_label: string;
  field: ProposalField;
  current_value: string | null;
  proposed_value: string | null;
  reason: string;
  status: ProposalStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

export interface DailyExecution {
  id: string;
  project_id: string;
  run_sheet_day_id: string;
  status: DailyExecutionStatus;
  reason: DailyExecutionReason | null;
  explanation: string | null;
  recovery_plan: string | null;
  submitted_by_label: string;
  submitted_at: string;
}
