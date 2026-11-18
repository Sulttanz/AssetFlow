ALTER TABLE users
  ADD COLUMN IF NOT EXISTS employee_id varchar REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_employee_id_idx ON users(employee_id);

CREATE TABLE IF NOT EXISTS incident_catalog_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL,
  icon text,
  project_id varchar REFERENCES projects(id) ON DELETE RESTRICT,
  default_impact text NOT NULL DEFAULT 'medium'
    CHECK (default_impact IN ('low', 'medium', 'high')),
  default_urgency text NOT NULL DEFAULT 'medium'
    CHECK (default_urgency IN ('low', 'medium', 'high')),
  default_priority text NOT NULL DEFAULT 'P3'
    CHECK (default_priority IN ('P1', 'P2', 'P3', 'P4')),
  default_assignment_group text,
  is_active boolean NOT NULL DEFAULT true,
  created_by varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incident_catalog_items_project_active_idx
  ON incident_catalog_items(project_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS incident_catalog_items_global_name_ci_uq
  ON incident_catalog_items(lower(btrim(name))) WHERE project_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS incident_catalog_items_project_name_ci_uq
  ON incident_catalog_items(project_id, lower(btrim(name))) WHERE project_id IS NOT NULL;

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS incident_catalog_item_id varchar
    REFERENCES incident_catalog_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS incidents_catalog_item_idx
  ON incidents(incident_catalog_item_id);
