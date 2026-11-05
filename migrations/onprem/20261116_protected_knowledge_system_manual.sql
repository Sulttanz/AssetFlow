ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS is_system_guide boolean NOT NULL DEFAULT false;
