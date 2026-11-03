ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS title varchar(255) NOT NULL DEFAULT '';
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS status varchar(50) NOT NULL DEFAULT 'Planning'
    CONSTRAINT projects_status_check CHECK (status IN ('Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'));
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS health_status varchar(50) NOT NULL DEFAULT 'On Track'
    CONSTRAINT projects_health_status_check CHECK (health_status IN ('On Track', 'At Risk', 'Delayed'));
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS start_date timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS target_end_date timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    CONSTRAINT projects_target_end_after_start_check CHECK (target_end_date >= start_date);
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS actual_end_date timestamptz;
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS budget numeric(12, 2) NOT NULL DEFAULT 0.00
    CONSTRAINT projects_budget_nonnegative_check CHECK (budget >= 0);
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS created_by varchar REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);
CREATE INDEX IF NOT EXISTS projects_health_status_idx ON projects(health_status);
CREATE INDEX IF NOT EXISTS projects_created_by_idx ON projects(created_by);

CREATE TABLE IF NOT EXISTS project_managers (
  project_id varchar NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  CONSTRAINT project_managers_pk PRIMARY KEY (project_id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS project_managers_one_primary_idx
  ON project_managers(project_id) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS project_managers_user_project_idx
  ON project_managers(user_id, project_id);

CREATE TABLE IF NOT EXISTS project_team_members (
  project_id varchar NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_title varchar(100) NOT NULL DEFAULT 'Team Member',
  assigned_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_team_members_pk PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS project_team_members_user_project_idx
  ON project_team_members(user_id, project_id);

CREATE TABLE IF NOT EXISTS project_milestones (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  description text,
  due_date timestamptz NOT NULL,
  completion_date timestamptz,
  status varchar(50) NOT NULL DEFAULT 'Pending'
    CONSTRAINT project_milestones_status_check CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Delayed')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS project_milestones_project_due_idx
  ON project_milestones(project_id, due_date);

CREATE TABLE IF NOT EXISTS project_assets (
  project_id varchar NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id varchar NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  association_type varchar(50) NOT NULL DEFAULT 'Deployed'
    CONSTRAINT project_assets_association_type_check CHECK (association_type IN ('Deployed', 'Decommissioned', 'Upgraded')),
  CONSTRAINT project_assets_pk PRIMARY KEY (project_id, asset_id)
);
CREATE INDEX IF NOT EXISTS project_assets_asset_project_idx
  ON project_assets(asset_id, project_id);

CREATE OR REPLACE FUNCTION project_management_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;
DO $project_management$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'project_management_updated_at'
      AND tgrelid = 'projects'::regclass
  ) THEN
    CREATE TRIGGER project_management_updated_at
      BEFORE UPDATE ON projects
      FOR EACH ROW
      EXECUTE FUNCTION project_management_touch_updated_at();
  END IF;
END;
$project_management$;

INSERT INTO module_settings (module_key, enabled)
VALUES ('project_management', true)
ON CONFLICT (module_key) DO UPDATE SET enabled = true
WHERE module_settings.updated_by IS NULL;
