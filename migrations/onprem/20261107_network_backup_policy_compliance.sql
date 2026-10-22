CREATE TABLE IF NOT EXISTS network_zones (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  cidr text,
  security_level text NOT NULL DEFAULT 'internal',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS network_zones_name_ci_unique ON network_zones (lower(btrim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS network_zones_code_ci_unique ON network_zones (lower(btrim(code)));
CREATE INDEX IF NOT EXISTS network_zones_active_idx ON network_zones (is_active, name);

CREATE TABLE IF NOT EXISTS network_devices (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  device_type text NOT NULL CHECK (device_type IN ('firewall', 'router', 'switch', 'access_point', 'load_balancer', 'other')),
  hostname text,
  management_ip text,
  manufacturer text,
  model text,
  serial_number text,
  zone_id varchar REFERENCES network_zones(id) ON DELETE SET NULL,
  asset_id varchar REFERENCES assets(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  notes text,
  created_by_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS network_devices_hostname_ci_unique
  ON network_devices (lower(btrim(hostname)))
  WHERE hostname IS NOT NULL AND btrim(hostname) <> '';
CREATE INDEX IF NOT EXISTS network_devices_zone_status_idx ON network_devices (zone_id, status);
CREATE INDEX IF NOT EXISTS network_devices_type_status_idx ON network_devices (device_type, status);

CREATE TABLE IF NOT EXISTS network_device_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  source_device_id varchar NOT NULL REFERENCES network_devices(id) ON DELETE RESTRICT,
  target_device_id varchar NOT NULL REFERENCES network_devices(id) ON DELETE RESTRICT,
  link_type text NOT NULL DEFAULT 'connection',
  source_interface text,
  target_interface text,
  notes text,
  created_by_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT network_device_links_distinct_devices_check CHECK (source_device_id <> target_device_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS network_device_links_pair_unique
  ON network_device_links (source_device_id, target_device_id);
CREATE INDEX IF NOT EXISTS network_device_links_target_idx ON network_device_links (target_device_id);

CREATE TABLE IF NOT EXISTS firewall_rules (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_reference text,
  name text NOT NULL,
  firewall_device_id varchar NOT NULL REFERENCES network_devices(id) ON DELETE RESTRICT,
  source_zone_id varchar REFERENCES network_zones(id) ON DELETE SET NULL,
  source_addresses text NOT NULL DEFAULT 'any',
  destination_zone_id varchar REFERENCES network_zones(id) ON DELETE SET NULL,
  destination_addresses text NOT NULL DEFAULT 'any',
  protocol text NOT NULL DEFAULT 'any',
  ports text,
  action text NOT NULL CHECK (action IN ('allow', 'deny')),
  business_justification text NOT NULL CHECK (length(trim(business_justification)) >= 10),
  owner_id varchar REFERENCES users(id) ON DELETE SET NULL,
  change_id varchar REFERENCES changes(id) ON DELETE SET NULL,
  review_interval_days integer NOT NULL DEFAULT 90 CHECK (review_interval_days BETWEEN 1 AND 3650),
  next_review_due_at date,
  last_reviewed_at timestamp,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS firewall_rules_device_reference_ci_unique
  ON firewall_rules (firewall_device_id, lower(btrim(rule_reference)))
  WHERE rule_reference IS NOT NULL AND btrim(rule_reference) <> '';
CREATE INDEX IF NOT EXISTS firewall_rules_review_due_idx ON firewall_rules (status, next_review_due_at);
CREATE INDEX IF NOT EXISTS firewall_rules_device_idx ON firewall_rules (firewall_device_id, status);

CREATE TABLE IF NOT EXISTS firewall_rule_reviews (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  firewall_rule_id varchar NOT NULL REFERENCES firewall_rules(id) ON DELETE RESTRICT,
  reviewer_id varchar REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamp NOT NULL DEFAULT now(),
  outcome text NOT NULL CHECK (outcome IN ('approved', 'changes_requested', 'revoked')),
  next_review_due_at date,
  notes text NOT NULL CHECK (length(trim(notes)) >= 5)
);
CREATE INDEX IF NOT EXISTS firewall_rule_reviews_rule_date_idx
  ON firewall_rule_reviews (firewall_rule_id, reviewed_at);

CREATE TABLE IF NOT EXISTS backup_schedules (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  server_id varchar REFERENCES servers(id) ON DELETE RESTRICT,
  application_id varchar REFERENCES cmdb_applications(id) ON DELETE RESTRICT,
  backup_type text NOT NULL DEFAULT 'full' CHECK (backup_type IN ('full', 'incremental', 'differential', 'snapshot')),
  frequency text NOT NULL CHECK (frequency IN ('hourly', 'daily', 'weekly', 'monthly', 'custom')),
  custom_frequency text,
  retention_days integer NOT NULL CHECK (retention_days BETWEEN 1 AND 36500),
  retention_policy text,
  destination text NOT NULL,
  owner_id varchar REFERENCES users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  next_due_at timestamp,
  created_by_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT backup_schedules_one_target_check CHECK (num_nonnulls(server_id, application_id) = 1)
);
CREATE INDEX IF NOT EXISTS backup_schedules_active_due_idx ON backup_schedules (is_active, next_due_at);
CREATE INDEX IF NOT EXISTS backup_schedules_server_idx ON backup_schedules (server_id);
CREATE INDEX IF NOT EXISTS backup_schedules_application_idx ON backup_schedules (application_id);

CREATE TABLE IF NOT EXISTS backup_job_runs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id varchar NOT NULL REFERENCES backup_schedules(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
  started_at timestamp NOT NULL,
  completed_at timestamp,
  data_size_mb integer CHECK (data_size_mb IS NULL OR data_size_mb >= 0),
  restore_point text,
  evidence_reference text,
  notes text NOT NULL CHECK (length(trim(notes)) >= 5),
  logged_by_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT backup_job_runs_time_order_check CHECK (completed_at IS NULL OR completed_at >= started_at)
);
CREATE INDEX IF NOT EXISTS backup_job_runs_schedule_started_idx ON backup_job_runs (schedule_id, started_at);
CREATE INDEX IF NOT EXISTS backup_job_runs_status_started_idx ON backup_job_runs (status, started_at);

CREATE TABLE IF NOT EXISTS backup_restore_tests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id varchar NOT NULL REFERENCES backup_schedules(id) ON DELETE RESTRICT,
  tested_at timestamp NOT NULL DEFAULT now(),
  outcome text NOT NULL CHECK (outcome IN ('passed', 'failed', 'partial')),
  recovery_point text,
  measured_rto_minutes integer CHECK (measured_rto_minutes IS NULL OR measured_rto_minutes >= 0),
  measured_rpo_minutes integer CHECK (measured_rpo_minutes IS NULL OR measured_rpo_minutes >= 0),
  evidence_reference text,
  notes text NOT NULL CHECK (length(trim(notes)) >= 5),
  tester_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS backup_restore_tests_schedule_tested_idx
  ON backup_restore_tests (schedule_id, tested_at);

CREATE TABLE IF NOT EXISTS kb_article_attachments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id varchar NOT NULL REFERENCES kb_articles(id) ON DELETE RESTRICT,
  article_version text NOT NULL,
  document_type text NOT NULL DEFAULT 'official_policy',
  version integer NOT NULL DEFAULT 1,
  original_name text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size integer,
  file_path text NOT NULL,
  uploaded_by varchar REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS kb_article_attachments_name_type_version_unique
  ON kb_article_attachments (article_id, lower(btrim(original_name)), document_type, version);
CREATE INDEX IF NOT EXISTS kb_article_attachments_article_uploaded_idx
  ON kb_article_attachments (article_id, uploaded_at);

CREATE TABLE IF NOT EXISTS kb_article_control_mappings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id varchar NOT NULL REFERENCES kb_articles(id) ON DELETE RESTRICT,
  article_version text NOT NULL,
  framework text NOT NULL,
  control_id text NOT NULL,
  control_title text NOT NULL,
  implementation_notes text,
  mapped_by varchar REFERENCES users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  removed_by varchar REFERENCES users(id) ON DELETE SET NULL,
  removed_at timestamp,
  removal_note text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS kb_article_control_mappings_unique_ci
  ON kb_article_control_mappings (article_id, lower(btrim(framework)), lower(btrim(control_id)))
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS kb_article_control_mappings_framework_idx
  ON kb_article_control_mappings (framework, control_id);
