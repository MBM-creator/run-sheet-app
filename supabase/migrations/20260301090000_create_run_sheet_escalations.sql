-- Escalations: auditable risk states created by scanner; owners resolve/assign.
CREATE TABLE run_sheet_escalations (
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

CREATE INDEX idx_run_sheet_escalations_project_id ON run_sheet_escalations(project_id);
CREATE INDEX idx_run_sheet_escalations_run_sheet_id ON run_sheet_escalations(run_sheet_id);
CREATE INDEX idx_run_sheet_escalations_run_sheet_day_id ON run_sheet_escalations(run_sheet_day_id);
CREATE INDEX idx_run_sheet_escalations_resolved ON run_sheet_escalations(resolved);
CREATE INDEX idx_run_sheet_escalations_project_resolved ON run_sheet_escalations(project_id, resolved);

COMMENT ON TABLE run_sheet_escalations IS 'Risk escalations created by scanner; owner resolve/assign.';
COMMENT ON COLUMN run_sheet_escalations.level IS '1=warning, 2=action_required, 3=intervention_required';

-- Optional: convenience column on run_sheet_days (scanner updates it).
ALTER TABLE run_sheet_days
  ADD COLUMN IF NOT EXISTS escalation_state TEXT NULL;

COMMENT ON COLUMN run_sheet_days.escalation_state IS 'none|warning|action|intervention; set by scanner.';
