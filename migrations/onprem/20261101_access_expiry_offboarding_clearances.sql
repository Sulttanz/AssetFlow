ALTER TABLE employee_access_rights
  ADD COLUMN IF NOT EXISTS business_justification text NOT NULL DEFAULT 'Legacy access record - justification pending review';
ALTER TABLE employee_access_rights
  ADD COLUMN IF NOT EXISTS expires_at date;
ALTER TABLE employee_access_rights
  ADD COLUMN IF NOT EXISTS revocation_reason text;
CREATE INDEX IF NOT EXISTS employee_access_rights_expiry_idx
  ON employee_access_rights (expires_at, status);

CREATE TABLE IF NOT EXISTS employee_offboarding_clearances (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id varchar NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  offboarding_date date NOT NULL,
  clearance_type text NOT NULL
    CHECK (clearance_type IN ('physical_asset_return', 'credential_vpn_revocation', 'license_reallocation')),
  status text NOT NULL CHECK (status IN ('verified', 'waived')),
  note text,
  signed_by varchar REFERENCES users(id) ON DELETE SET NULL,
  signed_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_offboarding_clearance_employee_idx
  ON employee_offboarding_clearances (employee_id, offboarding_date, signed_at);
