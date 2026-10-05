-- Limit CAB alert lookups to a user's active, undecided assignments.
CREATE INDEX IF NOT EXISTS change_approvals_pending_approver_change_idx
  ON change_approvals (approver_id, change_id)
  WHERE removed_at IS NULL AND (decision = 'pending' OR decision IS NULL);