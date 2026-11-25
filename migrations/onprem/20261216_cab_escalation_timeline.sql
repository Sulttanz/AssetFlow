-- Keep change-level CAB review resets available even when no approvers exist.
ALTER TABLE changes
  ADD COLUMN IF NOT EXISTS cab_escalation_history jsonb NOT NULL DEFAULT '[]'::jsonb;
