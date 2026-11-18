ALTER TABLE service_catalog_items ADD COLUMN IF NOT EXISTS default_priority text NOT NULL DEFAULT 'P3';
ALTER TABLE service_catalog_items ADD COLUMN IF NOT EXISTS default_impact text NOT NULL DEFAULT 'low';
ALTER TABLE service_catalog_items ADD COLUMN IF NOT EXISTS default_urgency text NOT NULL DEFAULT 'medium';
