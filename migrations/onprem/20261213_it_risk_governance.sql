CREATE SEQUENCE IF NOT EXISTS risk_register_number_seq START WITH 1;

ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS risk_number text;
ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS threat_source text;
ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS vulnerability text;
ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS cia_impact jsonb NOT NULL DEFAULT '{"confidentiality":false,"integrity":false,"availability":false}'::jsonb;
ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS existing_controls text;
ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS control_effectiveness text;
ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS target_impact integer;
ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS target_likelihood integer;
ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS treatment_strategy text NOT NULL DEFAULT 'Mitigate';
ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS review_frequency text NOT NULL DEFAULT 'Quarterly';
ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS last_reviewed_at timestamp;
ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS next_review_date date;
ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS contingency_plan text;
ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS acceptance_justification text;
ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS accepted_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS accepted_at timestamp;
ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS acceptance_expires_at date;

UPDATE risk_register
SET risk_number = 'IT-RSK-' || regexp_replace('00' || nextval('risk_register_number_seq')::text, '^0+(?=[0-9]{3})', '')
WHERE risk_number IS NULL;
UPDATE risk_register
SET category = CASE lower(category)
  WHEN 'security' THEN 'Cybersecurity & Vulnerability'
  WHEN 'data' THEN 'Cybersecurity & Vulnerability'
  WHEN 'availability' THEN 'Infrastructure & High Availability'
  WHEN 'compliance' THEN 'Regulatory & Compliance'
  WHEN 'vendor' THEN 'Third-Party & Vendor'
  WHEN 'backup' THEN 'Backup, DR & Continuity'
  WHEN 'identity' THEN 'Identity, Access & Patching'
  WHEN 'schedule' THEN 'Service Delivery & ITSM'
  WHEN 'operational' THEN 'Service Delivery & ITSM'
  WHEN 'other' THEN 'Service Delivery & ITSM'
  ELSE category
END
WHERE lower(category) IN ('security','data','availability','compliance','vendor','backup','identity','schedule','operational','other');

-- Preserve historical acceptance text without inventing an approver or approval date.
UPDATE risk_register SET treatment_strategy = 'Accept',
  acceptance_justification = COALESCE(acceptance_justification, acceptance_reason)
WHERE status = 'accepted';
ALTER TABLE risk_register ALTER COLUMN category SET DEFAULT 'Service Delivery & ITSM';

-- Existing historical exceptions remain readable; new/updated rows must satisfy the scoring contract.
DO $risk_checks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'risk_register'::regclass AND conname = 'risk_register_scores_check') THEN
    ALTER TABLE risk_register ADD CONSTRAINT risk_register_scores_check CHECK (
      likelihood BETWEEN 1 AND 5 AND impact BETWEEN 1 AND 5
      AND (residual_likelihood IS NULL OR residual_likelihood BETWEEN 1 AND 5)
      AND (residual_impact IS NULL OR residual_impact BETWEEN 1 AND 5)
      AND (target_likelihood IS NULL OR target_likelihood BETWEEN 1 AND 5)
      AND (target_impact IS NULL OR target_impact BETWEEN 1 AND 5)
    ) NOT VALID;
  END IF;
END
$risk_checks$;

ALTER TABLE risk_register ALTER COLUMN risk_number SET NOT NULL;
ALTER TABLE risk_register ALTER COLUMN risk_number SET DEFAULT ('IT-RSK-' || regexp_replace('00' || nextval('risk_register_number_seq')::text, '^0+(?=[0-9]{3})', ''));
CREATE UNIQUE INDEX IF NOT EXISTS risk_register_number_uq ON risk_register(risk_number);
CREATE INDEX IF NOT EXISTS risk_register_review_due_idx ON risk_register(next_review_date);
CREATE INDEX IF NOT EXISTS risk_register_acceptance_expiry_idx ON risk_register(acceptance_expires_at);

CREATE TABLE IF NOT EXISTS risk_mitigation_actions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id varchar NOT NULL REFERENCES risk_register(id) ON DELETE CASCADE,
  title text NOT NULL,
  owner_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  due_date date,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In Progress','Completed','Overdue')),
  evidence_notes text,
  completed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS risk_mitigation_actions_risk_status_idx ON risk_mitigation_actions(risk_id,status);
CREATE INDEX IF NOT EXISTS risk_mitigation_actions_owner_due_idx ON risk_mitigation_actions(owner_user_id,due_date);

CREATE TABLE IF NOT EXISTS risk_review_history (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id varchar NOT NULL REFERENCES risk_register(id) ON DELETE CASCADE,
  reviewed_by_id varchar REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'review',
  notes text,
  previous_inherent_score integer,
  inherent_score integer NOT NULL,
  previous_residual_score integer,
  residual_score integer,
  previous_status text,
  status text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS risk_review_history_risk_created_idx ON risk_review_history(risk_id,created_at);

CREATE TABLE IF NOT EXISTS risk_application_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id varchar NOT NULL REFERENCES risk_register(id) ON DELETE CASCADE,
  application_id varchar NOT NULL REFERENCES cmdb_applications(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(risk_id,application_id)
);
CREATE TABLE IF NOT EXISTS risk_server_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id varchar NOT NULL REFERENCES risk_register(id) ON DELETE CASCADE,
  server_id varchar NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(risk_id,server_id)
);
CREATE TABLE IF NOT EXISTS risk_network_device_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id varchar NOT NULL REFERENCES risk_register(id) ON DELETE CASCADE,
  network_device_id varchar NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(risk_id,network_device_id)
);
CREATE TABLE IF NOT EXISTS risk_asset_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id varchar NOT NULL REFERENCES risk_register(id) ON DELETE CASCADE,
  asset_id varchar NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(risk_id,asset_id)
);
CREATE TABLE IF NOT EXISTS risk_vendor_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id varchar NOT NULL REFERENCES risk_register(id) ON DELETE CASCADE,
  vendor_id varchar NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(risk_id,vendor_id)
);
CREATE TABLE IF NOT EXISTS risk_compliance_review_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id varchar NOT NULL REFERENCES risk_register(id) ON DELETE CASCADE,
  compliance_review_id varchar NOT NULL REFERENCES it_component_compliance_reviews(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(risk_id,compliance_review_id)
);
CREATE TABLE IF NOT EXISTS risk_problem_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id varchar NOT NULL REFERENCES risk_register(id) ON DELETE CASCADE,
  problem_id varchar NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(risk_id,problem_id)
);
CREATE TABLE IF NOT EXISTS risk_change_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id varchar NOT NULL REFERENCES risk_register(id) ON DELETE CASCADE,
  change_id varchar NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(risk_id,change_id)
);

INSERT INTO system_settings (key,value,description,category)
VALUES ('it_risk_appetite_threshold','12','Maximum residual risk score accepted without elevated sign-off','risk_management')
ON CONFLICT (key) DO NOTHING;
