ALTER TABLE project_documents
  ADD COLUMN IF NOT EXISTS version varchar(50) NOT NULL DEFAULT '1.0';

CREATE UNIQUE INDEX IF NOT EXISTS project_documents_project_name_version_uq
  ON project_documents(project_id, name, version);
