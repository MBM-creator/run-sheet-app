-- Token revocation: increment token_version to invalidate all existing links for a project.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 1;

COMMENT ON COLUMN projects.token_version IS 'Incremented by revoke-tokens; tokens must match this version.';
