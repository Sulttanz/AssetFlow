ALTER TABLE changes
  ADD COLUMN IF NOT EXISTS project_id varchar REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS changes_project_idx ON changes(project_id);

ALTER TABLE ticket_attachments
  ADD COLUMN IF NOT EXISTS incident_id varchar REFERENCES incidents(id) ON DELETE CASCADE;
ALTER TABLE ticket_attachments
  ADD COLUMN IF NOT EXISTS service_request_id varchar REFERENCES service_requests(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS ticket_attachments_incident_idx ON ticket_attachments(incident_id);
CREATE INDEX IF NOT EXISTS ticket_attachments_service_request_idx ON ticket_attachments(service_request_id);
