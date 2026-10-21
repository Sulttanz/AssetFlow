CREATE TABLE IF NOT EXISTS application_server_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id varchar NOT NULL REFERENCES cmdb_applications(id) ON DELETE CASCADE,
  server_id varchar NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (application_id, server_id)
);
CREATE INDEX IF NOT EXISTS application_server_links_server_idx
  ON application_server_links (server_id);
CREATE INDEX IF NOT EXISTS application_server_links_application_idx
  ON application_server_links (application_id);

CREATE TABLE IF NOT EXISTS change_ci_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  change_request_id varchar NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
  application_id varchar REFERENCES cmdb_applications(id) ON DELETE CASCADE,
  server_id varchar REFERENCES servers(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT change_ci_links_one_target_check CHECK (num_nonnulls(application_id, server_id) = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS change_ci_links_application_unique
  ON change_ci_links (change_request_id, application_id);
CREATE UNIQUE INDEX IF NOT EXISTS change_ci_links_server_unique
  ON change_ci_links (change_request_id, server_id);
CREATE INDEX IF NOT EXISTS change_ci_links_change_idx
  ON change_ci_links (change_request_id);
CREATE INDEX IF NOT EXISTS change_ci_links_application_idx
  ON change_ci_links (application_id);
CREATE INDEX IF NOT EXISTS change_ci_links_server_idx
  ON change_ci_links (server_id);
