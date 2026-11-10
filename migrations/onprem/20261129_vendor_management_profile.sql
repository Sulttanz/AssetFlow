ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'Tier 2 - Preferred',
  ADD COLUMN IF NOT EXISTS account_manager text,
  ADD COLUMN IF NOT EXISTS support_url text,
  ADD COLUMN IF NOT EXISTS sla_terms text;

CREATE INDEX IF NOT EXISTS vendors_tier_status_idx
  ON vendors (tier, status);
