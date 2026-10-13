-- Apply to the application's database before running code that reads the new columns.
-- Backfill before switching the foreign key: existing decisions and assignment IDs remain intact.
-- The development migration runner applies each file in its own transaction.

ALTER TABLE change_approvals
  ADD COLUMN IF NOT EXISTS original_approver_id varchar,
  ADD COLUMN IF NOT EXISTS approver_label text;

UPDATE change_approvals AS a
SET original_approver_id = COALESCE(a.original_approver_id, a.approver_id),
    approver_label = COALESCE(
      NULLIF(trim(a.approver_label), ''),
      NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
      u.username,
      a.approver_id,
      a.original_approver_id
    )
FROM users AS u
WHERE u.id = a.approver_id
  AND (
    a.original_approver_id IS NULL
    OR a.approver_label IS NULL
    OR trim(a.approver_label) = ''
  );

-- Deleted-account rows may already have a retained original ID but no display label.
UPDATE change_approvals AS a
SET approver_label = COALESCE(
  NULLIF(trim(a.approver_label), ''),
  a.original_approver_id
)
WHERE a.original_approver_id IS NOT NULL
  AND (a.approver_label IS NULL OR trim(a.approver_label) = '');

ALTER TABLE change_approvals
  ALTER COLUMN original_approver_id SET NOT NULL,
  ALTER COLUMN approver_label SET NOT NULL,
  ALTER COLUMN approver_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS change_approvals_approver_id_users_id_fk,
  DROP CONSTRAINT IF EXISTS change_approvals_change_id_approver_id_unique;

ALTER TABLE change_approvals
  ADD CONSTRAINT change_approvals_approver_id_users_id_fk
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL;

-- Do not add a uniqueness constraint to the historical identity: some existing
-- changes contain duplicate assignments, which must not be discarded here.
