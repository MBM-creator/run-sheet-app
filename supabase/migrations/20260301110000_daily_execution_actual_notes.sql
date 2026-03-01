-- Optional "what we actually did" for EOD comparison with planned outcomes
ALTER TABLE daily_execution
  ADD COLUMN IF NOT EXISTS actual_notes TEXT;

COMMENT ON COLUMN daily_execution.actual_notes IS 'Free text: what was actually done (to compare with planned outcomes).';
