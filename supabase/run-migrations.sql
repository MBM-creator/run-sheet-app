-- Run this entire script in Supabase SQL Editor ONCE before running seed.sql
-- It creates all tables and schema the app needs.

-- ========== 1. Schema (enums + tables) ==========
CREATE TYPE run_sheet_status AS ENUM (
  'draft',
  'in_review',
  'approved_pending_lock',
  'locked'
);

CREATE TYPE proposal_field AS ENUM (
  'outcomes',
  'logistics',
  'cutoff',
  'date',
  'sequencing'
);

CREATE TYPE proposal_status AS ENUM (
  'pending',
  'accepted',
  'rejected'
);

CREATE TYPE cutoff_category AS ENUM (
  'concrete',
  'pump',
  'timber_nonstandard',
  'pavers',
  'other'
);

CREATE TYPE daily_execution_status AS ENUM (
  'complete',
  'partial',
  'missed'
);

CREATE TYPE daily_execution_reason AS ENUM (
  'weather',
  'variation',
  'other'
);

CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  name TEXT NOT NULL,
  site_address TEXT,
  start_date DATE,
  supervisor_name TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE run_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  status run_sheet_status NOT NULL DEFAULT 'draft',
  created_by TEXT,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  supervisor_confirmed_at TIMESTAMPTZ,
  supervisor_confirmed_by_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_run_sheets_project_id ON run_sheets(project_id);
CREATE INDEX idx_run_sheets_project_status ON run_sheets(project_id, status);

CREATE TABLE run_sheet_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_sheet_id UUID NOT NULL REFERENCES run_sheets(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  calendar_date DATE,
  outcomes_text TEXT,
  logistics_text TEXT,
  cutoff_datetime TIMESTAMPTZ,
  cutoff_category cutoff_category,
  cutoff_rule_applied BOOLEAN DEFAULT false,
  cutoff_override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_run_sheet_days_run_sheet_id ON run_sheet_days(run_sheet_id);
CREATE INDEX idx_run_sheet_days_calendar_date ON run_sheet_days(run_sheet_id, calendar_date);

CREATE TABLE run_sheet_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_sheet_id UUID NOT NULL REFERENCES run_sheets(id) ON DELETE CASCADE,
  run_sheet_day_id UUID REFERENCES run_sheet_days(id) ON DELETE CASCADE,
  proposed_by_label TEXT NOT NULL,
  field proposal_field NOT NULL,
  current_value TEXT,
  proposed_value TEXT,
  reason TEXT NOT NULL,
  status proposal_status NOT NULL DEFAULT 'pending',
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_run_sheet_proposals_run_sheet_status ON run_sheet_proposals(run_sheet_id, status);

CREATE TABLE daily_execution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_sheet_day_id UUID NOT NULL REFERENCES run_sheet_days(id) ON DELETE CASCADE,
  status daily_execution_status NOT NULL,
  reason daily_execution_reason,
  explanation TEXT,
  recovery_plan TEXT,
  submitted_by_label TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_execution_project_day ON daily_execution(project_id, run_sheet_day_id);
CREATE INDEX idx_daily_execution_submitted_at ON daily_execution(project_id, submitted_at);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER run_sheet_days_updated_at
  BEFORE UPDATE ON run_sheet_days
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

-- ========== 2. Token version (revocation) ==========
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 1;

-- ========== 3. Cutoff confirm columns ==========
ALTER TABLE run_sheet_days
  ADD COLUMN IF NOT EXISTS cutoff_confirmed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS cutoff_confirmed_by_label TEXT NULL,
  ADD COLUMN IF NOT EXISTS cutoff_confirm_note TEXT NULL;

-- ========== 4. Escalations ==========
CREATE TABLE IF NOT EXISTS run_sheet_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_sheet_id UUID NOT NULL REFERENCES run_sheets(id) ON DELETE CASCADE,
  run_sheet_day_id UUID NULL REFERENCES run_sheet_days(id) ON DELETE SET NULL,
  escalation_type TEXT NOT NULL,
  level SMALLINT NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  metadata JSONB NULL,
  created_by_label TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by_label TEXT NULL,
  resolved_at TIMESTAMPTZ NULL,
  resolution_note TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_run_sheet_escalations_project_id ON run_sheet_escalations(project_id);
CREATE INDEX IF NOT EXISTS idx_run_sheet_escalations_run_sheet_id ON run_sheet_escalations(run_sheet_id);
CREATE INDEX IF NOT EXISTS idx_run_sheet_escalations_run_sheet_day_id ON run_sheet_escalations(run_sheet_day_id);
CREATE INDEX IF NOT EXISTS idx_run_sheet_escalations_resolved ON run_sheet_escalations(resolved);
CREATE INDEX IF NOT EXISTS idx_run_sheet_escalations_project_resolved ON run_sheet_escalations(project_id, resolved);

ALTER TABLE run_sheet_days
  ADD COLUMN IF NOT EXISTS escalation_state TEXT NULL;

-- ========== 5. Weekly logistics reviews ==========
CREATE TABLE IF NOT EXISTS weekly_logistics_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_by_label text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_logistics_reviews_project_week
  ON weekly_logistics_reviews (project_id, week_start_date);
