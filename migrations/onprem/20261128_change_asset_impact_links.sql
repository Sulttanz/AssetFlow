CREATE TABLE IF NOT EXISTS change_asset_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  change_request_id varchar NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
  asset_id varchar NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (change_request_id, asset_id)
);
CREATE INDEX IF NOT EXISTS change_asset_links_change_idx
  ON change_asset_links (change_request_id);
CREATE INDEX IF NOT EXISTS change_asset_links_asset_idx
  ON change_asset_links (asset_id);
