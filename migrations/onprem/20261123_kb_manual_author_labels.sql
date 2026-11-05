ALTER TABLE kb_articles
  ADD COLUMN IF NOT EXISTS author_label text,
  ADD COLUMN IF NOT EXISTS owner_label text;
