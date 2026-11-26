-- Existing specifications and other asset values must remain untouched.
-- Fresh installs already include this nullable field in the schema baseline.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS specifications text;
