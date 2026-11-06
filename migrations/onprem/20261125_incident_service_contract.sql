ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS contract_id integer
    REFERENCES service_contracts(id) ON DELETE SET NULL;

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS is_warranty_expired boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS incidents_contract_id_idx
  ON incidents(contract_id);
