-- Run Sheet Standalone App — Schema
-- Enums
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

-- Optional: organisations (nullable org on projects for v1)
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Projects
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

-- Run sheets
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

-- Run sheet days
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

-- Run sheet proposals
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

-- Daily execution (EOD reconciliation)
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

-- Trigger to update updated_at on run_sheet_days
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
