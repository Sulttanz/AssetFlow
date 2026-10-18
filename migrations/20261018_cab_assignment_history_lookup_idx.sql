-- Speed serialized CAB assignment checks without constraining historical duplicates.
CREATE INDEX IF NOT EXISTS change_approvals_change_original_approver_idx
  ON change_approvals (change_id, original_approver_id);
