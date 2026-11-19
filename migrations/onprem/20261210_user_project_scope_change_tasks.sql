-- Project memberships scope end-user ticket and change-request access.
-- Global catalog items remain unscoped; optional project catalog items are
-- visible only to members of their project.
ALTER TABLE service_catalog_items
  ADD COLUMN IF NOT EXISTS project_id varchar REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS service_catalog_items_project_status_idx
  ON service_catalog_items(project_id, status);

-- Approved project change requests create exactly one linked project task.
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS change_request_id varchar REFERENCES changes(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS project_tasks_change_request_uq
  ON project_tasks(change_request_id)
  WHERE change_request_id IS NOT NULL;
