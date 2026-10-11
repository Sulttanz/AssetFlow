-- Keep the dashboard's strict active-pending total on a compact index-only path.
CREATE INDEX IF NOT EXISTS change_approvals_active_pending_count_idx
  ON change_approvals (decision)
  WHERE removed_at IS NULL AND decision = 'pending';
