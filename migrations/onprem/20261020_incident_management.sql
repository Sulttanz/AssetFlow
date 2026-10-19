CREATE TABLE IF NOT EXISTS projects (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS creator_id varchar REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS project_id varchar REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS sla_policy_id varchar REFERENCES sla_policies(id) ON DELETE SET NULL;
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS assignment_group text;
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS assignee_id varchar REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;
CREATE INDEX IF NOT EXISTS incidents_project_id_idx ON incidents(project_id);
CREATE INDEX IF NOT EXISTS incidents_creator_id_idx ON incidents(creator_id);

CREATE TABLE IF NOT EXISTS incident_activities (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id varchar NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  actor_id varchar REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incident_activities_incident_created_idx
  ON incident_activities(incident_id, created_at);
