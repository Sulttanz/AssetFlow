ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS cloud_provider text,
  ADD COLUMN IF NOT EXISTS tenant_account_id text,
  ADD COLUMN IF NOT EXISTS billing_cycle text,
  ADD COLUMN IF NOT EXISTS recurring_cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS auto_renewal boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS software_license_allocations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id varchar NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  employee_id varchar NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  allocated_at timestamp NOT NULL DEFAULT now(),
  released_at timestamp
);
CREATE INDEX IF NOT EXISTS software_license_allocations_asset_idx
  ON software_license_allocations(asset_id);
CREATE UNIQUE INDEX IF NOT EXISTS software_license_allocations_active_employee_idx
  ON software_license_allocations(asset_id, employee_id) WHERE released_at IS NULL;
