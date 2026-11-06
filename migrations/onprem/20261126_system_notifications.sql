CREATE TABLE IF NOT EXISTS system_notifications (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  message text NOT NULL,
  link text,
  related_type text,
  related_id text,
  dedupe_key text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS system_notifications_user_dedupe_uq
  ON system_notifications (user_id, dedupe_key);
CREATE INDEX IF NOT EXISTS system_notifications_user_created_idx
  ON system_notifications (user_id, created_at);
