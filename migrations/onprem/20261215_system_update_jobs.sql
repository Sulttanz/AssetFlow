CREATE TABLE IF NOT EXISTS system_update_jobs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  current_version text NOT NULL,
  target_version text,
  runtime_environment text NOT NULL CHECK (runtime_environment IN ('replit', 'self_hosted')),
  status text NOT NULL CHECK (status IN ('idle', 'running', 'restarting', 'republish_required', 'failed')),
  message text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS system_update_jobs_started_idx ON system_update_jobs(started_at);
