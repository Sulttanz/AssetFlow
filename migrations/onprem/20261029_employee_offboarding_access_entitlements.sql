ALTER TABLE employees ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS offboarded_date date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS offboarded_reason text;

CREATE TABLE IF NOT EXISTS employee_access_rights (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id varchar NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  application_name text NOT NULL,
  privilege_level text NOT NULL,
  account_username text,
  grant_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active',
  revoked_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_access_rights_employee_idx ON employee_access_rights(employee_id, status);

INSERT INTO dropdown_options (category, value, label, display_order, is_active)
VALUES
  ('access_privilege_level', 'administrator', 'Administrator', 0, true),
  ('access_privilege_level', 'power_user', 'Power User', 1, true),
  ('access_privilege_level', 'data_entry', 'Data Entry', 2, true),
  ('access_privilege_level', 'viewer', 'Viewer', 3, true)
ON CONFLICT DO NOTHING;
