ALTER TABLE sla_policies
  ADD COLUMN IF NOT EXISTS response_escalation_group text,
  ADD COLUMN IF NOT EXISTS response_escalation_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution_escalation_group text,
  ADD COLUMN IF NOT EXISTS resolution_escalation_user_id varchar REFERENCES users(id) ON DELETE SET NULL;
