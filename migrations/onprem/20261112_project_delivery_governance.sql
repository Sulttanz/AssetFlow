ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS actual_spend numeric(12, 2) NOT NULL DEFAULT 0.00
    CONSTRAINT projects_actual_spend_nonnegative_check CHECK (actual_spend >= 0);

CREATE TABLE IF NOT EXISTS project_tasks (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  description text,
  status varchar(50) NOT NULL DEFAULT 'Backlog'
    CONSTRAINT project_tasks_status_check CHECK (status IN ('Backlog', 'To Do', 'In Progress', 'In Review', 'Done')),
  priority varchar(20) NOT NULL DEFAULT 'Medium'
    CONSTRAINT project_tasks_priority_check CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  assignee_id varchar REFERENCES users(id) ON DELETE SET NULL,
  estimated_hours numeric(6, 2) NOT NULL DEFAULT 0.00
    CONSTRAINT project_tasks_estimated_hours_check CHECK (estimated_hours >= 0),
  logged_hours numeric(6, 2) NOT NULL DEFAULT 0.00
    CONSTRAINT project_tasks_logged_hours_check CHECK (logged_hours >= 0),
  due_date timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS project_tasks_project_status_order_idx
  ON project_tasks(project_id, status, sort_order);
CREATE INDEX IF NOT EXISTS project_tasks_assignee_project_idx
  ON project_tasks(assignee_id, project_id);

CREATE TABLE IF NOT EXISTS project_risks (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  description text,
  category varchar(50) NOT NULL DEFAULT 'Technical'
    CONSTRAINT project_risks_category_check CHECK (category IN ('Technical', 'Financial', 'Operational', 'Schedule', 'Compliance')),
  probability integer NOT NULL CONSTRAINT project_risks_probability_check CHECK (probability BETWEEN 1 AND 5),
  impact integer NOT NULL CONSTRAINT project_risks_impact_check CHECK (impact BETWEEN 1 AND 5),
  risk_score integer GENERATED ALWAYS AS (probability * impact) STORED,
  mitigation_strategy text,
  status varchar(50) NOT NULL DEFAULT 'Identified'
    CONSTRAINT project_risks_status_check CHECK (status IN ('Identified', 'Mitigated', 'Accepted', 'Closed')),
  owner_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS project_risks_project_status_idx
  ON project_risks(project_id, status);
CREATE INDEX IF NOT EXISTS project_risks_owner_project_idx
  ON project_risks(owner_id, project_id);

CREATE TABLE IF NOT EXISTS project_changes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rfc_number varchar(50) NOT NULL,
  title varchar(255) NOT NULL,
  reason text,
  impact_analysis text,
  status varchar(50) NOT NULL DEFAULT 'Draft'
    CONSTRAINT project_changes_status_check CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Rejected', 'Implemented')),
  requested_by varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS project_changes_rfc_number_uq
  ON project_changes(rfc_number);
CREATE INDEX IF NOT EXISTS project_changes_project_status_idx
  ON project_changes(project_id, status, created_at);

CREATE TABLE IF NOT EXISTS project_documents (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  file_url text NOT NULL,
  category varchar(50) NOT NULL DEFAULT 'Charter'
    CONSTRAINT project_documents_category_check CHECK (category IN ('Charter', 'SOW', 'Architecture', 'Handover', 'Other')),
  uploaded_by varchar REFERENCES users(id) ON DELETE SET NULL,
  file_path text NOT NULL,
  original_name varchar(255) NOT NULL,
  mime_type varchar(255) NOT NULL,
  file_size integer NOT NULL CONSTRAINT project_documents_file_size_check CHECK (file_size > 0),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS project_documents_project_created_idx
  ON project_documents(project_id, created_at);
