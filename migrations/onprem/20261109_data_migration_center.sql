ALTER TABLE network_devices
  ADD COLUMN IF NOT EXISTS firmware_version text;

CREATE TABLE IF NOT EXISTS data_migration_batches (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL,
  file_name text NOT NULL,
  status text NOT NULL DEFAULT 'preview'
    CHECK (status IN ('preview', 'imported', 'failed', 'expired')),
  total_rows integer NOT NULL CHECK (total_rows >= 0),
  valid_rows integer NOT NULL CHECK (valid_rows >= 0),
  invalid_rows integer NOT NULL CHECK (invalid_rows >= 0),
  imported_rows integer NOT NULL DEFAULT 0 CHECK (imported_rows >= 0),
  failed_rows integer NOT NULL DEFAULT 0 CHECK (failed_rows >= 0),
  preview_data jsonb,
  created_by_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL,
  completed_at timestamp
);
CREATE INDEX IF NOT EXISTS data_migration_batches_actor_date_idx
  ON data_migration_batches (created_by_id, created_at);
CREATE INDEX IF NOT EXISTS data_migration_batches_expiry_idx
  ON data_migration_batches (status, expires_at);
