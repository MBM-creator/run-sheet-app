-- Hours agreed (from run sheet) and hours used (synced from another app)
ALTER TABLE run_sheets
  ADD COLUMN IF NOT EXISTS hours_agreed NUMERIC,
  ADD COLUMN IF NOT EXISTS hours_used NUMERIC;

COMMENT ON COLUMN run_sheets.hours_agreed IS 'Planned hours for this run sheet week (set from run sheet).';
COMMENT ON COLUMN run_sheets.hours_used IS 'Actual hours used; can be updated by another app via API.';
