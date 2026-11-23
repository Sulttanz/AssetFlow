CREATE TABLE IF NOT EXISTS app_release_history (
  id serial PRIMARY KEY,
  from_version text,
  to_version text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  migration_count integer NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'applied'
);

CREATE INDEX IF NOT EXISTS app_release_history_applied_at_idx
  ON app_release_history (applied_at DESC);
