ALTER TABLE run_sheet_days
  ADD COLUMN IF NOT EXISTS planned_labour_hours NUMERIC NULL;

COMMENT ON COLUMN run_sheet_days.planned_labour_hours IS 'Planned labour hours for this day (from CSV import scheduling). Stored with 1 decimal; used for analytics and planned vs actual.';
