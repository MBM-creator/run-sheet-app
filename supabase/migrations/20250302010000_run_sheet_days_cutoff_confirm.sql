-- Cut-off confirmation (anytime; owner + supervisor can confirm, owner can unconfirm)
ALTER TABLE run_sheet_days
  ADD COLUMN IF NOT EXISTS cutoff_confirmed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS cutoff_confirmed_by_label TEXT NULL,
  ADD COLUMN IF NOT EXISTS cutoff_confirm_note TEXT NULL;

COMMENT ON COLUMN run_sheet_days.cutoff_confirmed_at IS 'When the cut-off was confirmed (anytime; late confirmations allowed).';
COMMENT ON COLUMN run_sheet_days.cutoff_confirmed_by_label IS 'Label of user who confirmed (owner/supervisor).';
COMMENT ON COLUMN run_sheet_days.cutoff_confirm_note IS 'Optional note on confirm; on unconfirm stores reason.';
