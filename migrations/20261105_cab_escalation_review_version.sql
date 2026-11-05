-- A material risk or change-type escalation invalidates all decisions from the
-- previous CAB review while retaining each superseded vote for the audit trail.
ALTER TABLE changes
  ADD COLUMN IF NOT EXISTS cab_review_version integer NOT NULL DEFAULT 1;

ALTER TABLE change_approvals
  ADD COLUMN IF NOT EXISTS review_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS decision_history jsonb NOT NULL DEFAULT '[]'::jsonb;
