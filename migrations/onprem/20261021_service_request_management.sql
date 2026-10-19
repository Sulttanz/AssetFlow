ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS project_id varchar REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS assignment_group text;
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS assignee_id varchar REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS fulfillment_stage text;
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
CREATE INDEX IF NOT EXISTS service_requests_project_idx ON service_requests(project_id);

CREATE TABLE IF NOT EXISTS service_request_activities (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id varchar NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  actor_id varchar REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_request_activities_request_created_idx
  ON service_request_activities(service_request_id, created_at);
