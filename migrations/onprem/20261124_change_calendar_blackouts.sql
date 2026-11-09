CREATE TABLE IF NOT EXISTS change_blackouts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  reason text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT change_blackouts_date_range_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS change_blackouts_date_range_idx
  ON change_blackouts (start_date, end_date);
