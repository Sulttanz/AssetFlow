ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS slug text NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS owner_id varchar REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS review_date date;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS version text NOT NULL DEFAULT '1.0';
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS kb_articles_slug_unique_ci ON kb_articles (lower(slug));
CREATE INDEX IF NOT EXISTS kb_articles_visibility_idx ON kb_articles (status, is_public);

CREATE TABLE IF NOT EXISTS kb_article_versions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id varchar NOT NULL REFERENCES kb_articles(id) ON DELETE RESTRICT,
  version text NOT NULL,
  snapshot jsonb NOT NULL,
  actor_id varchar REFERENCES users(id) ON DELETE SET NULL,
  change_note text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS kb_article_versions_article_version_unique
  ON kb_article_versions (article_id, version);

CREATE TABLE IF NOT EXISTS kb_ticket_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id varchar NOT NULL REFERENCES kb_articles(id) ON DELETE RESTRICT,
  article_version text NOT NULL,
  incident_id varchar REFERENCES incidents(id) ON DELETE CASCADE,
  service_request_id varchar REFERENCES service_requests(id) ON DELETE CASCADE,
  linked_by_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT kb_ticket_links_one_ticket CHECK (num_nonnulls(incident_id, service_request_id) = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS kb_ticket_links_incident_unique ON kb_ticket_links (incident_id, article_id);
CREATE UNIQUE INDEX IF NOT EXISTS kb_ticket_links_request_unique ON kb_ticket_links (service_request_id, article_id);

INSERT INTO dropdown_options (category, value, label, display_order, is_active)
VALUES
  ('kb_category', 'Policy', 'Policy', 0, true),
  ('kb_category', 'Technical SOP', 'Technical SOP', 1, true),
  ('kb_category', 'User Guide', 'User Guide', 2, true),
  ('kb_category', 'KEDB Article', 'KEDB Article', 3, true),
  ('kb_category', 'DR Plan', 'DR Plan', 4, true)
ON CONFLICT DO NOTHING;
