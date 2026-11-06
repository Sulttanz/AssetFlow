CREATE TABLE IF NOT EXISTS service_contracts (
  id serial PRIMARY KEY,
  contract_number text NOT NULL,
  contract_name text NOT NULL,
  project_id varchar REFERENCES projects(id) ON DELETE SET NULL,
  client_id text,
  sla_policy_id varchar REFERENCES sla_policies(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  renewal_notice_days integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_contracts_dates_check CHECK (end_date >= start_date),
  CONSTRAINT service_contracts_renewal_notice_check CHECK (renewal_notice_days BETWEEN 0 AND 3650),
  CONSTRAINT service_contracts_status_check CHECK (status IN ('active', 'near_expiration', 'expired', 'renewed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS service_contracts_contract_number_uq
  ON service_contracts (lower(btrim(contract_number)));
CREATE INDEX IF NOT EXISTS service_contracts_project_idx
  ON service_contracts (project_id);
CREATE INDEX IF NOT EXISTS service_contracts_sla_policy_idx
  ON service_contracts (sla_policy_id);
CREATE INDEX IF NOT EXISTS service_contracts_status_end_date_idx
  ON service_contracts (status, end_date);
