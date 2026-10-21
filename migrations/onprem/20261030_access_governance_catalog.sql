ALTER TABLE employee_access_rights ADD COLUMN IF NOT EXISTS access_type text NOT NULL DEFAULT 'application';
ALTER TABLE employee_access_rights ADD COLUMN IF NOT EXISTS catalog_source text NOT NULL DEFAULT 'legacy';
ALTER TABLE employee_access_rights ADD COLUMN IF NOT EXISTS catalog_item_id text;
CREATE INDEX IF NOT EXISTS employee_access_rights_catalog_idx ON employee_access_rights(catalog_source, catalog_item_id, status);
