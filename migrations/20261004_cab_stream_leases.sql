-- Shared, short-lived admission leases enforce CAB stream limits across replicas.
CREATE TABLE IF NOT EXISTS cab_stream_leases (
  id varchar(36) PRIMARY KEY,
  user_id varchar NOT NULL,
  session_id text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS cab_stream_leases_user_expiry_idx
  ON cab_stream_leases (user_id, expires_at);

CREATE INDEX IF NOT EXISTS cab_stream_leases_expiry_idx
  ON cab_stream_leases (expires_at);