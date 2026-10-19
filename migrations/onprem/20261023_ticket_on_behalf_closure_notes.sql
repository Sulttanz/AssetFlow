ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS resolution_notes text;

ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS creator_id varchar REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closure_note text;

CREATE INDEX IF NOT EXISTS service_requests_creator_id_idx
  ON service_requests(creator_id);
