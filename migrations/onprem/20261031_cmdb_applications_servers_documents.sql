CREATE TABLE IF NOT EXISTS cmdb_applications (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  vendor text,
  business_owner varchar REFERENCES employees(id) ON DELETE SET NULL,
  technical_owner varchar REFERENCES employees(id) ON DELETE SET NULL,
  hosting_type text NOT NULL,
  criticality_rating text NOT NULL DEFAULT 'P3',
  status text NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cmdb_applications_name_ci_unique
  ON cmdb_applications (lower(btrim(name)));
CREATE INDEX IF NOT EXISTS cmdb_applications_category_status_idx
  ON cmdb_applications (category, status);

CREATE TABLE IF NOT EXISTS servers (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname text NOT NULL,
  ip_address text,
  os_platform text NOT NULL,
  environment text NOT NULL,
  cpu_ram_specs text,
  location text,
  status text NOT NULL DEFAULT 'online',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS servers_hostname_ci_unique
  ON servers (lower(btrim(hostname)));
CREATE INDEX IF NOT EXISTS servers_environment_status_idx
  ON servers (environment, status);

CREATE TABLE IF NOT EXISTS configuration_documents (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id varchar REFERENCES cmdb_applications(id) ON DELETE RESTRICT,
  server_id varchar REFERENCES servers(id) ON DELETE RESTRICT,
  document_type text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  original_name text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size integer,
  file_path text NOT NULL,
  uploaded_by varchar REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT configuration_documents_one_parent_check
    CHECK (num_nonnulls(application_id, server_id) = 1)
);

CREATE INDEX IF NOT EXISTS configuration_documents_application_idx
  ON configuration_documents (application_id, uploaded_at);
CREATE INDEX IF NOT EXISTS configuration_documents_server_idx
  ON configuration_documents (server_id, uploaded_at);
CREATE UNIQUE INDEX IF NOT EXISTS configuration_documents_app_version_unique
  ON configuration_documents (application_id, lower(btrim(original_name)), document_type, version)
  WHERE application_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS configuration_documents_server_version_unique
  ON configuration_documents (server_id, lower(btrim(original_name)), document_type, version)
  WHERE server_id IS NOT NULL;

INSERT INTO dropdown_options (category, value, label, display_order, is_active) VALUES
  ('application_category', 'business', 'Business', 0, true),
  ('application_category', 'finance', 'Finance', 1, true),
  ('application_category', 'collaboration', 'Collaboration', 2, true),
  ('application_category', 'security', 'Security', 3, true),
  ('application_category', 'infrastructure', 'Infrastructure', 4, true),
  ('application_category', 'customer_service', 'Customer Service', 5, true),
  ('os_platform', 'windows_server', 'Windows Server', 0, true),
  ('os_platform', 'ubuntu_server', 'Ubuntu Server', 1, true),
  ('os_platform', 'red_hat_enterprise_linux', 'Red Hat Enterprise Linux', 2, true),
  ('os_platform', 'debian', 'Debian', 3, true),
  ('os_platform', 'vmware_esxi', 'VMware ESXi', 4, true),
  ('os_platform', 'azure_linux', 'Azure Linux', 5, true),
  ('configuration_document_type', 'architecture', 'Architecture', 0, true),
  ('configuration_document_type', 'runbook', 'Runbook', 1, true),
  ('configuration_document_type', 'network_diagram', 'Network Diagram', 2, true),
  ('configuration_document_type', 'configuration', 'Configuration', 3, true),
  ('configuration_document_type', 'backup', 'Backup', 4, true),
  ('configuration_document_type', 'license', 'License', 5, true),
  ('configuration_document_type', 'security_assessment', 'Security Assessment', 6, true),
  ('configuration_document_type', 'other', 'Other', 7, true)
ON CONFLICT DO NOTHING;
